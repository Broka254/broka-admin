// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { countPrioritySignals, filterPrioritySignals, mergePrioritySignals, PriorityQueue } from "@/components/dashboard/priority-queue";
import { InsightsResponseSchema } from "@/lib/api/intelligence-schemas";
import { insightsFixture } from "./fixtures/intelligence";

const data = InsightsResponseSchema.parse(insightsFixture);

const alert = (id: string, tone: "danger" | "warning") => ({
  id,
  tone,
  title: `Queue ${id}`,
  detail: "Live backend count.",
  href: "/finance-integrity",
  cta: "Open",
});

describe("mergePrioritySignals", () => {
  it("orders by backend severity, queues before rules within a severity", () => {
    const merged = mergePrioritySignals({ alerts: [alert("payout", "danger"), alert("media", "warning")], insights: data.insights });
    expect(merged[0]).toMatchObject({ id: "queue-payout", kind: "queue", severity: "critical" });
    const severities = merged.map((signal) => signal.severity);
    const rank = { critical: 0, warning: 1, opportunity: 2, info: 3, positive: 4 } as const;
    expect(severities).toEqual([...severities].sort((a, b) => rank[a] - rank[b]));
    expect(merged.filter((signal) => signal.severity === "critical").map((signal) => signal.kind)).toEqual(["queue", "insight"]);
  });

  it("keeps evidence on rule signals and never fabricates queue evidence", () => {
    const merged = mergePrioritySignals({ alerts: [alert("refunds", "danger")], insights: data.insights });
    expect(merged.find((signal) => signal.id === "queue-refunds")?.evidence).toEqual([]);
    const criticalRule = merged.find((signal) => signal.id === "insight-complaints_sla");
    const oldest = criticalRule?.evidence.find((entry) => /oldest/i.test(entry.label));
    expect(oldest?.value).toBe("30h");
    expect(criticalRule?.href).toBe("/complaints?queue=overdue");
  });

  it("counts and filters each severity without dropping the total", () => {
    const merged = mergePrioritySignals({ alerts: [], insights: data.insights });
    const counts = countPrioritySignals(merged);
    expect(counts.all).toBe(data.insights.length);
    expect(counts.critical).toBe(data.insights.filter((insight) => insight.severity === "critical").length);
    expect(filterPrioritySignals(merged, "all")).toHaveLength(counts.all);
    expect(filterPrioritySignals(merged, "critical").every((signal) => signal.severity === "critical")).toBe(true);
  });
});

describe("PriorityQueue", () => {
  it("labels queue signals and rule signals as different evidence types", () => {
    render(<PriorityQueue insights={data} insightsLoading={false} insightsError={null} snapshotState="not-deployed" windowDays={7} />);
    expect(screen.getByRole("heading", { name: "Ranked priority queue" })).toBeInTheDocument();
    expect(screen.queryAllByText("Queue signal")).toHaveLength(0);
    const first = screen.getAllByTestId(/^priority-/)[0];
    expect(within(first).getByText(/Rule ·/)).toBeInTheDocument();
    expect(within(first).getByText("30h")).toBeInTheDocument();
    expect(screen.getByText(/Operational queues are not deployed/)).toBeInTheDocument();
  });

  it("filters by severity and keeps a meaningful empty state", () => {
    render(<PriorityQueue insights={data} insightsLoading={false} insightsError={null} snapshotState="not-deployed" windowDays={7} />);
    fireEvent.click(screen.getByRole("button", { name: /Opportunity/ }));
    expect(screen.getAllByTestId(/^priority-/)).toHaveLength(1);
    expect(screen.getAllByTestId(/^priority-/)[0].dataset.tone).toBe("info");
  });

  it("states plainly when the endpoints are absent instead of inventing priorities", () => {
    render(<PriorityQueue insightsLoading={false} insightsError={null} snapshotState="not-deployed" windowDays={7} />);
    expect(screen.getByText("The priority queue needs the upgraded BROKA API")).toBeInTheDocument();
  });
});
