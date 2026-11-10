import { describe, expect, it } from "vitest";

import { buildFeedbackParams, complaintQueue } from "@/hooks/use-complaints";
import {
  changeTone,
  evidenceEntries,
  feedbackReference,
  formatChange,
  formatDuration,
  formatPctValue,
  formatUnitValue,
  isInternalHref,
  notificationOutcome,
  slaSummary,
} from "@/lib/intelligence";
import { reportFilename, reportKpiRows } from "@/lib/report-export";
import { frameAncestors } from "@/lib/security/frame-ancestors";
import { ReportDetailSchema } from "@/lib/api/intelligence-schemas";
import { reportDetailFixture } from "./fixtures/intelligence";

describe("intelligence formatting", () => {
  it("never shows a missing value as zero", () => {
    expect(formatPctValue(null)).toBe("—");
    expect(formatChange(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatUnitValue(null, "kes_minor")).toBe("—");
  });

  it("signs changes and colours them by the direction that helps", () => {
    expect(formatChange(12.04)).toBe("+12%");
    expect(formatChange(-40)).toBe("−40%");
    expect(formatChange(214.3)).toBe("+214%");
    expect(changeTone(20, "up")).toBe("success");
    expect(changeTone(20, "down")).toBe("danger");
    expect(changeTone(-5, "down")).toBe("success");
    expect(changeTone(0, "up")).toBe("neutral");
  });

  it("reads durations the way people say them", () => {
    expect(formatDuration(0.5)).toBe("30m");
    expect(formatDuration(5)).toBe("5h");
    expect(formatDuration(50)).toBe("2d 2h");
    expect(formatDuration(72)).toBe("3d");
    expect(formatUnitValue(250_000, "kes_minor")).toBe("KES 2,500");
    expect(formatUnitValue(45, "pct")).toBe("45%");
  });

  it("turns insight evidence into a few readable chips", () => {
    expect(evidenceEntries({ sla_breached: 2, oldest_unanswered_hours: 30.2, collected_minor: 150_000 })).toEqual([
      { key: "sla_breached", label: "Sla breached", value: "2" },
      { key: "oldest_unanswered_hours", label: "Oldest unanswered hours", value: "30h" },
      { key: "collected_minor", label: "Collected", value: "KES 1,500" },
    ]);
    expect(evidenceEntries({ listings: { current: 18, previous: 30, change_pct: -40 } })[0]?.value).toBe("18 · prev 30 · −40%");
    expect(evidenceEntries({ met: ["live_listings", "deals_agreed_30d"] })[0]?.value).toBe("Live listings, Deals agreed 30d");
    expect(evidenceEntries({ a: 1, b: 2, c: 3, d: 4, e: 5 })).toHaveLength(4);
    expect(evidenceEntries({ nothing: null, nested: { deep: { x: 1 } } })).toEqual([]);
  });

  it("only treats dashboard paths as internal links", () => {
    expect(isInternalHref("/complaints?queue=overdue")).toBe(true);
    expect(isInternalHref("//evil.example")).toBe(false);
    expect(isInternalHref("https://evil.example")).toBe(false);
    expect(isInternalHref("/\\evil.example")).toBe(false);
  });
});

describe("complaint deadlines", () => {
  const base = { kind: "complaint", status: "open", responded_at: null, sla_hours: 4, sla_breached: false };

  it("counts down to the first-reply deadline and says when it is missed", () => {
    expect(slaSummary({ ...base, age_hours: 1 })).toMatchObject({ label: "Reply due in 3h", overdue: false, tone: "neutral" });
    expect(slaSummary({ ...base, age_hours: 3.5 })).toMatchObject({ label: "Reply due in 30m", tone: "warning" });
    expect(slaSummary({ ...base, age_hours: 6, sla_breached: true })).toMatchObject({ label: "Overdue by 2h", overdue: true, tone: "danger" });
  });

  it("stops the clock once the team replies or the case closes", () => {
    expect(slaSummary({ ...base, age_hours: 6, responded_at: "2026-11-10T03:00:00Z" })).toMatchObject({ label: "Replied", overdue: false });
    expect(slaSummary({ ...base, age_hours: 60, status: "resolved" })).toMatchObject({ label: "Resolved", overdue: false });
    expect(slaSummary({ ...base, kind: "feedback", age_hours: 60 })).toMatchObject({ overdue: false });
  });

  it("matches the reference the app shows the reporter", () => {
    expect(feedbackReference("3f2a9c11-1111-4222-8333-444455556666")).toBe("#3F2A9C");
  });

  it("explains where a reply went", () => {
    expect(notificationOutcome(null)).toBeNull();
    expect(notificationOutcome(0)).toMatch(/No device was reachable/);
    expect(notificationOutcome(2)).toMatch(/Pushed to 2 devices/);
  });

  it("builds the queue query and drops values the backend would refuse", () => {
    const params = buildFeedbackParams({ queue: "overdue", kind: "complaint", severity: "urgent", category: "seller_conduct", search: "  #3F2A9C ", page: 3 });
    expect(Object.fromEntries(params)).toEqual({
      queue: "overdue", kind: "complaint", severity: "urgent", category: "seller_conduct", search: "#3F2A9C",
      sort: "priority", limit: "25", offset: "50",
    });
    const sanitised = Object.fromEntries(buildFeedbackParams({ queue: "nope", kind: "spam", severity: "extreme", category: "DROP TABLE", sort: "random" }));
    expect(sanitised).toEqual({ queue: "unanswered", sort: "priority", limit: "25", offset: "0" });
    expect(buildFeedbackParams({ queue: "all" }).has("queue")).toBe(false);
    expect(complaintQueue(null)).toBe("unanswered");
  });
});

describe("report exports", () => {
  const report = ReportDetailSchema.parse(reportDetailFixture);

  it("names files by kind and period, and marks a preview as to-date", () => {
    expect(reportFilename(report, "md")).toBe("broka-weekly-2026-11-03.md");
    expect(reportFilename({ ...report, stored: false }, "csv")).toBe("broka-weekly-2026-11-03-to-date.csv");
    expect(reportFilename({ kind: "daily", period_start: "not a date", stored: true }, "md")).toBe("broka-daily-period.md");
  });

  it("exports money in shillings, not cents", () => {
    const rows = reportKpiRows(report);
    expect(rows.find((row) => row.metric === "Income")).toMatchObject({ unit: "KES", value: 2500, previous: 1000, change_pct: 150 });
    expect(rows.find((row) => row.metric === "Complaints filed")).toMatchObject({ unit: "count", better_when: "down" });
  });
});

describe("frame-ancestors", () => {
  it("keeps today's behaviour when unset and accepts only source expressions", () => {
    expect(frameAncestors(undefined)).toBe("https:");
    expect(frameAncestors("'self' https://preview.example.com")).toBe("'self' https://preview.example.com");
    expect(frameAncestors("https://*.manus.space:443")).toBe("https://*.manus.space:443");
    expect(frameAncestors("'self'; script-src *")).toBe("'none'");
    expect(frameAncestors("'none' https://a.example")).toBe("'none'");
    expect(frameAncestors("http://insecure.example")).toBe("'none'");
  });
});
