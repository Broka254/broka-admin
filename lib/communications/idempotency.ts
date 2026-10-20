export type IdempotencyOperation = {
  fingerprint: string;
  key: string;
};

export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

export function operationFingerprint(operation: string, payload: unknown): string {
  return `${operation}:${stableSerialize(payload)}`;
}

/**
 * Keeps one key for one logical mutation. A changed operation/payload starts a
 * new logical mutation; retries of the same payload reuse the original key.
 * This is client-side request identity only and is not deduplication.
 */
export class IdempotencyKeyLedger {
  private current: IdempotencyOperation | null = null;

  constructor(private readonly createKey: () => string = () => crypto.randomUUID()) {}

  keyFor(fingerprint: string): string {
    if (!this.current || this.current.fingerprint !== fingerprint) {
      this.current = { fingerprint, key: this.createKey() };
    }
    return this.current.key;
  }

  peek(fingerprint?: string): string | null {
    if (!this.current) return null;
    if (fingerprint && this.current.fingerprint !== fingerprint) return null;
    return this.current.key;
  }

  reset(): void {
    this.current = null;
  }
}

export class SingleFlight {
  private active = false;

  tryBegin(): boolean {
    if (this.active) return false;
    this.active = true;
    return true;
  }

  end(): void {
    this.active = false;
  }

  get inFlight(): boolean {
    return this.active;
  }
}

