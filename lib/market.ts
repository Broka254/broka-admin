import type { MarketListingRow } from "@/lib/api/market-schemas";
import type { CsvRow } from "@/lib/csv";

// Pure rules for the marketplace intelligence view: which rankings exist,
// what query a window or a custom range becomes, and what a ranking exports.
// Kept out of the component so each rule is tested once.

export const MARKET_WINDOWS = [
  { value: "1", label: "24 hours" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "custom", label: "Custom" },
] as const;
export type MarketWindow = (typeof MARKET_WINDOWS)[number]["value"];

/** The longest custom range the API accepts (MAX_MARKET_RANGE_DAYS in the backend). */
export const MAX_CUSTOM_RANGE_DAYS = 90;

export const RANKING_OPTIONS = [
  { value: "viewed", label: "Most viewed" },
  { value: "saved", label: "Most saved" },
  { value: "liked", label: "Most liked" },
  { value: "contacted", label: "Most contacted" },
  { value: "negotiated", label: "Most negotiated" },
  { value: "converted", label: "Converted to deals" },
  { value: "trending", label: "Trending" },
  { value: "growing", label: "Growing fastest" },
] as const;
export type RankingKey = (typeof RANKING_OPTIONS)[number]["value"];

export function isRankingKey(value: string): value is RankingKey {
  return RANKING_OPTIONS.some((option) => option.value === value);
}

/** Rankings ordered by the score's change against the window before. */
export function isScoreRanking(key: RankingKey): boolean {
  return key === "trending" || key === "growing";
}

export type CustomRange = { from: string; to: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function dayMs(value: string): number | null {
  if (!ISO_DAY.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  // Date.parse rolls 2026-02-31 over into March; that is not the day chosen.
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) return null;
  return ms;
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Calendar days in a custom range, both ends included; null when a date is invalid. */
export function rangeDays(range: CustomRange): number | null {
  const from = dayMs(range.from);
  const to = dayMs(range.to);
  if (from === null || to === null || to < from) return null;
  return Math.round((to - from) / DAY_MS) + 1;
}

/** The last 30 UTC days, today included. */
export function defaultCustomRange(now: number = Date.now()): CustomRange {
  const today = Date.parse(`${utcDay(now)}T00:00:00.000Z`);
  return { from: utcDay(today - 29 * DAY_MS), to: utcDay(today) };
}

/** Why a custom range cannot be requested, or null when it can. */
export function customRangeError(range: CustomRange, now: number = Date.now()): string | null {
  const from = dayMs(range.from);
  const to = dayMs(range.to);
  if (from === null || to === null) return "Choose a start and an end date.";
  if (to < from) return "The end date is before the start date.";
  // The API ends a range at now, so a start after now leaves nothing to count.
  if (from > now) return "The start date is in the future.";
  const days = Math.round((to - from) / DAY_MS) + 1;
  if (days > MAX_CUSTOM_RANGE_DAYS) return `A custom range is at most ${MAX_CUSTOM_RANGE_DAYS} days; this one is ${days}.`;
  return null;
}

/**
 * The query for rankings and performance: `window_days` for a rolling window,
 * or `from`/`to` for a custom range. Custom dates are whole UTC days with the
 * end day included, so the API's exclusive `to` is the midnight after it (the
 * API holds it at now). Null when the custom range is invalid, so nothing is
 * requested for it.
 */
export function buildMarketQuery(
  window: MarketWindow,
  custom: CustomRange,
  filters: { category?: string | null; county?: string | null } = {},
  now: number = Date.now(),
): URLSearchParams | null {
  const params = new URLSearchParams();
  if (window === "custom") {
    const to = dayMs(custom.to);
    if (customRangeError(custom, now) || to === null) return null;
    params.set("from", custom.from);
    params.set("to", utcDay(to + DAY_MS));
  } else {
    params.set("window_days", window);
  }
  if (filters.category) params.set("category", filters.category);
  if (filters.county) params.set("county", filters.county);
  return params;
}

/**
 * Demand is measured over rolling windows ending now (7 to 180 days), so a
 * custom range sets only its length. The view says so beside the figures.
 */
export function demandWindowDays(window: MarketWindow, custom: CustomRange): number {
  const days = window === "custom" ? rangeDays(custom) ?? 30 : Number(window);
  return Math.min(180, Math.max(7, days));
}

export function windowLabel(window: MarketWindow, custom: CustomRange): string {
  if (window === "custom") return `${custom.from} to ${custom.to} (UTC)`;
  return window === "1" ? "last 24 hours" : `last ${window} days`;
}

/**
 * Category or county choices for the ranking filters: the labels the API
 * matches on, without the placeholder it shows for an empty value (no listing
 * has the category "Uncategorised", so filtering on it would always be empty).
 */
export function filterOptions(labels: Array<string | null | undefined>, placeholder: string): string[] {
  const unique = new Set<string>();
  for (const label of labels) {
    const value = label?.trim();
    if (value && value !== placeholder) unique.add(value);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

/**
 * One CSV row per ranked listing, in rank order. A stage the API did not send
 * stays an empty cell rather than becoming a zero it never measured.
 */
export function rankingCsvRows(rows: MarketListingRow[], ranking: RankingKey): CsvRow[] {
  return rows.map((row, index) => ({
    rank: index + 1,
    ranking,
    listing_id: row.listing_id,
    name: row.name,
    category: row.category,
    county: row.county,
    seller_id: row.seller_id,
    viewers: row.viewers,
    savers: row.savers,
    likers: row.likers,
    contacters: row.contacters,
    negotiators: row.negotiators,
    deal_buyers: row.deal_buyers,
    completed_buyers: row.completed_buyers,
    view_to_save_pct: row.view_to_save_pct,
    view_to_contact_pct: row.view_to_contact_pct,
    contact_to_deal_pct: row.contact_to_deal_pct,
    score: row.score,
    previous_score: row.previous_score,
    score_change: row.delta,
    growth_pct: row.growth_pct,
  }));
}

export function rankingCsvFilename(ranking: RankingKey, window: MarketWindow, custom: CustomRange, now: number = Date.now()): string {
  const span = window === "custom" ? `${custom.from}-to-${custom.to}` : `${window === "1" ? "24h" : `${window}d`}-to-${utcDay(now)}`;
  return `broka-listings-${ranking}-${span}.csv`;
}

/** A score as the API computed it: whole numbers plain, fractional weights to one decimal. */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? value.toLocaleString("en-KE") : value.toFixed(1);
}

/** "views 5 · saves 4": what each stage added to a listing's score. */
export function scoreBreakdown(breakdown: Record<string, number> | undefined): string {
  if (!breakdown) return "";
  return Object.entries(breakdown)
    .filter(([, points]) => points > 0)
    .map(([stage, points]) => `${stage} ${points}`)
    .join(" · ");
}
