import { z } from "zod";

const nullableString = z.string().nullable();
const isoDate = nullableString;
const money = z.number();

export const AdminSummarySchema = z.object({
  users: z.number().int().nonnegative(),
  listings: z.number().int().nonnegative(),
  deals: z.number().int().nonnegative(),
  commission_earned_kes: money.nonnegative(),
  disputes: z.number().int().nonnegative(),
  flagged_users: z.number().int().nonnegative(),
});

export const AdminUserSchema = z.object({
  id: z.string(), name: z.string(), email: nullableString, phone: nullableString,
  is_admin: z.boolean(), is_verified: z.boolean(), trust_score: z.number(), trust_band: z.string(),
  is_flagged: z.boolean(), completed_deals: z.number().int().nonnegative(), rating: z.number().nullable(), created_at: isoDate,
});
export const AdminUsersSchema = z.array(AdminUserSchema);

export const AdminActionResultSchema = z.object({
  ok: z.boolean().optional(), user_id: z.string(), trust_score: z.number().optional(), trust_band: z.string().optional(),
});

export const AiSavingsSchema = z.object({
  classification_calls_avoided_by_prefilter: z.number().int().nonnegative(),
  classification_calls_avoided_by_cache: z.number().int().nonnegative(),
  classification_calls_made: z.number().int().nonnegative(),
  classification_requests_total: z.number().int().nonnegative(),
  avoided_fraction: z.number().min(0).max(1),
});

export const LedgerIntegritySchema = z.object({
  total_credits_kes: money, total_debits_kes: money, balanced: z.boolean(), discrepancy_kes: money.nonnegative(),
  negative_escrow_deals: z.array(z.object({ deal_id: z.string(), escrow_balance_kes: money })), escrow_integrity_ok: z.boolean(),
});

export const AuditLogSchema = z.object({
  id: z.string(), actor_id: z.string(), action: z.string(), resource_type: z.string(), resource_id: z.string(),
  detail: z.string(), ip_address: nullableString, created_at: isoDate,
});
export const AuditLogsSchema = z.array(AuditLogSchema);

export const FraudEventSchema = z.object({
  id: z.string(), user_id: z.string(), reason: z.string(), triggered_by: z.string(), trust_score_at_flag: z.number(),
  reviewed_by_admin: nullableString, resolved: z.boolean(), created_at: isoDate,
});
export const FraudEventsSchema = z.array(FraudEventSchema);

export const TransactionSchema = z.object({
  id: z.string(), deal_id: z.string(), buyer_id: z.string(), phone: nullableString, amount: money,
  mpesa_receipt: nullableString, status: z.string(), created_at: isoDate,
});
export const TransactionsSchema = z.array(TransactionSchema);

export const WorkflowVersionsSchema = z.object({ current_version: z.string(), versions: z.unknown() });
export const EventMetricsSchema = z.object({ total_events: z.number().int().nonnegative(), by_type: z.record(z.string(), z.number().int().nonnegative()), registered_handlers: z.number().int().nonnegative() });
export const EventCatalogSchema = z.object({ total_event_types: z.number().int().nonnegative(), by_domain: z.record(z.string(), z.array(z.string())) });

export const EconfirmDiagnosticsSchema = z.object({
  configured: z.boolean(), base_url: z.string(), call: z.string(), ok: z.boolean(), response: z.unknown().optional(),
  error: z.string().optional(), status_code: z.number().optional(), message: z.string().optional(), provider_detail: z.unknown().optional(),
}).passthrough();

export const ClientIpDiagnosticsSchema = z.object({
  resolved: nullableString, source: z.string(), peer: nullableString,
  headers: z.record(z.string(), nullableString),
  config: z.object({ client_ip_header: nullableString, trusted_proxy_hops: z.number().int().nonnegative(), storefront_key_set: z.boolean() }),
});

export const HealthSchema = z.object({ status: z.literal("healthy"), version: z.string() });

export const AdminResourceSchemas = {
  summary: AdminSummarySchema, users: AdminUsersSchema, aiSavings: AiSavingsSchema, ledgerIntegrity: LedgerIntegritySchema,
  auditLogs: AuditLogsSchema, fraudEvents: FraudEventsSchema, transactions: TransactionsSchema, workflowVersions: WorkflowVersionsSchema,
  eventMetrics: EventMetricsSchema, eventCatalog: EventCatalogSchema, econfirmDiagnostics: EconfirmDiagnosticsSchema, clientIpDiagnostics: ClientIpDiagnosticsSchema, health: HealthSchema,
} as const;

export type AdminResourcePayloads = { [K in keyof typeof AdminResourceSchemas]: z.infer<(typeof AdminResourceSchemas)[K]> };

export function parseAdminResource<K extends keyof typeof AdminResourceSchemas>(resource: K, payload: unknown): AdminResourcePayloads[K] {
  return AdminResourceSchemas[resource].parse(payload) as AdminResourcePayloads[K];
}

export const AuthMeSchema = z.object({
  id: z.string(), name: z.string(), email: nullableString, phone: nullableString, is_admin: z.literal(true), account_type: z.string(),
  is_verified: z.boolean(), trust_score: z.number(), trust_band: z.string(), is_flagged: z.boolean(), created_at: isoDate,
}).passthrough();

export const TokenEnvelopeSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1).optional(), token_type: z.literal("bearer"), user_id: z.string().optional() }).passthrough();
