// Formatting for signed-in activity figures. A null is a value the backend
// could not measure, so every formatter shows it as a dash. None of them turns
// it into a zero.

const DASH = "—";

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 45 -> "45s", 720 -> "12m", 3900 -> "1h 05m". Seconds are rounded first. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!isNumber(seconds)) return DASH;
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function formatCount(value: number | null | undefined): string {
  return isNumber(value) ? value.toLocaleString("en-KE") : DASH;
}

/** Percent values arrive already multiplied by 100 (12.5 means 12.5%). */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  return isNumber(value) ? `${value.toFixed(digits)}%` : DASH;
}

export function formatRatio(value: number | null | undefined): string {
  return isNumber(value) ? value.toFixed(2) : DASH;
}

/**
 * What the coverage date means to an administrator. Periods before the first
 * recorded day are not zero; the system did not measure them.
 */
export function coverageNote(startedOn: string | null | undefined): string {
  if (!startedOn) {
    return "No signed-in activity has been recorded yet, so no period can be measured.";
  }
  return `Activity has been recorded since ${startedOn} (UTC days). Earlier periods are left blank, not counted as zero.`;
}

/** Whole UTC days for a range that ends today, inclusive of today. */
export function utcRangeEndingToday(days: number, now: Date = new Date()): { from: string; to: string } {
  const endExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(endExclusive.getTime() - days * 86_400_000);
  return { from: start.toISOString().slice(0, 10), to: endExclusive.toISOString().slice(0, 10) };
}
