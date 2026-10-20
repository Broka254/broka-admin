import { describe, expect, it } from "vitest";

import {
  IdempotencyKeyLedger,
  SingleFlight,
  operationFingerprint,
  stableSerialize,
} from "@/lib/communications/idempotency";

describe("logical mutation identity", () => {
  it("serializes payload keys deterministically", () => {
    expect(stableSerialize({ b: 2, a: { d: 4, c: 3 } })).toBe(
      stableSerialize({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it("reuses a key for retries of the same operation and payload", () => {
    let sequence = 0;
    const ledger = new IdempotencyKeyLedger(() => `key-${++sequence}`);
    const first = operationFingerprint("create", { title: "Maintenance" });
    const replay = operationFingerprint("create", { title: "Maintenance" });
    expect(ledger.keyFor(first)).toBe("key-1");
    expect(ledger.keyFor(replay)).toBe("key-1");
  });

  it("starts a new key for a changed payload or a new operation", () => {
    let sequence = 0;
    const ledger = new IdempotencyKeyLedger(() => `key-${++sequence}`);
    const original = operationFingerprint("create", { title: "A" });
    expect(ledger.keyFor(original)).toBe("key-1");
    expect(ledger.keyFor(operationFingerprint("create", { title: "B" }))).toBe("key-2");
    expect(ledger.keyFor(operationFingerprint("update:c1", { title: "B" }))).toBe("key-3");
    ledger.reset();
    expect(ledger.keyFor(operationFingerprint("update:c1", { title: "B" }))).toBe("key-4");
  });

  it("blocks duplicate in-flight submissions until the first one settles", () => {
    const guard = new SingleFlight();
    expect(guard.tryBegin()).toBe(true);
    expect(guard.tryBegin()).toBe(false);
    expect(guard.inFlight).toBe(true);
    guard.end();
    expect(guard.tryBegin()).toBe(true);
  });
});

