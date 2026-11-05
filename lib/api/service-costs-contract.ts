import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const moneyMinor = count;
const currency = z.string().regex(/^[A-Z]{3}$/);

export const ServiceCostEntrySchema = z.object({
  id: z.string().min(1),
  service_key: z.string().min(1),
  service_name: z.string().nullable(),
  description: z.string(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_minor: moneyMinor,
  currency,
  source: z.enum(["provider_invoice", "usage_estimate", "manual"]),
  note: z.string().nullable(),
  recorded_by: z.string().nullable(),
  created_at: z.string(),
}).superRefine((entry, ctx) => {
  if (entry.period_end <= entry.period_start) ctx.addIssue({ code: "custom", path: ["period_end"], message: "period_end must be after period_start" });
});
export type ServiceCostEntry = z.infer<typeof ServiceCostEntrySchema>;

export const ServiceCostsDashboardSchema = z.object({
  generated_at: z.string(),
  period: z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  currencies: z.array(z.object({ code: currency, minor_unit_exponent: z.number().int().min(0).max(4) })),
  summary_by_currency: z.array(z.object({
    currency,
    actual_minor: moneyMinor,
    estimated_minor: moneyMinor,
    manual_minor: moneyMinor,
    maximum_estimate_minor: moneyMinor.nullable(),
  })),
  services: z.array(z.object({
    key: z.string().min(1), name: z.string(), category: z.string(), provider: z.string(),
    status: z.enum(["active", "inactive", "unknown"]),
    usage: z.object({
      quantity: z.number().nonnegative().nullable(), unit: z.string().min(1),
      success_count: count.nullable(), failed_count: count.nullable(),
      source: z.enum(["instrumented", "provider_report", "partial", "manual", "not_instrumented"]),
    }),
    cost: z.object({
      amount_minor: moneyMinor.nullable(), currency: currency.nullable(),
      source: z.enum(["provider_invoice", "usage_estimate", "manual", "mixed", "unpriced"]),
      confidence: z.enum(["high", "medium", "low", "unpriced"]),
      maximum_estimate_minor: moneyMinor.nullable(), note: z.string().nullable(),
    }).superRefine((cost, ctx) => {
      if ((cost.amount_minor === null) !== (cost.currency === null)) ctx.addIssue({ code: "custom", path: ["currency"], message: "Amount and currency must both be present or null" });
      if (cost.source === "unpriced" && cost.amount_minor !== null) ctx.addIssue({ code: "custom", path: ["amount_minor"], message: "Unpriced costs must be null" });
    }),
    last_activity_at: z.string().nullable(),
  })),
  entries: z.array(ServiceCostEntrySchema),
});
export type ServiceCostsDashboard = z.infer<typeof ServiceCostsDashboardSchema>;

export const ServiceCostEntryCreateInSchema = z.object({
  service_key: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(160),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_minor: moneyMinor.positive(),
  currency,
  note: z.string().trim().max(1000).nullable().optional(),
}).strict().superRefine((entry, ctx) => {
  if (entry.period_end <= entry.period_start) ctx.addIssue({ code: "custom", path: ["period_end"], message: "period_end must be after period_start" });
});
export type ServiceCostEntryCreateInput = z.infer<typeof ServiceCostEntryCreateInSchema>;
export const ServiceCostEntryCreateResponseSchema = z.object({ entry: ServiceCostEntrySchema });
