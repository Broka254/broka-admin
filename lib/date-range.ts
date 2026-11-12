import type { RevenueBucket } from "@/lib/api/revenue";

export interface DateRangeSelection {
  from: string;
  to: string;
  bucket: RevenueBucket;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BUCKETS: RevenueBucket[] = ["day", "week", "month"];

function validDay(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return false;
  // Reject calendar overflow such as 2026-02-31, which Date.parse normalises.
  return new Date(ms).toISOString().slice(0, 10) === value;
}

/**
 * Reads a date range from the URL, falling back when any part is malformed.
 * A shared filter is only trustworthy if it round-trips exactly, so a single
 * bad parameter restores the whole default rather than mixing halves.
 */
export function readDateRangeParams(params: URLSearchParams, fallback: DateRangeSelection): DateRangeSelection {
  const from = params.get("from");
  const to = params.get("to");
  if (!from || !to || !validDay(from) || !validDay(to)) return fallback;
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  if (fromMs > toMs) return fallback;
  const bucket = params.get("bucket") as RevenueBucket | null;
  return { from, to, bucket: bucket && BUCKETS.includes(bucket) ? bucket : fallback.bucket };
}

/** Writes a date range into a query string, preserving unrelated parameters. */
export function writeDateRangeParams(next: DateRangeSelection, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  params.set("from", next.from);
  params.set("to", next.to);
  params.set("bucket", next.bucket);
  return params;
}
