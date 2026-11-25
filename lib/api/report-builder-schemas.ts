import { z } from "zod";

// The report builder (backend api/core/report_builder.py, routes under
// /admin/report-builder). A figure that could not be measured carries
// available=false and the reason; its value is null and it is never drawn or
// exported as zero. Request schemas are strict: a field the backend does not
// name is refused here, before it leaves the dashboard.

const count = z.number().nonnegative();
const nullableNumber = z.number().nullable();
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const COMPARISONS = ["previous_period", "previous_year", "none"] as const;
export const GROUPINGS = ["none", "day", "week", "month", "category", "county"] as const;
export const VISUALIZATIONS = ["auto", "line", "bar", "table"] as const;
export const SCHEDULES = ["none", "daily", "weekly", "monthly", "custom"] as const;

export const ReportSpecSchema = z.object({
  title: z.string(),
  categories: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([]),
  date_from: z.string().nullable().optional(),
  date_to: z.string().nullable().optional(),
  last_days: z.number().nullable().optional(),
  comparison: z.enum(COMPARISONS),
  filters: z.object({ category: z.string().nullable().optional(), county: z.string().nullable().optional() }).default({}),
  group_by: z.enum(GROUPINGS),
  visualization: z.enum(VISUALIZATIONS),
}).passthrough();
export type ReportSpec = z.infer<typeof ReportSpecSchema>;

export const BuilderKpiSchema = z.object({
  key: z.string(), label: z.string(), category: z.string(), unit: z.string(), good: z.string(), kind: z.string(),
  value: nullableNumber, previous: nullableNumber, delta: nullableNumber, change_pct: nullableNumber,
  available: z.boolean(), unavailable_reason: z.string().nullable(), definition: z.string(), source: z.string(),
  filtered: z.boolean().default(false),
}).passthrough();
export type BuilderKpi = z.infer<typeof BuilderKpiSchema>;

const SeriesSchema = z.object({
  key: z.string(), label: z.string(), unit: z.string(), bucket: z.string(),
  visualization: z.enum(["line", "bar", "table"]),
  points: z.array(z.object({ t: z.string(), v: nullableNumber, days: z.number().optional() })),
  note: z.string().nullable().optional(),
}).passthrough();
export type BuilderSeries = z.infer<typeof SeriesSchema>;

const TableSchema = z.object({
  key: z.string(), title: z.string(),
  columns: z.array(z.object({ key: z.string(), label: z.string(), unit: z.string() })),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  chart_column: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  visualization: z.enum(["bar", "table"]),
}).passthrough();
export type BuilderTable = z.infer<typeof TableSchema>;

const AnomalySchema = z.object({
  metric: z.string(), label: z.string(), date: z.string(), direction: z.string(), observed: z.number(),
  baseline_median: z.number(), z_score: z.number(), pct: nullableNumber, severity: z.string(), impact: z.string(),
  source: z.string(), suggested_action: z.string(),
}).passthrough();

export const BuilderPayloadSchema = z.object({
  version: z.number(),
  title: z.string(),
  spec: ReportSpecSchema,
  period: z.object({ from: z.string(), to: z.string(), label: z.string(), days: z.number(),
    timezone: z.string(), in_progress: z.boolean() }),
  comparison: z.object({ kind: z.string(), from: z.string(), to: z.string(), label: z.string() }).nullable(),
  generated_at: z.string(),
  data_as_of: z.string(),
  executive_summary: z.array(z.string()),
  kpis: z.array(BuilderKpiSchema),
  sections: z.array(z.object({ key: z.string(), title: z.string(), kpis: z.array(z.string()),
    series: z.array(z.string()) })),
  series: z.array(SeriesSchema),
  tables: z.array(TableSchema),
  changes: z.array(z.object({ key: z.string(), label: z.string(), unit: z.string(), value: z.number(),
    previous: z.number(), delta: z.number(), change_pct: nullableNumber,
    direction: z.enum(["better", "worse", "neutral"]) })),
  anomalies: z.object({ evaluated_days: z.number(), from: z.string().nullable().optional(),
    to: z.string().nullable().optional(), items: z.array(AnomalySchema), total: z.number().optional(),
    note: z.string().nullable().optional() }),
  observations: z.array(z.object({ text: z.string(), action: z.string().nullable(),
    evidence: z.array(z.object({ metric: z.string(), label: z.string(), value: nullableNumber,
      previous: nullableNumber, unit: z.string(), source: z.string() })) })),
  unavailable: z.array(z.object({ key: z.string(), label: z.string(), reason: z.string().nullable() })),
  filters: z.object({ category: z.string().nullable().optional(), county: z.string().nullable().optional(),
    applies_to: z.array(z.string()), note: z.string().nullable() }).passthrough(),
  definitions: z.record(z.string(), z.string()),
  sources: z.record(z.string(), z.string()),
  notes: z.array(z.string()),
}).passthrough();
export type BuilderPayload = z.infer<typeof BuilderPayloadSchema>;

export const RunMetaSchema = z.object({
  id: z.string(), definition_id: z.string().nullable(), title: z.string(),
  period_start: z.string(), period_end: z.string(), period_label: z.string().nullable(),
  comparison_start: z.string().nullable(), comparison_end: z.string().nullable(),
  trigger: z.enum(["manual", "schedule", "regenerate"]), regenerated_from: z.string().nullable(),
  generated_by: z.string(), generated_at: z.string(), status: z.enum(["ready", "failed"]),
  error: z.string().nullable(), measured: count, metrics: count,
  delivery: z.array(z.object({ user_id: z.string(), status: z.string(), failure: z.string().nullable() })).default([]),
}).passthrough();
export type RunMeta = z.infer<typeof RunMetaSchema>;

export const RunDetailSchema = RunMetaSchema.extend({
  spec: ReportSpecSchema.or(z.record(z.string(), z.unknown())),
  payload: BuilderPayloadSchema.nullable(),
});
export type RunDetail = z.infer<typeof RunDetailSchema>;

export const RunListSchema = z.object({
  items: z.array(RunMetaSchema), total: count, limit: count, offset: count, generated_at: z.string(),
});
export type RunList = z.infer<typeof RunListSchema>;

export const PreviewSchema = z.object({
  id: z.null(), stored: z.literal(false), title: z.string(), spec: ReportSpecSchema, payload: BuilderPayloadSchema,
});
export type Preview = z.infer<typeof PreviewSchema>;

export const DefinitionSchema = z.object({
  id: z.string(), name: z.string(), description: z.string().nullable(), spec: ReportSpecSchema,
  schedule: z.enum(SCHEDULES), schedule_every_days: z.number().nullable(), schedule_hour_utc: z.number(),
  schedule_weekday: z.number().nullable(), schedule_day: z.number().nullable(),
  recipients: z.array(z.string()), enabled: z.boolean(), next_run_at: z.string().nullable(),
  last_run_at: z.string().nullable(), last_run_id: z.string().nullable(), last_status: z.string().nullable(),
  last_error: z.string().nullable(), created_by: z.string(), created_at: z.string(),
  updated_by: z.string().nullable(), updated_at: z.string(), version: z.number(),
}).passthrough();
export type Definition = z.infer<typeof DefinitionSchema>;

export const DefinitionListSchema = z.object({
  items: z.array(DefinitionSchema), total: count, generated_at: z.string(),
});

export const DefinitionDeletedSchema = z.object({ id: z.string(), deleted: z.literal(true) });

export const CatalogSchema = z.object({
  categories: z.array(z.object({ key: z.string(), label: z.string(), description: z.string(),
    metrics: z.array(z.string()) })),
  metrics: z.array(z.object({ key: z.string(), label: z.string(), category: z.string(), unit: z.string(),
    good: z.string(), kind: z.string(), definition: z.string(), source: z.string(),
    filters: z.array(z.string()), series: z.boolean() })),
  comparisons: z.array(z.object({ key: z.enum(COMPARISONS), label: z.string() })),
  groupings: z.array(z.object({ key: z.enum(GROUPINGS), label: z.string() })),
  visualizations: z.array(z.object({ key: z.enum(VISUALIZATIONS), label: z.string() })),
  limits: z.object({ max_range_days: z.number(), timezone: z.string() }),
  definitions: z.array(z.string()),
  filter_options: z.object({ category: z.array(z.string()), county: z.array(z.string()) }),
  email: z.object({
    configured: z.boolean(), can_send: z.boolean(),
    recipients: z.array(z.object({ id: z.string(), name: z.string().nullable(), email_hint: z.string().nullable() })),
    note: z.string(),
  }),
}).passthrough();
export type Catalog = z.infer<typeof CatalogSchema>;

// ── Requests ────────────────────────────────────────────────────────────────

export const SpecInSchema = z.object({
  title: z.string().trim().min(1).max(120),
  categories: z.array(z.string().max(40)).max(9).optional(),
  metrics: z.array(z.string().max(60)).max(80).optional(),
  date_from: isoDay.nullable().optional(),
  date_to: isoDay.nullable().optional(),
  last_days: z.number().int().min(1).max(366).nullable().optional(),
  comparison: z.enum(COMPARISONS).optional(),
  filters: z.object({ category: z.string().max(100).nullable().optional(),
    county: z.string().max(100).nullable().optional() }).strict().optional(),
  group_by: z.enum(GROUPINGS).optional(),
  visualization: z.enum(VISUALIZATIONS).optional(),
}).strict();
export type SpecIn = z.infer<typeof SpecInSchema>;

export const RunInSchema = z.object({
  spec: SpecInSchema,
  definition_id: z.string().max(36).nullable().optional(),
}).strict();

const scheduleFields = {
  schedule: z.enum(SCHEDULES).optional(),
  schedule_every_days: z.number().int().min(2).max(90).nullable().optional(),
  schedule_hour_utc: z.number().int().min(0).max(23).optional(),
  schedule_weekday: z.number().int().min(0).max(6).nullable().optional(),
  schedule_day: z.number().int().min(1).max(28).nullable().optional(),
  recipients: z.array(z.string().max(64)).max(10).optional(),
  enabled: z.boolean().optional(),
};

export const DefinitionInSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  spec: SpecInSchema,
  ...scheduleFields,
}).strict();
export type DefinitionIn = z.infer<typeof DefinitionInSchema>;

export const DefinitionPatchSchema = z.object({
  expected_version: z.number().int().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  spec: SpecInSchema.optional(),
  ...scheduleFields,
}).strict();
export type DefinitionPatch = z.infer<typeof DefinitionPatchSchema>;
