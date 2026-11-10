import { describe, expect, it } from "vitest";

import {
  FeedbackAdminItemSchema,
  FeedbackDetailSchema,
  FeedbackStatsSchema,
  FeedbackTriageInSchema,
  InsightsResponseSchema,
  PulseSchema,
  ReportDetailSchema,
  ReportGenerateInSchema,
  ReportPayloadSchema,
} from "@/lib/api/intelligence-schemas";
import { parseAdminResource } from "@/lib/api/schemas";
import {
  feedbackDetailFixture,
  feedbackItemFixture,
  feedbackStatsFixture,
  insightsFixture,
  pulseFixture,
  reportDetailFixture,
} from "./fixtures/intelligence";

describe("founder intelligence contracts", () => {
  it("accepts the backend's pulse, insights, complaint and report payloads", () => {
    expect(PulseSchema.parse(pulseFixture).liquidity.current.rate_pct).toBe(45);
    expect(InsightsResponseSchema.parse(insightsFixture).insights).toHaveLength(4);
    expect(FeedbackAdminItemSchema.parse(feedbackItemFixture).sla_breached).toBe(true);
    expect(FeedbackDetailSchema.parse(feedbackDetailFixture).related_user?.complaints_against_open).toBe(2);
    expect(FeedbackStatsSchema.parse(feedbackStatsFixture).unanswered).toBe(2);
    expect(ReportDetailSchema.parse(reportDetailFixture).payload.kpis[0]?.key).toBe("liquidity_pct");
  });

  it("is wired into the proxy registry", () => {
    expect(parseAdminResource("intelligencePulse", pulseFixture).metrics.new_users?.current).toBe(42);
    expect(parseAdminResource("feedbackDetail", feedbackDetailFixture).reporter?.name).toBe("Wanjiru Reporter");
    expect(parseAdminResource("reportPreview", { ...reportDetailFixture, id: null, stored: false }).stored).toBe(false);
  });

  it("rejects an insight severity the dashboard cannot rank", () => {
    const bad = { ...insightsFixture, insights: [{ ...insightsFixture.insights[0], severity: "meh" }] };
    expect(InsightsResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("opens an older stored report that lacks the newer sections", () => {
    const old = ReportPayloadSchema.parse({
      kind: "daily",
      title: "Daily founder report · Mon 2 Nov 2026",
      period: { from: "2026-11-01T21:00:00Z", to: "2026-11-02T21:00:00Z", label: "Mon 2 Nov 2026" },
      headline: "Yesterday: 3 new users.",
      generated_at: "2026-11-02T21:05:00Z",
    });
    expect(old.kpis).toEqual([]);
    expect(old.period.timezone).toBe("EAT");
    expect(old.categories).toBeUndefined();
  });

  it("only lets a status and/or a real reply through triage", () => {
    expect(FeedbackTriageInSchema.safeParse({}).success).toBe(false);
    expect(FeedbackTriageInSchema.safeParse({ admin_response: "   " }).success).toBe(false);
    expect(FeedbackTriageInSchema.safeParse({ status: "done" }).success).toBe(false);
    expect(FeedbackTriageInSchema.safeParse({ status: "resolved", user_id: "someone" }).success).toBe(false);
    expect(FeedbackTriageInSchema.safeParse({ admin_response: "x".repeat(5001) }).success).toBe(false);
    expect(FeedbackTriageInSchema.parse({ status: "in_progress" })).toEqual({ status: "in_progress" });
    expect(FeedbackTriageInSchema.parse({ admin_response: "  On it  " })).toEqual({ admin_response: "On it" });
  });

  it("only generates reports for a kind and a calendar day", () => {
    expect(ReportGenerateInSchema.safeParse({ kind: "weekly" }).success).toBe(true);
    expect(ReportGenerateInSchema.safeParse({ kind: "weekly", period_date: "2026-11-03" }).success).toBe(true);
    expect(ReportGenerateInSchema.safeParse({ kind: "yearly" }).success).toBe(false);
    expect(ReportGenerateInSchema.safeParse({ kind: "weekly", period_date: "3/11/2026" }).success).toBe(false);
    expect(ReportGenerateInSchema.safeParse({ kind: "weekly", replace: false }).success).toBe(false);
  });
});
