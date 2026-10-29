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

vi.mock("@/hooks/use-revenue", () => ({
  useRevenue: vi.fn(),
  useTimeseries: vi.fn(),
}));
vi.mock("@/hooks/use-admin-resource", () => ({
  AdminRequestError: class AdminRequestError extends Error {
    status: number;
    code: string | undefined;
    constructor(message = "Not deployed", status = 404, code: string | undefined = "endpoint_unavailable") {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  isEndpointMissing: (error: unknown) =>
    Boolean(error && typeof error === "object" && "status" in error && (error as { status: number }).status === 404),
}));

import { AdminRequestError } from "@/hooks/use-admin-resource";
import { useRevenue } from "@/hooks/use-revenue";
import RevenuePage from "@/app/(dashboard)/revenue/page";

const revenueMock = vi.mocked(useRevenue);

const fixture = {
  currency: "KES",
  from: "2026-09-29",
  to: "2026-10-29",
  bucket: "day",
  income: {
    total_minor: 1234500,
    streams: [{ key: "fees", label: "Transaction fees", amount_minor: 1234500, count: 42 }],
  },
  costs: {
    total_minor: 234500,
    estimated_minor: 50000,
    kinds: [{ key: "infra", label: "Infrastructure", amount_minor: 234500, count: 7, estimated: true }],
  },
  profit_minor: 1000000,
  margin_pct: 81.0,
  series: [
    { bucket_start: "2026-10-28T00:00:00.000Z", income_minor: 50000, costs_minor: 10000, profit_minor: 40000 },
  ],
  notes: ["Costs include estimated infrastructure spend."],
};

function okResult(data: unknown) {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useRevenue>;
}

beforeEach(() => {
  revenueMock.mockReset();
});

describe("RevenuePage", () => {
  it("renders KPIs, chart container, and CSV button with a fixture", () => {
    revenueMock.mockReturnValue(okResult(fixture));
    render(<RevenuePage />);
    // KES 12,345 appears twice: the income KPI and the stream row.
    expect(screen.getAllByText("KES 12,345").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("KES 10,000")).toBeInTheDocument();
    expect(screen.getByText("81.0%")).toBeInTheDocument();
    expect(screen.getByTestId("profit-chart")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
    expect(screen.getByText("Transaction fees")).toBeInTheDocument();
    expect(screen.getByText("Estimated")).toBeInTheDocument();
    expect(screen.getByText("Costs include estimated infrastructure spend.")).toBeInTheDocument();
  });

  it("renders the unavailable panel when the endpoint is missing", () => {
    revenueMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new AdminRequestError("Not deployed", 404, "endpoint_unavailable"),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRevenue>);
    render(<RevenuePage />);
    expect(screen.getByText("Revenue endpoint not deployed")).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    revenueMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRevenue>);
    render(<RevenuePage />);
    expect(screen.getByText("Loading revenue data.")).toBeInTheDocument();
  });
});
