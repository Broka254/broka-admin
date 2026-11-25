import { z } from "zod";

// Listing and marketplace intelligence (GET /admin/intelligence/market/*).
// Backend: api/core/market_intel.py and api/core/market_models.py. Objects are
// passthrough so additive backend fields never 502 the page.
//
// Fields added with the negotiation and completion stages (negotiators,
// deal_buyers, the attention lists, the buyer funnel...) are optional, never
// defaulted: an API from before them still validates, and the view can tell
// "not sent" (upgrade the API) from "sent and empty" (nothing qualified).
// A missing figure shows as a dash, not as a zero it never measured.

const count = z.number().nonnegative();
const nullablePct = z.number().nullable();
const iso = z.string().nullable();
const windowSchema = z.object({
  from: z.string(), to: z.string(), days: z.number(),
  previous_from: z.string().nullable().optional(), previous_to: z.string().nullable().optional(),
}).passthrough();
const notInstrumented = z.array(z.object({ metric: z.string(), reason: z.string() }));

export const MarketListingRowSchema = z.object({
  listing_id: z.string(), name: z.string(), category: z.string().nullable(), county: z.string().nullable(),
  seller_id: z.string(), viewers: count, savers: count, likers: count, contacters: count,
  negotiators: count.optional(), deal_buyers: count.optional(), completed_buyers: count.optional(),
  view_to_save_pct: nullablePct, view_to_contact_pct: nullablePct, contact_to_deal_pct: nullablePct.optional(),
  note: z.string().optional(),
  score: z.number().optional(), breakdown: z.record(z.string(), z.number()).optional(),
  previous_score: z.number().optional(), delta: z.number().optional(), growth_pct: nullablePct.optional(),
  // Needs-the-seller rows: buyers whose first message has had no reply.
  waiting_buyers: count.optional(), oldest_wait_hours: z.number().optional(),
}).passthrough();
export type MarketListingRow = z.infer<typeof MarketListingRowSchema>;

const rows = z.array(MarketListingRowSchema);

export const MarketRankingsSchema = z.object({
  generated_at: iso, window: windowSchema, category: z.string().nullable(), county: z.string().nullable().optional(),
  truncated: z.boolean(), listings_engaged: count,
  weights: z.record(z.string(), z.number()).optional(), formula: z.string().optional(),
  rankings: z.object({
    viewed: rows, saved: rows, liked: rows, contacted: rows, trending: rows,
    negotiated: rows.optional(), converted: rows.optional(), growing: rows.optional(),
  }),
  conversion: z.object({
    benchmark: z.object({ median_contact_rate_pct: z.number(), median_viewers: z.number(), listings_compared: z.number() }).nullable(),
    popular_not_converting: rows, hidden_gems: rows,
    engaged_not_converting: rows.optional(), unusual_interest: rows.optional(),
    note: z.string().nullable(),
  }),
  attention: z.object({ losing_attention: rows, needs_seller: rows }).optional(),
  definitions: z.record(z.string(), z.string()),
}).passthrough();
export type MarketRankings = z.infer<typeof MarketRankingsSchema>;

export const MarketListingDetailSchema = z.object({
  generated_at: iso, window: windowSchema, truncated: z.boolean(),
  listing: z.object({ id: z.string(), name: z.string(), category: z.string().nullable(), county: z.string().nullable(),
    seller_id: z.string(), seller_name: z.string().nullable().optional(), price: z.number(), status: z.string(),
    created_at: iso, age_days: z.number().nullable(), lifetime_views_counter: z.number() }).passthrough(),
  totals: MarketListingRowSchema,
  funnel: z.object({ viewers: count, savers_or_likers: count, contacters: count, negotiators: count.optional(),
    deals_agreed: count, deals_completed: count.optional() }),
  deals_by_status: z.record(z.string(), z.number()),
  daily: z.array(z.object({ date: z.string(), views: count, saves: count, likes: count, contacts: count,
    negotiations: count.optional(), deals: count.optional(), completed: count.optional() })),
  snapshots: z.array(z.object({ date: z.string(), views: z.number().nullable(), likes: z.number().nullable(),
    interested_buyers: z.number().nullable(), sell_probability: z.number().nullable() })),
  category_position: z.object({ listings_compared: count, viewers_rank: z.number(), median_contact_rate_pct: nullablePct }),
  definitions: z.record(z.string(), z.string()),
}).passthrough();
export type MarketListingDetail = z.infer<typeof MarketListingDetailSchema>;

export const MarketSellerRowSchema = z.object({
  seller_id: z.string(), name: z.string().nullable().optional(), listings_engaged: count, viewers: count,
  savers: count, contacters: count, negotiators: count.optional(), contact_rate_pct: nullablePct,
  deals_agreed: count, deals_completed: count.optional(),
  viewers_previous: count.optional(), contacters_previous: count.optional(), contacters_change_pct: nullablePct.optional(),
  live_listings: count.optional(), avg_first_reply_minutes: z.number().nullable().optional(),
}).passthrough();
export type MarketSellerRow = z.infer<typeof MarketSellerRowSchema>;

export const MarketBuyerRowSchema = z.object({
  buyer_id: z.string(), name: z.string().nullable().optional(), listings_viewed: count, listings_saved: count,
  listings_contacted: count, listings_negotiated: count.optional(), deals_agreed: count, deals_completed: count.optional(),
}).passthrough();
export type MarketBuyerRow = z.infer<typeof MarketBuyerRowSchema>;

export const MarketPerformanceSchema = z.object({
  generated_at: iso, window: windowSchema, truncated: z.boolean(),
  response_time_truncated: z.boolean().optional(),
  sellers: z.object({ total: count, top: z.array(MarketSellerRowSchema) }),
  buyers: z.object({ total: count, browsers_without_contact: count, top: z.array(MarketBuyerRowSchema) }),
  buyer_funnel: z.array(z.object({ key: z.string(), label: z.string(), buyers: count, pct_of_viewed: nullablePct })).optional(),
  not_instrumented: notInstrumented.optional(),
  definitions: z.record(z.string(), z.string()),
}).passthrough();
export type MarketPerformance = z.infer<typeof MarketPerformanceSchema>;

// Demand and supply by category and county against the window before
// (GET /admin/intelligence/market/demand). Live supply is the state now: only
// flows (demand, new listings, buyer conversations, deals) have a "previous".
export const MarketDemandCategorySchema = z.object({
  key: z.string(), label: z.string(), signal: z.string(), recommendation: z.string().nullable(),
  supply_live: count, demand: count, demand_previous: count, demand_change_pct: nullablePct,
  demand_per_listing: z.number().nullable(), buyer_threads: count, interests: count, buy_agent_requests: count,
  new_listings: count, new_listings_previous: count, deals_agreed: count, deals_agreed_previous: count,
  median_price_kes: z.number().nullable(),
}).passthrough();
export type MarketDemandCategory = z.infer<typeof MarketDemandCategorySchema>;

export const MarketDemandCountySchema = z.object({
  key: z.string(), label: z.string(), supply_live: count, stores: count,
  buyer_threads: count, buyer_threads_previous: count, buyer_threads_change_pct: nullablePct,
  new_listings: count, new_listings_previous: count, threads_per_listing: z.number().nullable(),
}).passthrough();
export type MarketDemandCounty = z.infer<typeof MarketDemandCountySchema>;

export const MarketDemandSchema = z.object({
  generated_at: iso, window: windowSchema,
  categories: z.array(MarketDemandCategorySchema),
  growth: z.object({ rising: z.array(z.string()), falling: z.array(z.string()) }),
  counties: z.array(MarketDemandCountySchema),
  definitions: z.record(z.string(), z.string()),
}).passthrough();
export type MarketDemand = z.infer<typeof MarketDemandSchema>;

const dayValue = z.object({ date: z.string(), value: z.number() });
export const MarketAnomalySchema = z.object({
  metric: z.string(), label: z.string(), date: z.string(), direction: z.enum(["drop", "spike"]),
  observed: z.number(),
  baseline: z.object({ method: z.string(), weeks: z.number(), median: z.number(), mad: z.number(), scale: z.number(),
    values: z.array(dayValue) }),
  deviation: z.object({ absolute: z.number(), pct: z.number().nullable(), z_score: z.number() }),
  impact: z.string(),
  evidence: z.object({ source: z.string(), observed_day: dayValue, baseline_days: z.array(dayValue) }),
  suggested_action: z.string(), severity: z.enum(["high", "medium"]), auto_action: z.string(),
}).passthrough();
export type MarketAnomaly = z.infer<typeof MarketAnomalySchema>;

export const MarketAnomaliesSchema = z.object({
  generated_at: iso, evaluated_day: z.string(), baseline_weeks: z.number(),
  thresholds: z.record(z.string(), z.number()),
  anomalies: z.array(MarketAnomalySchema),
  checked: z.array(z.object({ key: z.string(), label: z.string(), observed: z.number(),
    baseline_median: z.number(), z_score: z.number(), anomaly: z.boolean() })),
  not_instrumented: z.array(z.object({ metric: z.string(), reason: z.string() })),
  definitions: z.record(z.string(), z.string()),
}).passthrough();
export type MarketAnomalies = z.infer<typeof MarketAnomaliesSchema>;

export const MarketScanResultSchema = z.object({
  evaluated_day: z.string(), anomalies: count, alerts_created: count, alerts_existing: count,
}).passthrough();
export type MarketScanResult = z.infer<typeof MarketScanResultSchema>;

export const MarketModelsSchema = z.object({
  generated_at: iso,
  forecasts: z.array(z.object({
    metric: z.string(), label: z.string(), validated: z.boolean(), withheld_reason: z.string().nullable(),
    backtest: z.object({ days: z.number(), actual_total: z.number(), forecast_total: z.number(),
      wape: z.number().nullable(), naive_wape: z.number().nullable() }),
    forecast: z.array(z.object({ date: z.string(), expected: z.number(), low: z.number(), high: z.number() })),
  })),
  churn: z.object({
    method: z.string(), validated: z.boolean(), truncated: z.boolean(), rule: z.string(), at_risk_total: count,
    backtest: z.object({ flagged: count, went_quiet: count, precision: z.number().nullable(),
      base_rate: z.number().nullable(), validated: z.boolean() }),
    at_risk: z.array(z.object({ user_id: z.string(), name: z.string().nullable(),
      active_days_prior_14d: count, active_days_last_14d: count })),
  }).passthrough(),
  supply: z.object({ method: z.string(), rule: z.string(), gaps: z.array(z.object({
    category: z.string(), demand_30d: count, weekly_demand: count, live_listings: count,
    suggested_new_listings: count, signal: z.string() })) }),
  payments: z.object({ method: z.string(), status: z.enum(["insufficient_data", "rising", "stable"]),
    prior_failure_rate: z.number().nullable(), recent_failure_rate: z.number().nullable(), projection: z.string(),
    weeks: z.array(z.object({ week_start: z.string(), success: count, failed: count, failure_rate: z.number().nullable() })) }).passthrough(),
  recommendations: z.array(z.object({
    id: z.string(), priority: z.string(), title: z.string(), action: z.string(),
    evidence: z.array(z.object({ label: z.string(), value: z.union([z.number(), z.string()]).nullable(), source: z.string() })),
  })),
  definitions: z.record(z.string(), z.string()),
}).passthrough();
export type MarketModels = z.infer<typeof MarketModelsSchema>;
