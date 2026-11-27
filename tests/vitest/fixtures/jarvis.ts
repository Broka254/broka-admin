// Payloads shaped like the backend's serialised Jarvis responses
// (broka/backend/api/domains/admin_zeno/schemas.py). Datetimes are naive UTC,
// as FastAPI emits them, and optional backend fields are explicit nulls.

export const CONVERSATION_ID = "5f0e6b1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b";
export const OTHER_CONVERSATION_ID = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
export const TURN_USER_ID = "7a8b9c0d-1e2f-4a3b-9c8d-7e6f5a4b3c2d";
export const TURN_ASSISTANT_ID = "1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7081";

export function evidenceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "ev.briefing.command_center.reply_rate",
    metric_key: "briefing.command_center.reply_rate",
    label: "Seller reply rate",
    value: 41.2,
    unit: "percentage",
    previous_value: 58,
    period: { start: "2026-11-20T10:00:00", end: "2026-11-27T10:00:00", timezone: "UTC" },
    source: "api.core.command_center",
    definition: "Share of buyer messages answered by a seller within 24 hours.",
    generated_at: "2026-11-27T10:00:00.250000",
    available: true,
    unavailable_reason: null,
    confidence: "measured",
    href: "/market",
    ...overrides,
  };
}

export function unavailableEvidenceFixture(overrides: Record<string, unknown> = {}) {
  return evidenceFixture({
    id: "ev.briefing.command_center.refund_rate",
    metric_key: "briefing.command_center.refund_rate",
    label: "Refund rate",
    value: null,
    previous_value: null,
    unit: "percentage",
    available: false,
    unavailable_reason: "No completed deals in this window, so a rate cannot be measured.",
    confidence: "unavailable",
    href: null,
    ...overrides,
  });
}

export function statusFixture(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    model_gateway_ready: true,
    providers_configured: ["gemini", "groq"],
    tool_registry_ready: true,
    tool_count: 14,
    last_error_category: null,
    generated_at: "2026-11-27T10:00:00",
    ...overrides,
  };
}

export function briefingFixture(overrides: Record<string, unknown> = {}) {
  return {
    headline: "1 critical and 1 high-priority signal in the last 7 days",
    executive_summary: "Seller replies are slowing. One payment alert is open.",
    priority_findings: [
      {
        id: "decision:0",
        severity: "high",
        title: "Seller replies are slowing",
        detail: "Replies inside 24 hours fell below target.",
        area: "marketplace",
        evidence: ["briefing.command_center.reply_rate"],
        evidence_backed: true,
        href: "/market",
      },
      {
        id: "alert:7",
        severity: "critical",
        title: "Payment webhook failures",
        detail: "Repeated failures from the payment provider.",
        area: "operations",
        evidence: [],
        evidence_backed: false,
        href: null,
      },
    ],
    opportunities: [
      { title: "Electronics demand is outpacing supply", detail: "Searches exceed active listings.", href: "/market" },
    ],
    recommended_investigations: ["Seller replies are slowing"],
    evidence: [evidenceFixture(), unavailableEvidenceFixture()],
    period: { start: "2026-11-20T10:00:00", end: "2026-11-27T10:00:00", timezone: "UTC" },
    generated_at: "2026-11-27T10:00:00",
    data_freshness: {
      period_start: "2026-11-20T10:00:00Z",
      period_end: "2026-11-27T10:00:00Z",
      activity_coverage_started_on: "2026-10-01",
      ops_evaluated_day: "2026-11-26",
      market_evaluated_day: "2026-11-26",
      cached_for_seconds: 60,
    },
    limitations: ["Operational anomalies judge one completed day."],
    cached: false,
    ...overrides,
  };
}

export function chatResponseFixture(overrides: Record<string, unknown> = {}) {
  return {
    conversation_id: CONVERSATION_ID,
    answer: {
      headline: "Seller reply rate fell to 41.2%",
      summary: "Sellers answered 41.2% of buyer messages within 24 hours, down from 58%.",
    },
    findings: [
      {
        statement: "The seller reply rate is down 17 points against the previous window.",
        evidence: ["briefing.command_center.reply_rate"],
        claims: [
          {
            metric_key: "briefing.command_center.reply_rate",
            asserted_value: 41.2,
            unit: "percentage",
            evidence_reference: "briefing.command_center.reply_rate",
            derivation: "value",
            confidence: "measured",
          },
        ],
        confidence: "measured",
      },
    ],
    possible_causes: [{ statement: "A holiday period may have slowed seller responses." }],
    recommendations: [
      {
        action: "Review unanswered buyer messages",
        rationale: "Most of the gap is in unanswered threads.",
        page: "/complaints",
      },
    ],
    evidence: [evidenceFixture()],
    limitations: ["The window covers seven days."],
    related_pages: ["/market", "/zeno"],
    suggested_questions: ["Which sellers are slowest to reply?"],
    generated_at: "2026-11-27T10:05:00",
    investigation: {
      tools_used: ["marketplace.reply_rate"],
      tool_errors: [],
      provider: "gemini",
      model: "gemini-2.5-flash",
      latency_ms: 2140,
      synthesis: "model",
    },
    ...overrides,
  };
}

export function conversationSummaryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: CONVERSATION_ID,
    title: "Why did seller replies fall?",
    created_at: "2026-11-27T10:00:00",
    updated_at: "2026-11-27T10:05:00",
    expires_at: "2026-12-27T10:05:00",
    turn_count: 2,
    ...overrides,
  };
}

export function conversationListFixture(
  conversations: Array<Record<string, unknown>> = [conversationSummaryFixture()],
  overrides: Record<string, unknown> = {},
) {
  return { conversations, total: conversations.length, limit: 20, offset: 0, ...overrides };
}

export function turnsFixture() {
  return [
    {
      id: TURN_USER_ID,
      role: "user",
      content: "Why did seller replies fall?",
      evidence: [],
      metadata: { context: { period_days: 7 } },
      created_at: "2026-11-27T10:00:00",
    },
    {
      id: TURN_ASSISTANT_ID,
      role: "assistant",
      content:
        "Seller reply rate fell to 41.2%\n\nSellers answered 41.2% of buyer messages within 24 hours, down from 58%.",
      evidence: [evidenceFixture()],
      metadata: {
        investigation: {
          tools_used: ["marketplace.reply_rate"],
          tool_errors: [],
          provider: "gemini",
          model: "gemini-2.5-flash",
          latency_ms: 2140,
          synthesis: "model",
        },
        limitations: ["The window covers seven days."],
      },
      created_at: "2026-11-27T10:05:00",
    },
  ];
}

export function conversationDetailFixture(
  summary: Record<string, unknown> = conversationSummaryFixture(),
  turns: Array<Record<string, unknown>> = turnsFixture(),
  overrides: Record<string, unknown> = {},
) {
  return { conversation: summary, turns, limit: 40, offset: 0, ...overrides };
}
