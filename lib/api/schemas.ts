import { z } from "zod";

const nullableString = z.string().nullable();
const isoDate = nullableString;
const money = z.number();
const countMap = z.record(z.string(), z.number().int().nonnegative());
const nullableMoney = z.number().nullable();

// The three status-filtered counts are optional so the dashboard keeps
// working against backends that predate them; the UI labels them as
// requiring the backend upgrade instead of hiding the gap.
export const AdminSummarySchema = z.object({
  users: z.number().int().nonnegative(),
  listings: z.number().int().nonnegative(),
  listings_active: z.number().int().nonnegative().optional(),
  deals: z.number().int().nonnegative(),
  deals_released: z.number().int().nonnegative().optional(),
  commission_earned_kes: money.nonnegative(),
  disputes: z.number().int().nonnegative(),
  dispute_cases_active: z.number().int().nonnegative().optional(),
  flagged_users: z.number().int().nonnegative(),
});

export const AdminUserSchema = z.object({
  id: z.string(), name: z.string(), email: nullableString, phone: nullableString,
  is_admin: z.boolean(), is_verified: z.boolean(), trust_score: z.number(), trust_band: z.string(),
  is_flagged: z.boolean(), completed_deals: z.number().int().nonnegative(), rating: z.number().nullable(), created_at: isoDate,
});
export const AdminUsersSchema = z.array(AdminUserSchema);

export const OwnerStatsSchema = z.object({
  deals_as_seller: z.number().int().nonnegative(), deals_as_buyer: z.number().int().nonnegative(),
  released_deals: z.number().int().nonnegative(), refunded_deals: z.number().int().nonnegative(),
  disputed_deals: z.number().int().nonnegative(), open_fraud_events: z.number().int().nonnegative(),
});

export const AdminUserDetailSchema = z.object({
  user: z.object({
    id: z.string(), name: z.string(), email: nullableString, phone: nullableString,
    is_admin: z.boolean(), is_verified: z.boolean(), phone_verified: z.boolean(), email_verified: z.boolean(),
    account_type: nullableString, seller_tier: nullableString, is_premium: z.boolean(),
    trust_score: z.number(), trust_band: z.string(), is_flagged: z.boolean(),
    completed_deals: z.number().int().nonnegative(), rating: z.number().nullable(),
    last_seen: isoDate, created_at: isoDate,
  }),
  stats: OwnerStatsSchema,
  recent_deals: z.array(z.object({
    id: z.string(), listing_id: nullableString, seller_id: z.string(), buyer_id: z.string(),
    agreed_price: money, commission: money, status: nullableString, created_at: isoDate,
    delivery_confirmed_at: isoDate, released_at: isoDate, refunded_at: isoDate,
    refund_outcome: nullableString, refund_requested_at: isoDate, dispute_branch: nullableString, leak_flag: z.boolean(),
  })),
  fraud_events: z.array(z.object({
    id: z.string(), reason: z.string(), triggered_by: nullableString, trust_score_at_flag: z.number().nullable(),
    reviewed_by_admin: z.boolean(), resolved: z.boolean(), created_at: isoDate,
  })),
  recent_audit: z.array(z.object({
    id: z.string(), actor_id: z.string(), action: z.string(), resource_type: z.string(),
    resource_id: z.string(), detail: z.string(), created_at: isoDate,
  })),
  generated_at: isoDate,
});

export const AdminActionResultSchema = z.object({
  ok: z.boolean().optional(), changed: z.boolean().optional(), already_flagged: z.boolean().optional(),
  user_id: z.string().optional(), trust_score: z.number().optional(), trust_band: z.string().optional(),
  is_admin: z.boolean().optional(), id: z.string().optional(), resolved: z.boolean().optional(),
}).passthrough();
export type AdminActionResult = z.infer<typeof AdminActionResultSchema>;

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
  id: z.string(), user_id: z.string(), reason: z.string(), triggered_by: nullableString, trust_score_at_flag: z.number().nullable(),
  reviewed_by_admin: z.boolean(), resolved: z.boolean(), created_at: isoDate,
});
export const FraudEventsSchema = z.array(FraudEventSchema);

export const TransactionSchema = z.object({
  id: z.string(), deal_id: z.string(), buyer_id: z.string(), phone: nullableString, amount: money,
  mpesa_receipt: nullableString, status: z.string(), created_at: isoDate,
});
export const TransactionsSchema = z.array(TransactionSchema);

export const WorkflowVersionsSchema = z.object({ current_version: z.string(), versions: z.unknown() });
export const EventMetricsSchema = z.object({
  total_events: z.number().int().nonnegative(), by_type: countMap, registered_handlers: countMap,
  scope: z.literal("process_local").optional(), durability: z.literal("none").optional(),
});
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

// ── Operations surface (GET /admin/ops-*, read-only) ─────────────────────────

export const OpsSnapshotSchema = z.object({
  generated_at: isoDate, timezone: z.literal("UTC"), window_hours: z.number().int().positive(),
  definitions: z.record(z.string(), z.string()),
  users: z.object({
    total: z.number().int().nonnegative(), new_current: z.number().int().nonnegative(), new_previous: z.number().int().nonnegative(),
    flagged: z.number().int().nonnegative(), high_risk: z.number().int().nonnegative(), admins: z.number().int().nonnegative(),
  }),
  listings: z.object({
    total: z.number().int().nonnegative(), by_status: countMap, active: z.number().int().nonnegative(),
    created_current: z.number().int().nonnegative(), created_previous: z.number().int().nonnegative(),
  }),
  deals: z.object({
    total: z.number().int().nonnegative(), by_status: countMap,
    created_current: z.number().int().nonnegative(), created_previous: z.number().int().nonnegative(),
    released_current: z.number().int().nonnegative(), released_previous: z.number().int().nonnegative(),
  }),
  commission: z.object({
    released_total_kes: money, released_current_kes: money, released_previous_kes: money,
  }),
  disputes: z.object({
    legacy_total: z.number().int().nonnegative(), legacy_open: z.number().int().nonnegative(),
    cases_total: z.number().int().nonnegative(), cases_active: z.number().int().nonnegative(), cases_by_state: countMap,
  }),
  fraud: z.object({ events_total: z.number().int().nonnegative(), events_open: z.number().int().nonnegative() }),
  payments: z.object({
    mpesa: countMap, zetupay: countMap,
    zetupay_unfinished: z.number().int().nonnegative(), mpesa_pending: z.number().int().nonnegative(),
  }),
  escrow: z.object({
    by_status: countMap, open: z.number().int().nonnegative(), payout_failed: z.number().int().nonnegative(),
    release_pending: z.number().int().nonnegative(), completed: z.number().int().nonnegative(),
    awaiting_manual_refund: z.number().int().nonnegative(),
  }),
  media: z.object({ pending_total: z.number().int().nonnegative(), pending_by_kind: countMap }),
  ledger: z.object({
    balanced: z.boolean(), discrepancy_kes: money.nonnegative(),
    negative_escrow_deals: z.number().int().nonnegative(), escrow_held_kes: money,
  }),
});

export const DealItemSchema = z.object({
  id: z.string(), listing_id: nullableString, seller_id: z.string(), buyer_id: z.string(),
  agreed_price: money, commission: money, status: nullableString, created_at: isoDate,
  delivery_confirmed_at: isoDate, released_at: isoDate, refunded_at: isoDate,
  refund_outcome: nullableString, refund_requested_at: isoDate, dispute_branch: nullableString, leak_flag: z.boolean(),
});

export const AdminDealsSchema = z.object({
  items: z.array(DealItemSchema), total: z.number().int().nonnegative(),
  limit: z.number().int().positive(), offset: z.number().int().nonnegative(),
  status_counts: countMap, generated_at: isoDate,
});

export const AdminDealDetailSchema = z.object({
  deal: DealItemSchema,
  ledger_entries: z.array(z.object({
    id: z.string(), account: z.string(), direction: z.string(), amount_kes: money,
    description: nullableString, ref_id: nullableString, created_at: isoDate,
  })),
  external_escrows: z.array(z.object({
    id: z.string(), payment_no: z.number().nullable(), provider: z.string(), provider_transaction_id: nullableString,
    status: z.string(), provider_raw_status: nullableString, amount: money, currency: nullableString,
    merchant_commission_amount: nullableMoney, provider_fee_amount: nullableMoney, last_checked_at: isoDate,
    funding_initiated_at: isoDate, funded_at: isoDate, release_initiated_at: isoDate, released_at: isoDate,
    last_error: nullableString, created_at: isoDate,
  })),
  mpesa_transactions: z.array(z.object({
    id: z.string(), amount: money, mpesa_receipt: nullableString, status: nullableString, created_at: isoDate,
  })),
  dispute_cases: z.array(z.object({
    id: z.string(), state: nullableString, dispute_type: nullableString, branch: nullableString,
    rule_decision: nullableString, rule_decision_reason: nullableString, fund_action: nullableString,
    fund_amount: nullableMoney, resolved_by: nullableString, created_at: isoDate, closed_at: isoDate,
  })),
  generated_at: isoDate,
});

export const AdminListingItemSchema = z.object({
  id: z.string(), name: z.string(), seller_id: z.string(), store_id: nullableString, category: z.string(),
  price: money, status: nullableString, listing_type: nullableString, location_name: nullableString,
  views: z.number().int().nonnegative(), is_featured: z.boolean(), created_at: isoDate,
});
export const AdminListingsSchema = z.object({
  items: z.array(AdminListingItemSchema), total: z.number().int().nonnegative(),
  limit: z.number().int().positive(), offset: z.number().int().nonnegative(),
  status_counts: countMap, generated_at: isoDate,
});

export const AdminStoreItemSchema = z.object({
  id: z.string(), name: z.string(), slug: z.string(), owner_id: z.string(), category: nullableString,
  county: nullableString, is_active: z.boolean(), deleted_at: isoDate, created_at: isoDate,
});
export const AdminStoresSchema = z.object({
  items: z.array(AdminStoreItemSchema), total: z.number().int().nonnegative(),
  limit: z.number().int().positive(), offset: z.number().int().nonnegative(), generated_at: isoDate,
});

export const AdminDisputeItemSchema = z.object({
  id: z.string(), deal_id: nullableString, opener_id: nullableString, dispute_type: nullableString,
  branch: nullableString, state: nullableString, ai_recommendation: nullableString, rule_decision: nullableString,
  rule_decision_reason: nullableString, fund_action: nullableString, fund_amount: nullableMoney,
  resolved_by: nullableString, created_at: isoDate, updated_at: isoDate, closed_at: isoDate,
  age_hours: z.number().nullable(), deal_amount_kes: nullableMoney, deal_seller_id: nullableString, deal_buyer_id: nullableString,
});
export const AdminDisputesSchema = z.object({
  items: z.array(AdminDisputeItemSchema), total: z.number().int().nonnegative(),
  limit: z.number().int().positive(), offset: z.number().int().nonnegative(),
  state_counts: countMap, legacy: z.object({ total: z.number().int().nonnegative(), open: z.number().int().nonnegative() }),
  generated_at: isoDate,
});

export const AdminPaymentItemSchema = z.object({
  id: z.string(), source: z.enum(["mpesa", "zetupay"]), reference: nullableString, user_id: nullableString,
  deal_id: nullableString, purpose: nullableString, amount: money, status: nullableString, created_at: isoDate,
});
export const AdminPaymentsSchema = z.object({
  items: z.array(AdminPaymentItemSchema),
  counts: z.object({ mpesa: countMap, zetupay: countMap }),
  limit: z.number().int().positive(), generated_at: isoDate,
});

export const FinanceIntegritySchema = z.object({
  generated_at: isoDate,
  definitions: z.record(z.string(), z.string()),
  ledger: LedgerIntegritySchema,
  commission: z.object({ released_deals_kes: money, ledger_revenue_credits_kes: money, gap_kes: money }),
  released_deals_without_release_entries: z.object({
    count: z.number().int().nonnegative(),
    sample: z.array(z.object({ deal_id: z.string(), commission: money, released_at: isoDate })),
  }),
  released_deals_without_revenue_credit: z.object({
    count: z.number().int().nonnegative(),
    sample: z.array(z.object({ deal_id: z.string(), commission: money, released_at: isoDate })),
  }),
  escrow_held_kes: money,
  refund_payable_kes: money,
  awaiting_manual_refund: z.object({
    count: z.number().int().nonnegative(),
    sample: z.array(z.object({ deal_id: z.string(), agreed_price_kes: money, refund_outcome: nullableString, refund_requested_at: isoDate })),
  }),
  payments: z.object({ mpesa: countMap, zetupay: countMap }),
  econfirm: z.object({ by_status: countMap }),
});

export const ServiceHealthSchema = z.object({
  generated_at: isoDate,
  checks: z.array(z.object({
    name: z.string(), kind: z.string(), status: z.string(), detail: z.string(),
    latency_ms: z.number().nullable(), checked_at: isoDate,
  })),
  providers: z.array(z.object({
    name: z.string(), kind: z.literal("external_provider"), status: z.string(),
    probe: z.literal("not_run"), detail: z.string(),
  })),
  note: z.string(),
});

export const ZenoActivitySchema = z.object({
  generated_at: isoDate, window_hours: z.number().int().positive(),
  durable: z.object({
    source: z.string(),
    messages_total: z.number().int().nonnegative(), ai_relayed_total: z.number().int().nonnegative(),
    agent_initiated_total: z.number().int().nonnegative(), messages_current: z.number().int().nonnegative(),
    messages_previous: z.number().int().nonnegative(), ai_relayed_current: z.number().int().nonnegative(),
    ai_relayed_previous: z.number().int().nonnegative(), zeno_audit_events_total: z.number().int().nonnegative(),
    zeno_audit_events_current: z.number().int().nonnegative(), zeno_last_audit_at: isoDate,
    zeno_audit_actions: countMap,
  }),
  process_local: z.object({
    ai_savings: AiSavingsSchema, event_metrics_total: z.number().int().nonnegative(),
    event_metrics_by_type: countMap, scope: z.literal("process_local"), durability: z.literal("none"), note: z.string(),
  }),
  not_instrumented: z.array(z.object({ metric: z.string(), reason: z.string() })),
});

export const AdminResourceSchemas = {
  summary: AdminSummarySchema, users: AdminUsersSchema, aiSavings: AiSavingsSchema, ledgerIntegrity: LedgerIntegritySchema,
  auditLogs: AuditLogsSchema, fraudEvents: FraudEventsSchema, transactions: TransactionsSchema, workflowVersions: WorkflowVersionsSchema,
  eventMetrics: EventMetricsSchema, eventCatalog: EventCatalogSchema, econfirmDiagnostics: EconfirmDiagnosticsSchema, clientIpDiagnostics: ClientIpDiagnosticsSchema, health: HealthSchema,
  opsSnapshot: OpsSnapshotSchema, deals: AdminDealsSchema, listings: AdminListingsSchema, stores: AdminStoresSchema,
  disputes: AdminDisputesSchema, payments: AdminPaymentsSchema, financeIntegrity: FinanceIntegritySchema,
  serviceHealth: ServiceHealthSchema, zenoActivity: ZenoActivitySchema, userDetail: AdminUserDetailSchema, dealDetail: AdminDealDetailSchema,
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
