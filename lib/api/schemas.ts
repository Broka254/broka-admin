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

// ── Service Communications contracts ──────────────────────────────────────────

const communicationTimestamp = z.string().datetime({ offset: true });
const nullableCommunicationTimestamp = communicationTimestamp.nullable();
const communicationCount = z.number().int().nonnegative();

function statusCountMap<T extends string>(allowed: readonly T[]) {
  const allowedSet = new Set<string>(allowed);
  return z.record(z.string(), communicationCount).superRefine((value, context) => {
    for (const key of Object.keys(value)) {
      if (!allowedSet.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `Unsupported status key: ${key}`,
        });
      }
    }
  });
}

export const AudienceKindSchema = z.enum(["all", "buyers", "sellers", "store_owners", "user_ids"]);
export type AudienceKind = z.infer<typeof AudienceKindSchema>;

export const AudienceInSchema = z.object({
  kind: AudienceKindSchema.default("all"),
  user_ids: z.array(z.string().min(1).max(64)).max(5000).default([]),
}).refine(
  (data) => {
    if (data.kind === "user_ids") return data.user_ids.length > 0;
    return data.user_ids.length === 0;
  },
  { message: "user_ids audience requires at least one user id; other kinds must not specify user_ids" }
);
export type AudienceIn = z.infer<typeof AudienceInSchema>;

export const AudiencePreviewInSchema = z.object({
  audience: AudienceInSchema,
}).strict();
export type AudiencePreviewIn = z.infer<typeof AudiencePreviewInSchema>;

export const AudiencePreviewOutSchema = z.object({
  kind: AudienceKindSchema,
  count: communicationCount,
  max_audience: communicationCount,
  allowed: z.boolean(),
});
export type AudiencePreviewOut = z.infer<typeof AudiencePreviewOutSchema>;

export const CommunicationTypeSchema = z.enum(["announcement", "maintenance", "incident", "product_update"]);
export type CommunicationType = z.infer<typeof CommunicationTypeSchema>;

export const CommunicationSeveritySchema = z.enum(["low", "normal", "high", "critical"]);
export type CommunicationSeverity = z.infer<typeof CommunicationSeveritySchema>;

export const CommunicationChannelSchema = z.enum(["in_app", "push"]);
export type CommunicationChannel = z.infer<typeof CommunicationChannelSchema>;

export const CommunicationStatusSchema = z.enum([
  "draft", "scheduled", "publishing", "published", "completed", "cancelled", "failed",
]);
export type CommunicationStatus = z.infer<typeof CommunicationStatusSchema>;

export const RecipientStatusSchema = z.enum([
  "queued", "sending", "provider_accepted", "delivered", "failed", "retry_scheduled",
]);
export type RecipientStatus = z.infer<typeof RecipientStatusSchema>;

export const FailureCategorySchema = z.enum([
  "invalid_token",
  "push_not_configured",
  "provider_error",
  "provider_transient",
  "invalid_message",
  "provider_timeout",
  "provider_exception",
  "lease_check_failed",
  "claim_lost",
  "no_device",
  "retry_exhausted",
  "partial_failure",
  "communication_missing",
  "communication_expired",
]);
export type FailureCategory = z.infer<typeof FailureCategorySchema>;

export function isValidDeepLink(value: string | null | undefined): boolean {
  if (!value || value.trim() === "") return true;
  if (value.length > 512) return false;
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === "https:") {
      return url.hostname === "broka.co.ke" || url.hostname === "www.broka.co.ke";
    }
    if (url.protocol === "broka:") {
      const host = (url.hostname || url.host).toLowerCase();
      return ["app", "store", "listing", "deal", "communications"].includes(host);
    }
    return false;
  } catch {
    if (value.startsWith("broka://")) {
      const rest = value.slice("broka://".length).split("/")[0].split("?")[0].toLowerCase();
      return ["app", "store", "listing", "deal", "communications"].includes(rest);
    }
    return false;
  }
}

export const CommunicationCreateInSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160, "Title must not exceed 160 characters"),
  body: z.string().trim().min(1, "Body is required").max(10000, "Body must not exceed 10000 characters"),
  communication_type: CommunicationTypeSchema,
  severity: CommunicationSeveritySchema.default("normal"),
  audience: AudienceInSchema,
  channels: z.array(CommunicationChannelSchema).min(1, "At least one channel is required").max(2).refine(
    (channels) => channels.includes("in_app"),
    { message: "in_app channel is required; push is optional" }
  ),
  deep_link: z.string().max(512).nullable().optional().refine(
    (val) => isValidDeepLink(val),
    { message: "deep_link must be an https://broka.co.ke or broka:// URL (app, store, listing, deal, communications)" }
  ),
  expires_at: communicationTimestamp.nullable().optional(),
}).strict().refine(
  (data) => {
    if (data.channels.includes("push")) {
      const encoder = new TextEncoder();
      let size = encoder.encode(data.title).length + encoder.encode(data.body).length;
      if (data.deep_link) size += encoder.encode(data.deep_link).length;
      if (size > 3600) return false;
    }
    return true;
  },
  { message: "Push title, body and deep_link must fit within 3600 UTF-8 bytes; use in_app only for longer text" }
);
export type CommunicationCreateIn = z.infer<typeof CommunicationCreateInSchema>;

export const CommunicationUpdateInSchema = z.object({
  expected_version: z.number().int().min(1).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
  communication_type: CommunicationTypeSchema.optional(),
  severity: CommunicationSeveritySchema.optional(),
  audience: AudienceInSchema.optional(),
  channels: z.array(CommunicationChannelSchema).min(1).max(2).optional().refine(
    (channels) => !channels || channels.includes("in_app"),
    { message: "in_app channel is required; push is optional" }
  ),
  deep_link: z.string().max(512).nullable().optional().refine(
    (val) => isValidDeepLink(val),
    { message: "deep_link must be an https://broka.co.ke or broka:// URL" }
  ),
  expires_at: communicationTimestamp.nullable().optional(),
}).strict().refine(
  (data) => {
    const keys = Object.keys(data).filter((k) => k !== "expected_version" && data[k as keyof typeof data] !== undefined);
    return keys.length > 0;
  },
  { message: "At least one editable field is required" }
);
export type CommunicationUpdateIn = z.infer<typeof CommunicationUpdateInSchema>;

export const ScheduleInSchema = z.object({
  scheduled_at: communicationTimestamp,
}).strict();
export type ScheduleIn = z.infer<typeof ScheduleInSchema>;

export const ReasonInSchema = z.object({
  reason: z.string().max(500, "Reason must not exceed 500 characters").optional().nullable(),
}).strict();
export type ReasonIn = z.infer<typeof ReasonInSchema>;

export const RetryInSchema = z.object({
  recipient_ids: z.array(z.string().min(1)).min(1, "At least one recipient id is required").max(500).optional().nullable(),
}).strict();
export type RetryIn = z.infer<typeof RetryInSchema>;

export const CommunicationOutSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  communication_type: CommunicationTypeSchema,
  severity: CommunicationSeveritySchema,
  status: CommunicationStatusSchema,
  audience: AudienceInSchema,
  channels: z.array(CommunicationChannelSchema).min(1).max(2),
  audience_count: z.number().int().nonnegative().nullable(),
  deep_link: nullableString,
  created_by_id: z.string(),
  updated_by_id: nullableString,
  version: z.number().int().positive(),
  created_at: communicationTimestamp,
  updated_at: communicationTimestamp,
  scheduled_at: nullableCommunicationTimestamp,
  published_at: nullableCommunicationTimestamp,
  completed_at: nullableCommunicationTimestamp,
  cancelled_at: nullableCommunicationTimestamp,
  expires_at: nullableCommunicationTimestamp,
  push_available: z.boolean(),
  warnings: z.array(z.string()).default([]),
});
export type CommunicationOut = z.infer<typeof CommunicationOutSchema>;

export const CommunicationListSchema = z.object({
  items: z.array(CommunicationOutSchema),
  total: communicationCount,
  limit: z.number().int().positive().max(200),
  offset: communicationCount,
});
export type CommunicationList = z.infer<typeof CommunicationListSchema>;

export const DeliverySummaryOutSchema = z.object({
  total_recipients: communicationCount,
  read_count: communicationCount,
  by_status: statusCountMap(RecipientStatusSchema.options),
  devices_by_status: statusCountMap(RecipientStatusSchema.options),
  provider_accepted: communicationCount,
  confirmed_delivered: communicationCount,
  failed: communicationCount,
  retry_scheduled: communicationCount,
  pending: communicationCount,
});
export type DeliverySummaryOut = z.infer<typeof DeliverySummaryOutSchema>;

export const CommunicationDetailSchema = z.object({
  communication: CommunicationOutSchema,
  delivery: DeliverySummaryOutSchema,
});
export type CommunicationDetail = z.infer<typeof CommunicationDetailSchema>;

export const RecipientOutSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  status: RecipientStatusSchema,
  attempt_count: communicationCount,
  last_attempt_at: nullableCommunicationTimestamp,
  provider_message_id: nullableString,
  delivered_at: nullableCommunicationTimestamp,
  read_at: nullableCommunicationTimestamp,
  failure_category: FailureCategorySchema.nullable(),
  retry_eligible: z.boolean(),
  next_attempt_at: nullableCommunicationTimestamp,
});
export type RecipientOut = z.infer<typeof RecipientOutSchema>;

export const RecipientPageSchema = z.object({
  items: z.array(RecipientOutSchema),
  total: communicationCount,
  limit: z.number().int().positive().max(200),
  offset: communicationCount,
});
export type RecipientPage = z.infer<typeof RecipientPageSchema>;

export const CommunicationStatsSchema = z.object({
  communication_id: z.string(),
  status: CommunicationStatusSchema,
  audience_count: z.number().int().nonnegative().nullable(),
  delivery: DeliverySummaryOutSchema,
  generated_at: communicationTimestamp,
});
export type CommunicationStats = z.infer<typeof CommunicationStatsSchema>;

export const PublishOutSchema = z.object({
  communication: CommunicationOutSchema,
  accepted: z.boolean(),
});
export type PublishOut = z.infer<typeof PublishOutSchema>;

export const RetryOutSchema = z.object({
  retried: communicationCount,
  message: z.string(),
});
export type RetryOut = z.infer<typeof RetryOutSchema>;

const WorkerLastPassSchema = z.object({
  last_pass_at: nullableCommunicationTimestamp,
  last_pass_seconds: z.number().nonnegative(),
  communications_claimed: communicationCount,
  communications_published: communicationCount,
  recipients_resolved: communicationCount,
  recipients_claimed: communicationCount,
  messages_attempted: communicationCount,
  provider_accepted: communicationCount,
  confirmed_delivered: communicationCount,
  failures: communicationCount,
  retries_scheduled: communicationCount,
  retries_exhausted: communicationCount,
});

export const WorkerRuntimeSchema = z.object({
  mode: z.literal("database_scheduled_loop"),
  sweep_seconds: z.number().nonnegative(),
  claim_seconds: z.number().nonnegative(),
  recipient_batch: communicationCount,
  provider_concurrency: communicationCount,
  provider_timeout_seconds: z.number().nonnegative(),
  retention_days: communicationCount,
  last_pass: WorkerLastPassSchema,
});
export type WorkerRuntime = z.infer<typeof WorkerRuntimeSchema>;

export const WorkerDiagnosticsSchema = z.object({
  generated_at: communicationTimestamp,
  worker: WorkerRuntimeSchema,
  backlog: z.object({
    communications: statusCountMap(CommunicationStatusSchema.options),
    recipients: statusCountMap(RecipientStatusSchema.options),
    pending_recipients: communicationCount,
  }),
});
export type WorkerDiagnostics = z.infer<typeof WorkerDiagnosticsSchema>;

// ── Resource schema registry ──────────────────────────────────────────────────

export const AdminResourceSchemas = {
  summary: AdminSummarySchema, users: AdminUsersSchema, aiSavings: AiSavingsSchema, ledgerIntegrity: LedgerIntegritySchema,
  auditLogs: AuditLogsSchema, fraudEvents: FraudEventsSchema, transactions: TransactionsSchema, workflowVersions: WorkflowVersionsSchema,
  eventMetrics: EventMetricsSchema, eventCatalog: EventCatalogSchema, econfirmDiagnostics: EconfirmDiagnosticsSchema, clientIpDiagnostics: ClientIpDiagnosticsSchema, health: HealthSchema,
  opsSnapshot: OpsSnapshotSchema, deals: AdminDealsSchema, listings: AdminListingsSchema, stores: AdminStoresSchema,
  disputes: AdminDisputesSchema, payments: AdminPaymentsSchema, financeIntegrity: FinanceIntegritySchema,
  serviceHealth: ServiceHealthSchema, zenoActivity: ZenoActivitySchema, userDetail: AdminUserDetailSchema, dealDetail: AdminDealDetailSchema,
  communications: CommunicationListSchema, workerDiagnostics: WorkerDiagnosticsSchema, communicationDetail: CommunicationDetailSchema,
  communicationRecipients: RecipientPageSchema, communicationStats: CommunicationStatsSchema,
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
