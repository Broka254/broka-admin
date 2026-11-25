import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

vi.mock("@/hooks/use-timeseries", () => ({ useTimeseries: vi.fn() }));

import { EngagementTrends } from "@/components/dashboard/command-center/engagement-trends";
import { ExecutiveOverview } from "@/components/dashboard/command-center/executive-overview";
import { AdminRequestError } from "@/hooks/use-admin-resource";
import { useTimeseries } from "@/hooks/use-timeseries";
import { CommandCenterSchema, parseAdminResource, type CommandCenter, type CommandMetric } from "@/lib/api/schemas";
import { attentionCounts, formatMetricValue, metricTrend } from "@/lib/command-center";
import { insightsFixture, pulseFixture } from "./fixtures/intelligence";

function figure(overrides: Partial<CommandMetric>): CommandMetric {
  return {
    key: "new_registrations",
    label: "New registrations",
    kind: "period",
    unit: "count",
    good: "up",
    value: 10,
    previous: 8,
    delta: 2,
    change_pct: 25,
    definition: "Accounts created in the last 7 days, administrators excluded.",
    caption: null,
    href: "/users",
    available: true,
    unavailable_reason: null,
    ...overrides,
  };
}

const unmeasured = { value: null, previous: null, delta: null, change_pct: null, available: false } as const;

const commandFixture = {
  generated_at: "2026-11-24T10:00:00Z",
  window: {
    days: 7,
    from: "2026-11-17T10:00:00Z",
    to: "2026-11-24T10:00:00Z",
    previous_from: "2026-11-10T10:00:00Z",
    previous_to: "2026-11-17T10:00:00Z",
  },
  staff_excluded: true,
  activity_coverage_started_on: "2026-11-20",
  groups: [
    {
      key: "growth",
      title: "Platform growth",
      metrics: [
        figure({}),
        figure({
          key: "active_users", label: "Active accounts", href: "/analytics/users", ...unmeasured,
          unavailable_reason: "Activity tracking began on 2026-11-20, too recently to measure the whole period; a partial count would look like a fall.",
        }),
      ],
    },
    {
      key: "financial",
      title: "Financial performance",
      metrics: [
        figure({ key: "failed_payments", label: "Failed payments", good: "down", value: 6, previous: 3, delta: 3, change_pct: 100, href: "/payments?status=failed" }),
        figure({ key: "payment_success_rate", label: "Payment success rate", unit: "percent", value: 50, previous: 100, delta: -50, change_pct: null, href: "/payments" }),
      ],
    },
    {
      key: "operations",
      title: "Technical operations",
      metrics: [
        figure({
          key: "api_availability", label: "API availability", unit: "percent", kind: "live", href: "/service-health", ...unmeasured,
          unavailable_reason: "Needs an external uptime monitor: the API cannot record the time it was down.",
        }),
      ],
    },
  ],
  decisions: insightsFixture,
  pulse: pulseFixture,
};

describe("Command Center formatting", () => {
  it("formats each unit and leaves an unmeasured value as a dash", () => {
    expect(formatMetricValue("count", 1234)).toBe("1,234");
    expect(formatMetricValue("kes_minor", 150_000)).toBe("KES 1,500");
    expect(formatMetricValue("percent", 12.345)).toBe("12.3%");
    expect(formatMetricValue("ms", 12.34)).toBe("12.3 ms");
    expect(formatMetricValue("seconds", 600)).toBe("10m");
    expect(formatMetricValue("count", null)).toBe("—");
    expect(formatMetricValue("an_unknown_unit", 7)).toBe("7");
  });

  it("colours a change by whether it is good news for that figure", () => {
    expect(metricTrend(figure({}))).toEqual({ direction: "up", tone: "good", text: "+25.0%" });
    expect(metricTrend(figure({ good: "down", value: 6, previous: 3, delta: 3, change_pct: 100 })))
      .toEqual({ direction: "up", tone: "bad", text: "+100.0%" });
    expect(metricTrend(figure({ good: "neutral" })).tone).toBe("neutral");
    expect(metricTrend(figure({ value: 8, previous: 8, delta: 0, change_pct: 0 }))).toEqual({ direction: "flat", tone: "neutral", text: "0.0%" });
  });

  it("compares a rate in percentage points, not percent of a percent", () => {
    expect(metricTrend(figure({ unit: "percent", value: 50, previous: 100, delta: -50, change_pct: null })))
      .toEqual({ direction: "down", tone: "bad", text: "-50.0 pp" });
  });

  it("states the amount when the previous period was zero", () => {
    expect(metricTrend(figure({ value: 4, previous: 0, delta: 4, change_pct: null })).text).toBe("+4");
    expect(metricTrend(figure({ unit: "kes_minor", value: 150_000, previous: 0, delta: 150_000, change_pct: null })).text).toBe("+KES 1,500");
  });

  it("says why there is no comparison instead of inventing one", () => {
    expect(metricTrend(figure({ ...unmeasured })).text).toBe("Not measured");
    expect(metricTrend(figure({ kind: "point_in_time", previous: null, delta: null, change_pct: null })).text).toBe("Point in time");
    expect(metricTrend(figure({ kind: "live", previous: null, delta: null, change_pct: null })).text).toBe("Live reading");
  });

  it("counts the decisions that need someone: critical and warning only", () => {
    expect(attentionCounts(insightsFixture)).toEqual({ critical: 1, warning: 1, total: 2 });
    expect(attentionCounts(undefined)).toEqual({ critical: 0, warning: 0, total: 0 });
  });
});

describe("Command Center contract", () => {
  it("parses the backend payload and is registered with the proxy", () => {
    const parsed = CommandCenterSchema.parse(commandFixture);
    expect(parsed.groups.map((group) => group.key)).toEqual(["growth", "financial", "operations"]);
    expect(parseAdminResource("commandCenter", commandFixture).decisions.insights).toHaveLength(4);
  });

  it("rejects a figure whose value is not a number or null", () => {
    const broken = JSON.parse(JSON.stringify(commandFixture)) as typeof commandFixture;
    (broken.groups[0].metrics[0] as unknown as { value: unknown }).value = "10";
    expect(CommandCenterSchema.safeParse(broken).success).toBe(false);
  });
});

describe("ExecutiveOverview", () => {
  const data = CommandCenterSchema.parse(commandFixture) as CommandCenter;

  it("shows every group, each figure with its trend, and links into the records", () => {
    render(<ExecutiveOverview data={data} isLoading={false} error={null} />);
    expect(screen.getByRole("heading", { name: "Platform growth" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Technical operations" })).toBeInTheDocument();
    const registrations = screen.getByTestId("metric-new_registrations");
    expect(within(registrations).getByText("10")).toBeInTheDocument();
    expect(within(registrations).getByText("+25.0%")).toBeInTheDocument();
    expect(within(registrations).getByRole("link", { name: "New registrations" })).toHaveAttribute("href", "/users");
    const failures = screen.getByTestId("metric-failed_payments");
    expect(within(failures).getByText("+100.0%").closest("[data-tone]")).toHaveAttribute("data-tone", "bad");
    expect(within(screen.getByTestId("metric-payment_success_rate")).getByText("-50.0 pp")).toBeInTheDocument();
  });

  it("says a figure is unavailable and why, never a zero", () => {
    render(<ExecutiveOverview data={data} isLoading={false} error={null} />);
    const availability = screen.getByTestId("metric-api_availability");
    expect(within(availability).getByText("Unavailable")).toBeInTheDocument();
    expect(within(availability).getByText(/external uptime monitor/)).toBeInTheDocument();
    expect(within(availability).queryByText("0")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("metric-active_users")).getByText(/tracking began on 2026-11-20/)).toBeInTheDocument();
  });

  it("points to the decisions that need someone", () => {
    render(<ExecutiveOverview data={data} isLoading={false} error={null} />);
    const link = screen.getByTestId("attention-link");
    expect(link).toHaveAttribute("href", "#decisions");
    expect(within(link).getByText("1 critical")).toBeInTheDocument();
    expect(within(link).getByText("1 warning")).toBeInTheDocument();
  });

  it("reads a missing endpoint as a pending upgrade and other failures as errors with a retry", () => {
    const { rerender } = render(<ExecutiveOverview isLoading={false} error={new AdminRequestError("not found", 404)} />);
    expect(screen.getByText(/need the upgraded BROKA API/)).toBeInTheDocument();
    rerender(<ExecutiveOverview isLoading={false} error={new AdminRequestError("The BROKA API is busy", 503)} onRetry={() => undefined} />);
    expect(screen.getByText("The BROKA API is busy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });

  it("shows a loading state while the figures are on their way", () => {
    render(<ExecutiveOverview isLoading error={null} />);
    expect(screen.getByLabelText("Executive overview")).toHaveAttribute("aria-busy", "true");
  });
});

describe("EngagementTrends", () => {
  it("treats a series with no measured day as missing, not as a flat line", () => {
    vi.mocked(useTimeseries).mockReturnValue({
      data: {
        from: "2026-11-22T00:00:00Z",
        to: "2026-11-24T00:00:00Z",
        bucket: "day",
        coverage: { active_users_started_on: null },
        series: {
          active_users: [{ t: "2026-11-22T00:00:00Z", v: null }, { t: "2026-11-23T00:00:00Z", v: null }],
          signups: [{ t: "2026-11-22T00:00:00Z", v: 3 }, { t: "2026-11-23T00:00:00Z", v: 5 }],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTimeseries>);
    render(<EngagementTrends windowDays={7} />);
    expect(screen.getByTestId("timeseries-chart-signups")).toBeInTheDocument();
    expect(screen.queryByTestId("timeseries-chart-active_users")).not.toBeInTheDocument();
    expect(screen.getByText(/1 of 2 series returned data/)).toBeInTheDocument();
    expect(screen.getByText(/No signed-in activity has been recorded yet/)).toBeInTheDocument();
  });

  it("reports the peak, not a total, for daily active accounts", () => {
    vi.mocked(useTimeseries).mockReturnValue({
      data: {
        from: "2026-11-22T00:00:00Z",
        to: "2026-11-24T00:00:00Z",
        bucket: "day",
        coverage: { active_users_started_on: "2026-11-01" },
        series: { active_users: [{ t: "2026-11-22T00:00:00Z", v: 4 }, { t: "2026-11-23T00:00:00Z", v: 9 }], signups: [] },
      },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTimeseries>);
    render(<EngagementTrends windowDays={7} />);
    const chart = screen.getByTestId("timeseries-chart-active_users");
    expect(chart.getAttribute("aria-label")).not.toMatch(/Total/);
    expect(screen.getByText(/^Peak 9/)).toBeInTheDocument();
  });
});
