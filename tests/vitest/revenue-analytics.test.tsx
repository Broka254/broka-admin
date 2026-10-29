import { render, screen } from "@testing-library/react";
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

vi.mock("@/hooks/use-timeseries", () => ({
  useTimeseries: vi.fn(),
}));
vi.mock("@/hooks/use-revenue", () => ({
  useTimeseries: vi.fn(),
}));
vi.mock("@/hooks/use-admin-resource", () => ({
  AdminRequestError: class AdminRequestError extends Error {
    status = 500;
    code = "upstream_error";
  },
  isEndpointMissing: () => false,
}));

import { useTimeseries } from "@/hooks/use-timeseries";
import { MarketplaceAnalytics } from "@/components/dashboard/analytics/marketplace-analytics";
import { UsersAnalytics } from "@/components/dashboard/analytics/users-analytics";

const timeseriesMock = vi.mocked(useTimeseries);

function okResult(series: Record<string, Array<{ t: string; v: number }>>) {
  return {
    data: { from: "2026-09-29", to: "2026-10-29", bucket: "day", series },
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useTimeseries>;
}

beforeEach(() => {
  timeseriesMock.mockReset();
});

describe("MarketplaceAnalytics", () => {
  it("renders only the series keys that exist", () => {
    timeseriesMock.mockReturnValue(
      okResult({ gmv_minor: [{ t: "2026-10-28T00:00:00.000Z", v: 900000 }] }),
    );
    render(<MarketplaceAnalytics />);
    expect(screen.getByTestId("timeseries-chart-gmv_minor")).toBeInTheDocument();
    expect(screen.queryByTestId("timeseries-chart-deals_agreed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeseries-chart-disputes_opened")).not.toBeInTheDocument();
  });

  it("shows an empty state when no known keys exist", () => {
    timeseriesMock.mockReturnValue(okResult({ something_else: [{ t: "2026-10-28T00:00:00.000Z", v: 1 }] }));
    render(<MarketplaceAnalytics />);
    expect(screen.getByText("No marketplace series returned for this range.")).toBeInTheDocument();
  });

  it("labels GMV precisely, never as revenue", () => {
    timeseriesMock.mockReturnValue(
      okResult({ gmv_minor: [{ t: "2026-10-28T00:00:00.000Z", v: 900000 }] }),
    );
    const { container } = render(<MarketplaceAnalytics />);
    expect(container.textContent).toMatch(/GMV/);
    expect(container.textContent).not.toMatch(/revenue/i);
  });
});

describe("UsersAnalytics", () => {
  it("renders signups without active_users and does not crash", () => {
    timeseriesMock.mockReturnValue(
      okResult({ signups: [{ t: "2026-10-28T00:00:00.000Z", v: 12 }] }),
    );
    render(<UsersAnalytics />);
    expect(screen.getByTestId("timeseries-chart-signups")).toBeInTheDocument();
    expect(screen.queryByTestId("timeseries-chart-active_users")).not.toBeInTheDocument();
  });

  it("shows a loading state", () => {
    timeseriesMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTimeseries>);
    render(<UsersAnalytics />);
    expect(screen.getByText("Loading analytics series.")).toBeInTheDocument();
  });
});
