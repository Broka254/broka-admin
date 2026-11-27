import { describe, expect, it } from "vitest";

import { ZenoEvidenceSchema } from "@/lib/api/jarvis-schemas";
import { dashboardLink } from "@/lib/jarvis/dashboard-links";
import {
  describeEvidence,
  describeValue,
  formatEvidenceNumber,
  formatUtc,
  freshnessRows,
  hasEarlierTurns,
  jarvisErrorKind,
  lastErrorLabel,
  splitStoredAnswer,
  STARTER_QUESTIONS,
  turnPageSpecs,
} from "@/lib/jarvis/presentation";

import { evidenceFixture, unavailableEvidenceFixture } from "./fixtures/jarvis";

function evidence(overrides: Record<string, unknown> = {}) {
  return ZenoEvidenceSchema.parse(evidenceFixture(overrides));
}

describe("unavailable and missing figures", () => {
  it("never shows an unavailable metric as a number, even if a value was sent", () => {
    const view = describeEvidence(evidence({ available: false, value: 0, confidence: "unavailable", unavailable_reason: "No sample." }));
    expect(view.state).toBe("unavailable");
    expect(view.valueText).toBeNull();
    expect(view.unavailableReason).toBe("No sample.");
  });

  it("treats a confidence of unavailable as unavailable even when the flag says available", () => {
    const view = describeEvidence(evidence({ value: 5, confidence: "unavailable" }));
    expect(view.state).toBe("unavailable");
    expect(view.valueText).toBeNull();
  });

  it("reports a null value on an available metric as missing, not as zero", () => {
    const view = describeEvidence(evidence({ value: null }));
    expect(view.state).toBe("missing");
    expect(view.valueText).toBeNull();
  });

  it("shows a real zero as zero", () => {
    const view = describeEvidence(evidence({ value: 0, unit: "count" }));
    expect(view.state).toBe("value");
    expect(view.valueText).toBe("0");
  });

  it("reports a null previous value as not reported rather than zero", () => {
    expect(describeEvidence(evidence({ previous_value: null })).previousText).toBeNull();
  });

  it("does not show a previous value for an unavailable metric", () => {
    const view = describeEvidence(ZenoEvidenceSchema.parse(unavailableEvidenceFixture({ previous_value: 4 })));
    expect(view.previousText).toBeNull();
  });

  it("refuses a non-finite number as a value", () => {
    expect(describeValue(Number.NaN, "count")).toEqual({ kind: "missing" });
    expect(describeValue(Number.POSITIVE_INFINITY, "count")).toEqual({ kind: "missing" });
  });

  it("describes a structured value without displaying its contents", () => {
    expect(describeValue({ a: 1 }, "count")).toEqual({ kind: "structured" });
  });
});

describe("units", () => {
  it("shows minor-unit money in shillings", () => {
    expect(formatEvidenceNumber(1234500, "kes_minor")).toBe("KES 12,345");
  });

  it("shows percentages with at most one decimal place", () => {
    expect(formatEvidenceNumber(12.5, "percentage")).toBe("12.5%");
    expect(formatEvidenceNumber(40, "percentage")).toBe("40%");
  });

  it("shows a z-score with its sign", () => {
    expect(formatEvidenceNumber(2.345, "z_score")).toBe("z +2.35");
    expect(formatEvidenceNumber(-1.2, "z_score")).toBe("z −1.20");
  });

  it("shows a boolean as yes or no", () => {
    expect(describeValue(true, "boolean")).toEqual({ kind: "value", text: "Yes" });
    expect(describeValue(false, "boolean")).toEqual({ kind: "value", text: "No" });
  });

  it("carries the unit name into the view", () => {
    const view = describeEvidence(evidence({ unit: "kes_minor" }));
    expect(view.unitShort).toBe("KES");
    expect(view.unitLabel).toMatch(/minor units/);
  });
});

describe("evidence period and provenance", () => {
  it("reads a naive backend timestamp as UTC and labels it", () => {
    expect(formatUtc("2026-11-27T10:00:00")).toMatch(/27 Nov 2026, 10:00 UTC/);
  });

  it("describes an open period without inventing a start", () => {
    const view = describeEvidence(evidence({ period: { start: null, end: "2026-11-27T10:00:00", timezone: "UTC" } }));
    expect(view.periodText).toMatch(/^As of 27 Nov 2026, 10:00 UTC/);
  });

  it("states when the period is not given", () => {
    const view = describeEvidence(evidence({ period: { start: null, end: null, timezone: "UTC" } }));
    expect(view.periodText).toBe("Period not stated");
  });

  it("keeps the source and the definition", () => {
    const view = describeEvidence(evidence());
    expect(view.source).toBe("api.core.command_center");
    expect(view.definition).toMatch(/answered by a seller/);
  });
});

describe("dashboard links", () => {
  it("links to pages this dashboard serves", () => {
    expect(dashboardLink("/market")).toEqual({ href: "/market", label: "Market" });
    expect(dashboardLink("/reports/builder")?.href).toBe("/reports/builder");
    expect(dashboardLink("/")).toEqual({ href: "/", label: "Command Center" });
    expect(dashboardLink("/analytics/users")?.href).toBe("/analytics/users");
  });

  it("keeps a filter query that uses only plain parameters", () => {
    expect(dashboardLink("/users?flagged=1")?.href).toBe("/users?flagged=1");
    expect(dashboardLink("/complaints?queue=overdue")?.href).toBe("/complaints?queue=overdue");
  });

  it("links to a record of a supported type", () => {
    expect(dashboardLink("/listings/3f2a9c1b-0000-4000-8000-000000000001")?.label).toBe("Open record");
  });

  it("refuses a page the dashboard does not serve", () => {
    expect(dashboardLink("/zeno")).toBeNull();
    expect(dashboardLink("/briefing")).toBeNull();
    expect(dashboardLink("/status")).toBeNull();
  });

  it("refuses anything that leaves the dashboard or escapes its paths", () => {
    expect(dashboardLink("https://evil.example/market")).toBeNull();
    expect(dashboardLink("//evil.example")).toBeNull();
    expect(dashboardLink("/market/../admin")).toBeNull();
    expect(dashboardLink("/\\evil")).toBeNull();
    expect(dashboardLink("/users?next=https://evil.example")).toBeNull();
    expect(dashboardLink(null)).toBeNull();
    expect(dashboardLink(undefined)).toBeNull();
  });
});

describe("investigation turns", () => {
  it("loads the newest page first when there are more turns than one page", () => {
    expect(turnPageSpecs(41, 0)).toEqual([{ offset: 1, limit: 40 }]);
    expect(turnPageSpecs(41, 1)).toEqual([
      { offset: 0, limit: 1 },
      { offset: 1, limit: 40 },
    ]);
  });

  it("loads a short conversation in one page", () => {
    expect(turnPageSpecs(2, 0)).toEqual([{ offset: 0, limit: 2 }]);
  });

  it("loads nothing when a conversation has no turns", () => {
    expect(turnPageSpecs(0, 0)).toEqual([]);
  });

  it("requests the first page when the turn count is not known yet", () => {
    expect(turnPageSpecs(null, 0)).toEqual([{ offset: 0, limit: 40 }]);
  });

  it("offers earlier messages only while some are not yet loaded", () => {
    expect(hasEarlierTurns(41, 0)).toBe(true);
    expect(hasEarlierTurns(40, 0)).toBe(false);
    expect(hasEarlierTurns(41, 1)).toBe(false);
  });

  it("splits a stored answer into its headline and summary", () => {
    expect(splitStoredAnswer("Revenue fell\n\nIt fell 4% against last week.")).toEqual({
      headline: "Revenue fell",
      summary: "It fell 4% against last week.",
    });
    expect(splitStoredAnswer("A single line")).toEqual({ headline: "A single line", summary: "" });
  });
});

describe("freshness", () => {
  it("shows only the facts that are present, with instants in UTC", () => {
    const rows = freshnessRows({
      period_start: "2026-11-20T10:00:00Z",
      ops_evaluated_day: "2026-11-26",
      cached_for_seconds: 60,
    });
    expect(rows.map((row) => row.label)).toEqual(["Briefing window starts", "Operations anomalies judged on"]);
    expect(rows[0].value).toMatch(/20 Nov 2026, 10:00 UTC/);
    expect(rows[1].value).toBe("2026-11-26");
  });

  it("returns nothing for an absent or empty freshness record", () => {
    expect(freshnessRows({})).toEqual([]);
    expect(freshnessRows({ period_start: "   " })).toEqual([]);
  });
});

describe("error states", () => {
  it("maps each proxy code to a distinct state", () => {
    expect(jarvisErrorKind("ADMIN_ZENO_DISABLED", 503)).toBe("disabled");
    expect(jarvisErrorKind("MODEL_UNAVAILABLE", 503)).toBe("model_unavailable");
    expect(jarvisErrorKind("MODEL_CONTEXT_UNSAFE", 503)).toBe("context_unsafe");
    expect(jarvisErrorKind("INVESTIGATION_TIMEOUT", 504)).toBe("timeout");
    expect(jarvisErrorKind("rate_limited", 429)).toBe("rate_limited");
    expect(jarvisErrorKind("unauthorized", 401)).toBe("unauthorized");
    expect(jarvisErrorKind("forbidden", 403)).toBe("forbidden");
    expect(jarvisErrorKind("conversation_not_found", 404)).toBe("not_found");
    expect(jarvisErrorKind("endpoint_unavailable", 404)).toBe("endpoint_unavailable");
    expect(jarvisErrorKind("validation_failed", 422)).toBe("validation");
    expect(jarvisErrorKind("contract_validation_failed", 502)).toBe("invalid_response");
  });

  it("treats a network failure or a backend outage as unavailable, not as an error", () => {
    expect(jarvisErrorKind("network", 0)).toBe("unavailable");
    expect(jarvisErrorKind("backend_unavailable", 503)).toBe("unavailable");
    expect(jarvisErrorKind(undefined, 504)).toBe("unavailable");
  });

  it("falls back to a generic error for anything unrecognised", () => {
    expect(jarvisErrorKind("something_else", 500)).toBe("error");
  });

  it("names the last model failure without exposing its detail", () => {
    expect(lastErrorLabel(null)).toBe("None recorded");
    expect(lastErrorLabel("providers_unavailable")).toBe("No model provider answered");
    expect(lastErrorLabel("ProviderError: sk-live-secret-123")).toBe("A recent model request failed");
  });
});

describe("starter questions", () => {
  it("covers each investigation domain the administrator can ask about", () => {
    const areas = STARTER_QUESTIONS.map((item) => item.area);
    expect(areas).toEqual(expect.arrayContaining(["Business", "Marketplace", "Operations", "Finance", "Trust", "Growth"]));
  });
});
