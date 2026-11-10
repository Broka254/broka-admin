import { z } from "zod";

// Contracts for the founder-intelligence, report and complaint-triage
// endpoints (backend: api/core/intelligence.py, api/core/insights.py,
// api/core/admin_reports.py, api/domains/feedback/router.py). Registered in
// AdminResourceSchemas so the proxy validates every payload before the
// browser sees it. Enumerations the backend may grow (signals, categories,
// insight areas) are plain strings: a new value must render as "unknown",
// not turn the page into a 502.

const num = z.number();
const int = z.number().int();
const count = z.number().int().nonnegative();
const maybeNum = z.number().nullable();
const maybeStr = z.string().nullable();
const stringMap = z.record(z.string(), z.string());
const countMap = z.record(z.string(), z.number());

export const MetricSchema = z.object({
  current: num,
  previous: maybeNum,
  change_pct: maybeNum,
});
export type Metric = z.infer<typeof MetricSchema>;

export const LiquidityCohortSchema = z.object({
  cohort_from: maybeStr,
  cohort_to: maybeStr,
  eligible: count,
  with_buyer_contact: count,
  rate_pct: maybeNum,
  median_hours_to_first_contact: maybeNum,
});
export type LiquidityCohort = z.infer<typeof LiquidityCohortSchema>;

export const ReplySummarySchema = z.object({
  eligible: count,
  replied_24h: count,
  rate_pct: maybeNum,
  median_reply_minutes: maybeNum,
});

export const RevenueTotalsSchema = z.object({
  income_minor: num,
  costs_minor: num,
  estimated_costs_minor: num.default(0),
  profit_minor: num,
  streams: z.array(z.object({ key: z.string(), label: z.string(), amount_minor: num, count: num })).default([]),
});
export type RevenueTotals = z.infer<typeof RevenueTotalsSchema>;

export const RepeatReportedUserSchema = z.object({
  user_id: z.string(),
  name: maybeStr.optional(),
  complaints_90d: count,
});

export const ComplaintsOverviewSchema = z.object({
  open: count,
  open_feedback: count.default(0),
  open_by_severity: countMap.default({}),
  unanswered: count,
  sla_breached: count,
  sla_breached_urgent: count.default(0),
  oldest_unanswered_hours: maybeNum,
  filed: MetricSchema,
  feedback_filed: count.default(0),
  by_category: countMap.default({}),
  median_response_hours_90d: maybeNum,
  repeat_reported_users: z.array(RepeatReportedUserSchema).default([]),
  sla_hours: countMap.default({}),
});
export type ComplaintsOverview = z.infer<typeof ComplaintsOverviewSchema>;

export const TargetSchema = z.object({
  key: z.string(),
  label: z.string(),
  target: num,
  actual: num,
  unit: z.string(),
  progress_pct: maybeNum,
  met: z.boolean(),
});
export type Target = z.infer<typeof TargetSchema>;

export const BreakEvenSchema = z.object({
  fixed_monthly_cost_minor: num,
  income_30d_minor: num,
  costs_30d_minor: num,
  net_30d_minor: num,
  coverage_pct: maybeNum,
  gap_minor: num,
});
export type BreakEven = z.infer<typeof BreakEvenSchema>;

export const PulseSchema = z.object({
  generated_at: z.string(),
  window: z.object({
    from: z.string(), to: z.string(), previous_from: z.string(), previous_to: z.string(), days: num,
  }),
  metrics: z.record(z.string(), MetricSchema),
  liquidity: z.object({ target_pct: num, current: LiquidityCohortSchema, previous: LiquidityCohortSchema }),
  seller_response: z.object({
    target_pct: num, current: ReplySummarySchema, previous: ReplySummarySchema, truncated: z.boolean().default(false),
  }),
  balance: z.object({ active_buyers: count, active_sellers: count, buyers_per_seller: maybeNum }),
  complaints: ComplaintsOverviewSchema,
  revenue: z.object({ current: RevenueTotalsSchema, previous: RevenueTotalsSchema, trailing_30d: RevenueTotalsSchema }),
  targets: z.array(TargetSchema),
  break_even: BreakEvenSchema,
  monetisation: z.record(z.string(), z.boolean()).default({}),
  staff_excluded: z.boolean().default(true),
  definitions: stringMap.default({}),
});
export type Pulse = z.infer<typeof PulseSchema>;

export const InsightSeveritySchema = z.enum(["critical", "warning", "opportunity", "info", "positive"]);
export type InsightSeverity = z.infer<typeof InsightSeveritySchema>;

export const InsightSchema = z.object({
  id: z.string(),
  severity: InsightSeveritySchema,
  area: z.string(),
  title: z.string(),
  detail: z.string(),
  action: z.object({ label: z.string(), href: z.string() }).nullable(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});
export type Insight = z.infer<typeof InsightSchema>;

export const InsightCountsSchema = z.record(z.string(), count);

export const InsightsResponseSchema = z.object({
  generated_at: z.string(),
  window_days: int,
  insights: z.array(InsightSchema),
  counts: InsightCountsSchema,
});
export type InsightsResponse = z.infer<typeof InsightsResponseSchema>;

export const CategoryRowSchema = z.object({
  key: z.string(),
  label: z.string(),
  supply_live: count,
  new_listings: count,
  buyer_threads: count,
  interests: count,
  viewers: count,
  buy_agent_requests: count,
  buy_agent_unmatched: count,
  sold_out_reports: count,
  deals_agreed: count,
  demand: count,
  demand_per_listing: maybeNum,
  median_price_kes: maybeNum,
  liquidity: LiquidityCohortSchema,
  signal: z.string(),
  recommendation: z.string(),
});
export type CategoryRow = z.infer<typeof CategoryRowSchema>;

const WindowSchema = z.object({ from: z.string(), to: z.string(), days: num });

export const CategoriesResponseSchema = z.object({
  generated_at: z.string(),
  window: WindowSchema,
  categories: z.array(CategoryRowSchema),
  totals: countMap.default({}),
  signals: countMap.default({}),
  definitions: stringMap.default({}),
});
export type CategoriesResponse = z.infer<typeof CategoriesResponseSchema>;

export const CountyRowSchema = z.object({
  key: z.string(),
  label: z.string(),
  supply_live: count,
  new_listings: count,
  buyer_threads: count,
  stores: count,
  threads_per_listing: maybeNum,
  liquidity: LiquidityCohortSchema,
});
export type CountyRow = z.infer<typeof CountyRowSchema>;

export const GeographyResponseSchema = z.object({
  generated_at: z.string(),
  window: WindowSchema,
  counties: z.array(CountyRowSchema),
  definitions: stringMap.default({}),
});
export type GeographyResponse = z.infer<typeof GeographyResponseSchema>;

export const FunnelStepSchema = z.object({
  key: z.string(),
  label: z.string(),
  count: count,
  pct_of_start: maybeNum,
  pct_of_previous: maybeNum,
});
export type FunnelStep = z.infer<typeof FunnelStepSchema>;

export const FunnelResponseSchema = z.object({
  generated_at: z.string(),
  cohort: z.object({ from: z.string(), to: z.string(), users: count }),
  seller_journey: z.array(FunnelStepSchema),
  buyer_journey: z.array(FunnelStepSchema),
  timing: z.object({
    median_hours_to_first_listing: maybeNum,
    median_hours_to_first_buyer_message: maybeNum,
  }),
  definitions: stringMap.default({}),
});
export type FunnelResponse = z.infer<typeof FunnelResponseSchema>;

export const CohortsResponseSchema = z.object({
  generated_at: z.string(),
  weeks: int,
  cohorts: z.array(z.object({ week_start: z.string(), size: count, retention_pct: z.array(maybeNum) })),
  truncated: z.boolean().default(false),
  definitions: stringMap.default({}),
});
export type CohortsResponse = z.infer<typeof CohortsResponseSchema>;

export const SellerRowSchema = z.object({
  seller_id: z.string(),
  threads: count,
  answered: count,
  waiting: count,
  oldest_wait_hours: maybeNum,
  items: z.array(z.string()).default([]),
  name: maybeStr.optional(),
  phone: maybeStr.optional(),
  trust_score: maybeNum.optional(),
  answered_pct: maybeNum,
});
export type SellerRow = z.infer<typeof SellerRowSchema>;

export const StaleListingSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: maybeStr,
  seller_id: z.string(),
  created_at: maybeStr,
  price: maybeNum,
  views: count,
  age_days: maybeNum,
});

export const SellersResponseSchema = z.object({
  generated_at: z.string(),
  lookback_days: count,
  waiting_total: count,
  sellers_with_waiting_buyers: count,
  waiting: z.array(SellerRowSchema),
  busiest: z.array(SellerRowSchema),
  stale_total: count,
  stale_listings: z.array(StaleListingSchema),
  definitions: stringMap.default({}),
});
export type SellersResponse = z.infer<typeof SellersResponseSchema>;

// ── Reports ─────────────────────────────────────────────────────────────────

export const ReportKindSchema = z.enum(["daily", "weekly", "monthly"]);
export type ReportKind = z.infer<typeof ReportKindSchema>;

export const ReportMetaSchema = z.object({
  id: z.string().nullable(),
  kind: ReportKindSchema,
  title: z.string(),
  headline: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  period_label: maybeStr.optional(),
  generated_at: z.string(),
  generated_by: z.string(),
  insight_counts: InsightCountsSchema.default({}),
});
export type ReportMeta = z.infer<typeof ReportMetaSchema>;

export const ReportListSchema = z.object({
  items: z.array(ReportMetaSchema),
  total: count,
  limit: count,
  offset: count,
  generated_at: z.string(),
  schedule: z.object({ enabled: z.boolean(), timezone: z.string(), kinds: z.array(z.string()) }).optional(),
});
export type ReportList = z.infer<typeof ReportListSchema>;

export const ReportKpiSchema = z.object({
  key: z.string(),
  label: z.string(),
  unit: z.string(),
  good_direction: z.string().default("up"),
  value: maybeNum,
  previous: maybeNum,
  change_pct: maybeNum,
});
export type ReportKpi = z.infer<typeof ReportKpiSchema>;

export const CategoryBriefSchema = z.object({
  key: z.string(),
  label: z.string(),
  demand: count,
  supply_live: count,
  new_listings: count.default(0),
  liquidity_pct: maybeNum,
  signal: z.string(),
});
export type CategoryBrief = z.infer<typeof CategoryBriefSchema>;

// Stored reports outlive the code that wrote them: everything beyond the
// headline is optional so an older payload still opens.
export const ReportPayloadSchema = z.object({
  version: z.number().optional(),
  kind: ReportKindSchema,
  title: z.string(),
  period: z.object({
    from: z.string(), to: z.string(), label: z.string(), timezone: z.string().default("EAT"),
    in_progress: z.boolean().default(false),
  }),
  headline: z.string(),
  summary: z.array(z.string()).default([]),
  kpis: z.array(ReportKpiSchema).default([]),
  insights: z.array(InsightSchema).default([]),
  insight_counts: InsightCountsSchema.default({}),
  targets: z.array(TargetSchema).default([]),
  break_even: BreakEvenSchema.optional(),
  complaints: ComplaintsOverviewSchema.optional(),
  revenue: RevenueTotalsSchema.optional(),
  categories: z.object({
    top_demand: z.array(CategoryBriefSchema).default([]),
    undersupplied: z.array(CategoryBriefSchema).default([]),
    oversupplied: z.array(CategoryBriefSchema).default([]),
  }).optional(),
  sellers: z.object({
    waiting_total: count,
    sellers_with_waiting_buyers: count,
    top_waiting: z.array(z.object({
      seller_id: z.string(), name: maybeStr.optional(), waiting: count, oldest_wait_hours: maybeNum,
    })).default([]),
    stale_total: count,
  }).optional(),
  generated_at: z.string(),
});
export type ReportPayload = z.infer<typeof ReportPayloadSchema>;

export const ReportDetailSchema = ReportMetaSchema.extend({
  stored: z.boolean(),
  payload: ReportPayloadSchema,
  markdown: z.string(),
});
export type ReportDetail = z.infer<typeof ReportDetailSchema>;

export const ReportGenerateInSchema = z.object({
  kind: ReportKindSchema,
  period_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
}).strict();
export type ReportGenerateIn = z.infer<typeof ReportGenerateInSchema>;

// ── Complaints & feedback triage ────────────────────────────────────────────

export const FeedbackStatusSchema = z.enum(["open", "acknowledged", "in_progress", "resolved", "closed"]);
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;

export const FeedbackReporterSchema = z.object({
  id: z.string(),
  name: maybeStr,
  phone: maybeStr,
  account_type: maybeStr,
  trust_score: num,
  is_flagged: z.boolean(),
  created_at: maybeStr,
});

export const FeedbackAdminItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  category: z.string(),
  severity: z.string(),
  subject: z.string(),
  body: z.string(),
  related_listing_id: maybeStr,
  related_deal_id: maybeStr,
  related_user_id: maybeStr,
  status: z.string(),
  admin_response: maybeStr,
  responded_at: maybeStr,
  resolved_at: maybeStr,
  created_at: z.string(),
  updated_at: z.string(),
  user_id: z.string(),
  responded_by_id: maybeStr,
  reporter: FeedbackReporterSchema.nullable(),
  age_hours: num,
  sla_hours: num,
  sla_breached: z.boolean(),
  notified_devices: z.number().int().nullable().optional(),
});
export type FeedbackAdminItem = z.infer<typeof FeedbackAdminItemSchema>;

export const FeedbackPageSchema = z.object({
  items: z.array(FeedbackAdminItemSchema),
  total: count,
  limit: count,
  offset: count,
});
export type FeedbackPage = z.infer<typeof FeedbackPageSchema>;

export const FeedbackStatsSchema = z.object({
  total: count,
  by_status: countMap,
  by_kind: countMap,
  open_complaints: count,
  generated_at: z.string(),
  by_category: countMap.default({}),
  by_severity: countMap.default({}),
  open_by_severity: countMap.default({}),
  unanswered: count.default(0),
  sla_breached: count.default(0),
  sla_breached_urgent: count.default(0),
  oldest_unanswered_hours: maybeNum.default(null),
  filed_last_7d: count.default(0),
  filed_previous_7d: count.default(0),
  median_response_hours_90d: maybeNum.default(null),
  repeat_reported_users: z.array(RepeatReportedUserSchema).default([]),
  sla_hours: countMap.default({}),
});
export type FeedbackStats = z.infer<typeof FeedbackStatsSchema>;

export const FeedbackDetailSchema = FeedbackAdminItemSchema.extend({
  related_listing: z.object({
    id: z.string(), name: maybeStr, status: maybeStr, category: maybeStr, price: maybeNum, seller_id: maybeStr,
  }).nullable(),
  related_user: z.object({
    id: z.string(), name: maybeStr, phone: maybeStr, trust_score: num, is_flagged: z.boolean(),
    complaints_against_total: count, complaints_against_open: count,
  }).nullable(),
  related_deal: z.object({
    id: z.string(), status: maybeStr, agreed_price: maybeNum, seller_id: maybeStr, buyer_id: maybeStr, created_at: maybeStr,
  }).nullable(),
  reporter_history: z.object({ submissions: count, complaints: count }),
  timeline: z.array(z.object({ at: maybeStr, actor_id: z.string(), action: z.string(), status: maybeStr })),
});
export type FeedbackDetail = z.infer<typeof FeedbackDetailSchema>;

export const FeedbackTriageInSchema = z.object({
  status: FeedbackStatusSchema.optional(),
  admin_response: z.string().trim().min(1, "A reply cannot be blank").max(5000).optional(),
}).strict().refine((value) => value.status !== undefined || value.admin_response !== undefined, {
  message: "Choose a status or write a reply",
});
export type FeedbackTriageIn = z.infer<typeof FeedbackTriageInSchema>;
