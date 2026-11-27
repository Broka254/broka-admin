import { describe, expect, it } from "vitest";

import { AdminResourceSchemas, parseAdminResource } from "@/lib/api/schemas";
import {
  toUtcIso,
  ZenoBriefingSchema,
  ZenoChatRequestSchema,
  ZenoChatResponseSchema,
  ZenoConversationDetailSchema,
  ZenoConversationListSchema,
  ZenoDeleteResultSchema,
  ZenoEvidenceSchema,
  ZenoStatusSchema,
  ZenoTurnMetadataSchema,
} from "@/lib/api/jarvis-schemas";

import {
  briefingFixture,
  chatResponseFixture,
  CONVERSATION_ID,
  conversationDetailFixture,
  conversationListFixture,
  conversationSummaryFixture,
  evidenceFixture,
  statusFixture,
  unavailableEvidenceFixture,
} from "./fixtures/jarvis";

describe("UTC datetimes", () => {
  it("reads a naive backend timestamp as UTC rather than local time", () => {
    expect(toUtcIso("2026-11-27T10:00:00")).toBe("2026-11-27T10:00:00.000Z");
  });

  it("keeps microsecond precision readable and normalises an explicit offset to UTC", () => {
    expect(toUtcIso("2026-11-27T10:00:00.123456")).toBe("2026-11-27T10:00:00.123Z");
    expect(toUtcIso("2026-11-27T10:00:00+03:00")).toBe("2026-11-27T07:00:00.000Z");
  });

  it("refuses a value that is not a datetime at all", () => {
    expect(ZenoEvidenceSchema.safeParse(evidenceFixture({ generated_at: "27 Nov 2026" })).success).toBe(false);
  });
});

describe("evidence", () => {
  it("accepts a measured figure and carries its values through unchanged", () => {
    const parsed = ZenoEvidenceSchema.parse(evidenceFixture());
    expect(parsed.value).toBe(41.2);
    expect(parsed.previous_value).toBe(58);
    expect(parsed.generated_at).toBe("2026-11-27T10:00:00.250Z");
    expect(parsed.period.start).toBe("2026-11-20T10:00:00.000Z");
  });

  it("accepts an unavailable metric with null value, previous value and reason", () => {
    const parsed = ZenoEvidenceSchema.parse(unavailableEvidenceFixture());
    expect(parsed.available).toBe(false);
    expect(parsed.value).toBeNull();
    expect(parsed.previous_value).toBeNull();
    expect(parsed.unavailable_reason).toMatch(/cannot be measured/);
  });

  it("refuses a key the backend does not define", () => {
    expect(ZenoEvidenceSchema.safeParse({ ...evidenceFixture(), extra: 1 }).success).toBe(false);
  });

  it("refuses a missing value key rather than treating it as absent data", () => {
    const withoutValue: Record<string, unknown> = { ...evidenceFixture() };
    delete withoutValue.value;
    expect(ZenoEvidenceSchema.safeParse(withoutValue).success).toBe(false);
  });

  it("refuses a confidence level outside the backend's five states", () => {
    expect(ZenoEvidenceSchema.safeParse(evidenceFixture({ confidence: "verified" })).success).toBe(false);
  });

  it("accepts a null period bound, which means the period is open at that end", () => {
    const parsed = ZenoEvidenceSchema.parse(
      evidenceFixture({ period: { start: null, end: "2026-11-27T10:00:00", timezone: "UTC" } }),
    );
    expect(parsed.period.start).toBeNull();
  });
});

describe("status", () => {
  it("parses readiness with names only, never credentials", () => {
    const parsed = ZenoStatusSchema.parse(statusFixture());
    expect(parsed.providers_configured).toEqual(["gemini", "groq"]);
    expect(parsed.tool_count).toBe(14);
  });

  it("keeps last_error_category null when there was no recent failure", () => {
    expect(ZenoStatusSchema.parse(statusFixture()).last_error_category).toBeNull();
  });

  it("refuses a missing readiness flag instead of assuming it", () => {
    const withoutFlag: Record<string, unknown> = { ...statusFixture() };
    delete withoutFlag.model_gateway_ready;
    expect(ZenoStatusSchema.safeParse(withoutFlag).success).toBe(false);
  });

  it("refuses a negative tool count", () => {
    expect(ZenoStatusSchema.safeParse(statusFixture({ tool_count: -1 })).success).toBe(false);
  });
});

describe("briefing", () => {
  it("parses findings, opportunities, investigations and freshness", () => {
    const parsed = ZenoBriefingSchema.parse(briefingFixture());
    expect(parsed.priority_findings.map((finding) => finding.severity)).toEqual(["high", "critical"]);
    expect(parsed.priority_findings[1].evidence_backed).toBe(false);
    expect(parsed.recommended_investigations).toEqual(["Seller replies are slowing"]);
    expect(parsed.data_freshness.ops_evaluated_day).toBe("2026-11-26");
    expect(parsed.cached).toBe(false);
  });

  it("accepts an empty briefing with no findings", () => {
    const parsed = ZenoBriefingSchema.parse(briefingFixture({ priority_findings: [], opportunities: [], evidence: [] }));
    expect(parsed.priority_findings).toEqual([]);
  });

  it("refuses a severity the backend does not emit", () => {
    const fixture = briefingFixture();
    fixture.priority_findings[0].severity = "urgent";
    expect(ZenoBriefingSchema.safeParse(fixture).success).toBe(false);
  });

  it("refuses an unexpected top-level key", () => {
    expect(ZenoBriefingSchema.safeParse({ ...briefingFixture(), forecast: [] }).success).toBe(false);
  });

  it("refuses a finding whose evidence list exceeds the backend limit", () => {
    const fixture = briefingFixture();
    fixture.priority_findings[0].evidence = Array.from({ length: 13 }, (_, index) => `ref.${index}`);
    expect(ZenoBriefingSchema.safeParse(fixture).success).toBe(false);
  });
});

describe("chat response", () => {
  it("parses findings with claims, causes, recommendations and investigation metadata", () => {
    const parsed = ZenoChatResponseSchema.parse(chatResponseFixture());
    expect(parsed.findings[0].claims[0]).toMatchObject({ asserted_value: 41.2, derivation: "value" });
    expect(parsed.possible_causes[0].statement).toMatch(/holiday/);
    expect(parsed.investigation).toMatchObject({ synthesis: "model", provider: "gemini", latency_ms: 2140 });
    expect(parsed.generated_at).toBe("2026-11-27T10:05:00.000Z");
  });

  it("accepts a clarification answer with no evidence and no provider", () => {
    const parsed = ZenoChatResponseSchema.parse(
      chatResponseFixture({
        findings: [],
        evidence: [],
        investigation: { tools_used: [], tool_errors: [], provider: null, model: null, latency_ms: 4, synthesis: "clarify" },
      }),
    );
    expect(parsed.investigation.provider).toBeNull();
    expect(parsed.investigation.synthesis).toBe("clarify");
  });

  it("refuses a conversation id that is not the backend's UUID", () => {
    expect(ZenoChatResponseSchema.safeParse(chatResponseFixture({ conversation_id: "conv-1" })).success).toBe(false);
  });

  it("refuses an unknown synthesis mode", () => {
    const response = chatResponseFixture();
    expect(
      ZenoChatResponseSchema.safeParse({
        ...response,
        investigation: { ...response.investigation, synthesis: "improvised" },
      }).success,
    ).toBe(false);
  });

  it("refuses a claim derivation the backend does not compute", () => {
    const response = chatResponseFixture();
    response.findings[0].claims[0].derivation = "forecast";
    expect(ZenoChatResponseSchema.safeParse(response).success).toBe(false);
  });

  it("refuses an extra field inside the answer", () => {
    const response = chatResponseFixture();
    expect(
      ZenoChatResponseSchema.safeParse({ ...response, answer: { ...response.answer, chain_of_thought: "..." } }).success,
    ).toBe(false);
  });
});

describe("chat request", () => {
  it("trims the question and sends only the documented context", () => {
    const parsed = ZenoChatRequestSchema.parse({
      message: "  How did revenue move?  ",
      context: { period_days: 7 },
    });
    expect(parsed.message).toBe("How did revenue move?");
    expect(parsed.context).toEqual({ period_days: 7 });
  });

  it("refuses a question that is blank after trimming", () => {
    expect(ZenoChatRequestSchema.safeParse({ message: "   " }).success).toBe(false);
  });

  it("refuses a question over the 2,000 character limit", () => {
    expect(ZenoChatRequestSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
  });

  it("refuses an administrator id or any other field the backend does not accept", () => {
    expect(ZenoChatRequestSchema.safeParse({ message: "Hi", admin_id: "someone-else" }).success).toBe(false);
  });

  it("refuses a context period outside 1 to 90 days", () => {
    expect(ZenoChatRequestSchema.safeParse({ message: "Hi", context: { period_days: 91 } }).success).toBe(false);
  });

  it("refuses a context page that is not a dashboard path", () => {
    expect(ZenoChatRequestSchema.safeParse({ message: "Hi", context: { page: "https://example.com" } }).success).toBe(
      false,
    );
    expect(ZenoChatRequestSchema.safeParse({ message: "Hi", context: { page: "/market" } }).success).toBe(true);
  });

  it("refuses a conversation id that is not a UUID", () => {
    expect(ZenoChatRequestSchema.safeParse({ message: "Hi", conversation_id: "../../x" }).success).toBe(false);
  });
});

describe("conversations", () => {
  it("parses a page of summaries with the total and page window", () => {
    const parsed = ZenoConversationListSchema.parse(conversationListFixture());
    expect(parsed.conversations[0]).toMatchObject({ id: CONVERSATION_ID, turn_count: 2 });
    expect(parsed.total).toBe(1);
  });

  it("refuses a page size above the backend's 50", () => {
    expect(ZenoConversationListSchema.safeParse(conversationListFixture([], { limit: 51 })).success).toBe(false);
  });

  it("refuses a negative offset", () => {
    expect(ZenoConversationListSchema.safeParse(conversationListFixture([], { offset: -1 })).success).toBe(false);
  });

  it("parses turns in order and keeps each turn's evidence", () => {
    const parsed = ZenoConversationDetailSchema.parse(conversationDetailFixture());
    expect(parsed.turns.map((turn) => turn.role)).toEqual(["user", "assistant"]);
    expect(parsed.turns[1].evidence[0].metric_key).toBe("briefing.command_center.reply_rate");
  });

  it("refuses a turn role the backend does not store", () => {
    const detail = conversationDetailFixture();
    detail.turns[0].role = "system";
    expect(ZenoConversationDetailSchema.safeParse(detail).success).toBe(false);
  });

  it("refuses a summary with an unknown key", () => {
    expect(
      ZenoConversationDetailSchema.safeParse(
        conversationDetailFixture({ ...conversationSummaryFixture(), owner: "someone" }),
      ).success,
    ).toBe(false);
  });

  it("parses the deletion result and refuses a result that does not say deleted", () => {
    expect(ZenoDeleteResultSchema.parse({ deleted: true, id: CONVERSATION_ID })).toEqual({
      deleted: true,
      id: CONVERSATION_ID,
    });
    expect(ZenoDeleteResultSchema.safeParse({ deleted: false, id: CONVERSATION_ID }).success).toBe(false);
  });

  it("keeps turn metadata open for passthrough keys and reads only the known ones", () => {
    const parsed = ZenoTurnMetadataSchema.parse({ investigation: undefined, future_key: 1 });
    expect(parsed).toMatchObject({ future_key: 1 });
  });
});

describe("registry", () => {
  it("registers every Jarvis read so the proxy validates it", () => {
    expect(AdminResourceSchemas).toHaveProperty("zenoStatus");
    expect(AdminResourceSchemas).toHaveProperty("zenoBriefing");
    expect(AdminResourceSchemas).toHaveProperty("zenoConversations");
    expect(AdminResourceSchemas).toHaveProperty("zenoConversationDetail");
  });

  it("validates a registered Jarvis payload through the shared parser", () => {
    expect(parseAdminResource("zenoStatus", statusFixture()).enabled).toBe(true);
    expect(() => parseAdminResource("zenoStatus", { ...statusFixture(), unknown: true })).toThrow();
  });
});
