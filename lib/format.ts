const KES_CURRENCY = "KES";
const MINOR_PER_MAJOR = 100;

/** Format minor units (cents) as e.g. `KES 12,345`. Keeps cents only when needed. */
export function formatKES(minor: number, currency: string = KES_CURRENCY): string {
  if (!Number.isFinite(minor)) return `${currency} 0`;
  const rounded = Math.round(minor);
  const sign = rounded < 0 ? "-" : "";
  const hasCents = Math.abs(rounded) % MINOR_PER_MAJOR !== 0;
  const formatted = new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(Math.abs(rounded) / MINOR_PER_MAJOR);
  return `${sign}${currency} ${formatted}`;
}

/** Compact axis-friendly money label, e.g. `KES 12K`. Input is minor units. */
export function formatCompact(minor: number, currency: string = KES_CURRENCY): string {
  if (!Number.isFinite(minor)) return `${currency} 0`;
  const compact = new Intl.NumberFormat("en", {
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(minor / MINOR_PER_MAJOR);
  return `${currency} ${compact}`;
}

/** Percentage with one decimal, e.g. `23.4%`. */
export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

/**
 * Timezone-safe ISO timestamp formatting. Parsing an ISO string with an
 * explicit offset is absolute; we only choose the display locale here.
 * Returns the raw input when it cannot be parsed.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Short axis label for a bucket start, e.g. `12 Oct`. */
export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}
