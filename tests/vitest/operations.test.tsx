import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  const w = window as unknown as Record<string, unknown>;
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    w.ResizeObserver = ResizeObserverStub;
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

vi.mock("@/hooks/use-admin-resource", () => ({
  isEndpointMissing: (error: unknown) => (error as { status?: number } | null)?.status === 404,
  useAdminResource: vi.fn(),
}));

import { OperationsView } from "@/components/operations/operations-view";
import { useAdminResource } from "@/hooks/use-admin-resource";
import { OperationsAnomaliesSchema, OperationsSchema } from "@/lib/api/operations-schemas";
import { parseAdminResource } from "@/lib/api/schemas";
import { bucketLabel, formatAge, formatOpsValue, opsChange, opsChangeTone } from "@/lib/operations";
import { operationsFixture } from "./fixtures/report-builder";

// The anomaly checks are a second resource on the same page, so the mock answers
// each resource by name: the operations figures for "operations", the checks for
// "operationsAnomalies".
function anomaliesFixture(): Record<string, unknown> {
  return {
    generated_at: "2026-11-25T12:00:00Z",
    data_as_of: "2026-11-25T00:00:00Z",
    evaluated_day: "2026-11-24",
    baseline: { from: "2026-10-27T00:00:00Z", to_exclusive: "2026-11-24T00:00:00Z", days: 28, min_measured_days: 7 },
    rules: { min_samples_per_day: 720, z_threshold: 3.5, high_z: 6 },
    anomalies: [{
      key: "api_error_rate", label: "API error rate", unit: "percent", status: "flagged", reason: null,
      observed: 30, baseline_median: 1, baseline_days: 28, z_score: 58, deviation: { absolute: 29, pct: 2900 },
      direction: "up", date: "2026-11-24", severity: "high",
      what_happened: "API error rate was 30.0% on 24 Nov 2026 (UTC), above its usual 1.0%.",
      impact: "Requests failed with server errors, so some users saw errors.",
      suggested_action: "Open Operations for that day and check the failing routes, then the database pool.",
      source: "ops_samples", evidence: [{ label: "API error rate", value: 30, source: "ops_samples" }],
    }],
    figures: [
      { key: "api_error_rate", label: "API error rate", unit: "percent", status: "flagged", reason: null, observed: 30,
        baseline_median: 1, baseline_days: 28, z_score: 58, deviation: { absolute: 29, pct: 2900 }, direction: "up" },
      { key: "push_failed", label: "Pushes refused or failed", unit: "count", status: "insufficient_history",
        reason: "2 measured days before it; 7 are needed to judge it.", observed: 3, baseline_median: null, baseline_days: 2,
        z_score: null, deviation: null, direction: null },
      { key: "pool_saturations", label: "Times the connection pool was full", unit: "count", status: "not_measured",
        reason: "The sampler recorded too few samples for this day, so it is not compared.", observed: null,
        baseline_median: null, baseline_days: 0, z_score: null, deviation: null, direction: null },
    ],
    covered_elsewhere: [],
    not_covered: [{ figure: "Active users", reason: "No anomaly rule judges it yet." }],
  };
}

function serve(payload: unknown, anomalies: unknown = anomaliesFixture()) {
  vi.mocked(useAdminResource).mockImplementation(((resource: string) => ({
    data: resource === "operationsAnomalies" ? OperationsAnomaliesSchema.parse(anomalies) : OperationsSchema.parse(payload),
    isLoading: false, isError: false, error: null, refetch: vi.fn(),
  })) as never);
}

function operationsCalls() {
  return vi.mocked(useAdminResource).mock.calls.filter((call) => call[0] === "operations");
}

describe("operations contract", () => {
  it("validates every section the backend sends", () => {
    const parsed = parseAdminResource("operations", operationsFixture());
    expect(parsed.sections.map((s) => s.key)).toEqual(["api", "database", "payments", "notifications", "calls", "background"]);
    expect(parsed.sections[5].loops?.[1].status).toBe("stale");
  });

  it("rejects an unknown loop status", () => {
    const bad = operationsFixture();
    const sections = (bad.sections as Array<Record<string, unknown>>).map((s) => s.key === "background"
      ? { ...s, loops: [{ ...(s.loops as Array<Record<string, unknown>>)[0], status: "fine" }] } : s);
    expect(OperationsSchema.safeParse({ ...bad, sections }).success).toBe(false);
  });
});

describe("operations formatting", () => {
  it("formats units and changes", () => {
    expect(formatOpsValue(1.5, "percent")).toBe("1.5%");
    expect(formatOpsValue(420.6, "ms")).toBe("421 ms");
    expect(formatOpsValue(30, "seconds")).toBe("30 s");
    expect(formatOpsValue(null, "count")).toBe("—");
    expect(opsChange({ unit: "percent", previous: 0.5, delta: 1, change_pct: null })).toBe("+1.0 pts");
    expect(opsChange({ unit: "ms", previous: 380, delta: 40, change_pct: 10.5 })).toBe("+10.5%");
    expect(opsChange({ unit: "count", previous: null, delta: null, change_pct: null })).toBeNull();
    expect(opsChangeTone({ good: "down", delta: 40 })).toBe("danger");
    expect(opsChangeTone({ good: "up", delta: 40 })).toBe("success");
    expect(opsChangeTone({ good: "neutral", delta: 40 })).toBe("neutral");
    expect(formatAge(45)).toBe("45s");
    expect(formatAge(3600)).toBe("1h");
    expect(formatAge(3900)).toBe("1h 5m");
    expect(bucketLabel("2026-11-25T10:30:00Z", 24)).toBe("10:30");
  });
});

describe("OperationsView", () => {
  beforeEach(() => serve(operationsFixture()));

  it("shows each area's figures against the window before", () => {
    render(<OperationsView />);
    expect(within(screen.getByTestId("ops-error_rate")).getByText("1.5%")).toBeInTheDocument();
    expect(within(screen.getByTestId("ops-error_rate")).getByText("+1.0 pts")).toBeInTheDocument();
    expect(within(screen.getByTestId("ops-p95_ms")).getByText("420 ms")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Busiest endpoints" })).toHaveTextContent("GET /listings/{listing_id}");
    expect(screen.getByText(/The balance is insufficient for the transaction #/)).toBeInTheDocument();
    expect(screen.getByText(/This process now: 2 of 5 connections checked out/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Sampling coverage" })).getByText(/Sampling began/)).toBeInTheDocument();
  });

  it("never presents FCM acceptance as delivery, and says what was not measured", () => {
    render(<OperationsView />);
    const accepted = screen.getByTestId("ops-push_accepted");
    expect(within(accepted).getByText(/That is not delivery/)).toBeInTheDocument();
    const failed = screen.getByTestId("ops-push_failed");
    expect(within(failed).getByText("Not measured")).toBeInTheDocument();
    expect(within(failed).getByText(/No operations sample in this window/)).toBeInTheDocument();
    expect(screen.getByText(/No per-call timing between answering and connecting is stored/)).toBeInTheDocument();
  });

  it("flags a stale loop and names the failing task", () => {
    render(<OperationsView />);
    const loops = screen.getByRole("table", { name: "Background loops" });
    const nudge = within(loops).getByText(/One-minute sweep/).closest("tr") as HTMLElement;
    expect(within(nudge).getByText("Stale")).toBeInTheDocument();
    expect(within(nudge).getByText("1h ago")).toBeInTheDocument();
    const sweep = within(loops).getByText(/Five-minute sweep/).closest("tr") as HTMLElement;
    expect(within(sweep).getByText("deal timer check 1")).toBeInTheDocument();
  });

  it("asks for the window chosen", () => {
    render(<OperationsView />);
    expect(operationsCalls().at(-1)?.[1]?.toString()).toBe("window_hours=24");
    fireEvent.click(screen.getByRole("radio", { name: "6 hours" }));
    expect(operationsCalls().at(-1)?.[1]?.toString()).toBe("window_hours=6");
  });

  it("shows the unusual changes the checks found, with what to check", () => {
    render(<OperationsView />);
    expect(screen.getByText("Unusual changes on the last complete day")).toBeInTheDocument();
    const item = screen.getByTestId("anomaly-api_error_rate");
    expect(within(item).getByText("API error rate was 30.0% on 24 Nov 2026 (UTC), above its usual 1.0%.")).toBeInTheDocument();
    expect(within(item).getByText("high")).toBeInTheDocument();
    expect(within(item).getByText(/Open Operations for that day/)).toBeInTheDocument();
  });

  it("says which figures could not be judged and why, and never shows them as zero", () => {
    render(<OperationsView />);
    const table = screen.getByRole("table", { name: "Each figure against its history" });
    expect(within(table).getByText("Too little history")).toBeInTheDocument();
    expect(within(table).getByText("2 measured days before it; 7 are needed to judge it.")).toBeInTheDocument();
    expect(within(table).getByText("Not measured")).toBeInTheDocument();
    expect(screen.getByText("Active users:")).toBeInTheDocument();
  });

  it("explains a deployment that has not sampled yet", () => {
    serve(operationsFixture({ coverage: { sampling_started_at: null, samples: 0, instances_in_window: 0, instances_reporting: 0,
      sample_seconds: 60, truncated: false, this_instance: "srv-1-42" } }));
    render(<OperationsView />);
    expect(screen.getByText(/No operations sample has been recorded yet/)).toBeInTheDocument();
  });

  it("says when the API has no operations endpoint yet", () => {
    vi.mocked(useAdminResource).mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { status: 404 }, refetch: vi.fn() } as never);
    render(<OperationsView />);
    expect(screen.getByText("The operations workspace needs the upgraded BROKA API.")).toBeInTheDocument();
  });
});
