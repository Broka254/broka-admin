import { z } from "zod";

// GET /admin/operations (backend api/core/operations.py). Sections use the
// Command Center's metric shape (command_center.metric): a figure the
// backend cannot measure has available=false and its reason, and is never
// drawn as zero. Declared here rather than imported from schemas.ts, which
// imports this module for its registry.

const count = z.number().nonnegative();
const nullableNumber = z.number().nullable();

export const OpsMetricSchema = z.object({
  key: z.string(), label: z.string(), kind: z.string(), unit: z.string(), good: z.string(),
  value: nullableNumber, previous: nullableNumber, delta: nullableNumber, change_pct: nullableNumber,
  definition: z.string(), caption: z.string().nullable(), href: z.string().nullable(),
  available: z.boolean(), unavailable_reason: z.string().nullable(),
});
export type OpsMetric = z.infer<typeof OpsMetricSchema>;
const point = z.object({ t: z.string(), v: z.number().nullable() });

const EndpointSchema = z.object({
  route: z.string(), requests: count, server_errors: count, client_errors: count,
  error_rate: nullableNumber, avg_ms: nullableNumber, p95_ms: nullableNumber, max_ms: nullableNumber,
}).passthrough();
export type OperationsEndpoint = z.infer<typeof EndpointSchema>;

const LoopSchema = z.object({
  name: z.string(), label: z.string(), interval_seconds: z.number().nullable(),
  status: z.enum(["ok", "stale", "no_pass", "unknown"]),
  alive_at: z.string().nullable(), last_pass_finished_at: z.string().nullable(),
  last_pass_age_seconds: z.number().nullable(), last_pass_ms: z.number().nullable(),
  passes: count, failures: count,
  failing_tasks: z.array(z.object({ task: z.string(), count: count })),
}).passthrough();
export type OperationsLoop = z.infer<typeof LoopSchema>;

export const OperationsSectionSchema = z.object({
  key: z.string(),
  title: z.string(),
  metrics: z.array(OpsMetricSchema),
  endpoints: z.object({
    busiest: z.array(EndpointSchema), slowest: z.array(EndpointSchema), failing: z.array(EndpointSchema),
    note: z.string().nullable().optional(),
  }).optional(),
  unavailable_by_kind: z.record(z.string(), z.number()).optional(),
  live: z.record(z.string(), z.number().nullable()).optional(),
  live_note: z.string().optional(),
  providers: z.array(z.object({
    source: z.string(), success: count, failed: count, pending: count, success_pct: nullableNumber,
  }).passthrough()).optional(),
  errors: z.array(z.object({ source: z.string(), pattern: z.string(), count: count })).optional(),
  failure_codes: z.array(z.object({ code: z.string(), count: count })).optional(),
  outcomes: z.array(z.object({ outcome: z.string(), count: count, previous: count })).optional(),
  loops: z.array(LoopSchema).optional(),
  queues: z.array(z.object({
    name: z.string(), depth: z.number().nullable(), done: count, failed: count, dropped: count,
  })).optional(),
  item_failures: z.array(z.object({ item: z.string(), count: count })).optional(),
}).passthrough();
export type OperationsSection = z.infer<typeof OperationsSectionSchema>;

export const OperationsSchema = z.object({
  generated_at: z.string(),
  window: z.object({ from: z.string(), to: z.string(), hours: z.number(),
    previous_from: z.string(), previous_to: z.string() }).passthrough(),
  coverage: z.object({
    sampling_started_at: z.string().nullable(), samples: count, instances_in_window: count,
    instances_reporting: count, sample_seconds: z.number(), truncated: z.boolean(), this_instance: z.string(),
  }).passthrough(),
  sections: z.array(OperationsSectionSchema),
  series: z.object({
    bucket_seconds: z.number(), requests: z.array(point), error_rate: z.array(point), p95_ms: z.array(point),
    push_failed: z.array(point), task_failures: z.array(point),
  }).passthrough(),
  live: z.object({ instance: z.string() }).passthrough(),
  not_instrumented: z.array(z.object({ metric: z.string(), reason: z.string() })),
  definitions: z.record(z.string(), z.string()),
}).passthrough();
export type Operations = z.infer<typeof OperationsSchema>;
