import { z } from "zod";

// Local copies of the revenue/timeseries contracts. The shared proxy schemas
// (lib/api/schemas.ts) do not cover these endpoints yet, so we validate here
// and stay honest when the backend is not deployed.

export const RevenueBucketSchema = z.enum(["day", "week", "month"]);
export type RevenueBucket = z.infer<typeof RevenueBucketSchema>;

const StreamSchema = z.object({
  key: z.string(),
  label: z.string(),
  amount_minor: z.number(),
  count: z.number(),
});

const CostKindSchema = z.object({
  key: z.string(),
  label: z.string(),
  amount_minor: z.number(),
  count: z.number(),
  estimated: z.boolean(),
});

const SeriesBucketSchema = z.object({
  bucket_start: z.string(),
  income_minor: z.number(),
  costs_minor: z.number(),
  profit_minor: z.number(),
});

export const RevenueResponseSchema = z.object({
  currency: z.string().default("KES"),
  from: z.string(),
  to: z.string(),
  bucket: RevenueBucketSchema,
  income: z.object({
    total_minor: z.number(),
    streams: z.array(StreamSchema),
  }),
  costs: z.object({
    total_minor: z.number(),
    estimated_minor: z.number(),
    kinds: z.array(CostKindSchema),
  }),
  profit_minor: z.number(),
  margin_pct: z.number(),
  series: z.array(SeriesBucketSchema),
  notes: z.array(z.string()),
});

export type RevenueResponse = z.infer<typeof RevenueResponseSchema>;
export type RevenueStream = z.infer<typeof StreamSchema>;
export type RevenueCostKind = z.infer<typeof CostKindSchema>;
export type RevenueSeriesBucket = z.infer<typeof SeriesBucketSchema>;

const TimeseriesPointSchema = z.object({
  t: z.string(),
  v: z.number(),
});

export const TimeseriesResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  bucket: RevenueBucketSchema,
  series: z.record(z.string(), z.array(TimeseriesPointSchema)),
});

export type TimeseriesResponse = z.infer<typeof TimeseriesResponseSchema>;
export type TimeseriesPoint = z.infer<typeof TimeseriesPointSchema>;

export interface RevenueQuery {
  from: string;
  to: string;
  bucket: RevenueBucket;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateToUtcMs(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(value + "T00:00:00.000Z");
  return Number.isFinite(parsed) ? parsed : null;
}

function utcDateString(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function addCalendarDays(value: string, days: number): string {
  const timestamp = dateToUtcMs(value);
  return timestamp === null ? value : utcDateString(timestamp + days * DAY_MS);
}

/**
 * Build ?from=ISO&to=ISO&bucket= query params.
 *
 * The dashboard date inputs are inclusive calendar dates. The API uses a
 * half-open [from, to) interval, so move the selected end date forward one
 * day before requesting it. This keeps the entire selected "To" date in view.
 */
export function buildRevenueQuery({ from, to, bucket }: RevenueQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set("from", from);
  params.set("to", addCalendarDays(to, 1));
  params.set("bucket", bucket);
  return params;
}

/**
 * Return the immediately preceding range with the same number of inclusive
 * calendar days. Both ranges use the same bucket size and do not overlap.
 */
export function previousRevenuePeriod(params: RevenueQuery): RevenueQuery | null {
  const start = dateToUtcMs(params.from);
  const end = dateToUtcMs(params.to);
  if (start === null || end === null || end < start) return null;

  const dayCount = Math.floor((end - start) / DAY_MS) + 1;
  const previousTo = start - DAY_MS;
  const previousFrom = previousTo - (dayCount - 1) * DAY_MS;

  return {
    from: utcDateString(previousFrom),
    to: utcDateString(previousTo),
    bucket: params.bucket,
  };
}
