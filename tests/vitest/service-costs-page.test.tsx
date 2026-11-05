import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useAdminResource: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("@/hooks/use-admin-resource", () => ({
  AdminRequestError: class AdminRequestError extends Error {
    constructor(message: string, public readonly status: number, public readonly code?: string) { super(message); }
  },
  isEndpointMissing: (error: unknown) => Boolean(error && typeof error === "object" && "status" in error && (error as { status: number }).status === 404),
  useAdminResource: mocks.useAdminResource,
}));
vi.mock("@/hooks/use-service-costs", () => ({
  useCreateManualServiceCost: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

import { AdminRequestError } from "@/hooks/use-admin-resource";
import ServiceCostsPage from "@/app/(dashboard)/service-costs/page";

const fixture = {
  generated_at: "2026-11-05T09:00:00Z",
  period: { from: "2026-10-06", to: "2026-11-06" },
  currencies: [{ code: "KES", minor_unit_exponent: 2 }],
  summary_by_currency: [{
    currency: "KES", actual_minor: 12000, estimated_minor: 3500,
    manual_minor: 500, maximum_estimate_minor: 6000,
  }],
  services: [{
    key: "sms_gateway", name: "SMS gateway", category: "communications",
    provider: "Provider", status: "active",
    usage: { quantity: 100, unit: "SMS segments", success_count: 96, failed_count: 4, source: "instrumented" },
    cost: { amount_minor: 16000, currency: "KES", source: "mixed", confidence: "medium", maximum_estimate_minor: 18000, note: null },
    last_activity_at: "2026-11-05T08:50:00Z",
  }],
  entries: [],
};

beforeEach(() => {
  mocks.useAdminResource.mockReset();
  mocks.mutateAsync.mockReset();
});

describe("ServiceCostsPage", () => {
  it("renders backend usage and separates invoice, estimated, and manual totals", () => {
    mocks.useAdminResource.mockReturnValue({
      data: fixture, isLoading: false, isError: false, error: null,
      isFetching: false, refetch: vi.fn(),
    });
    render(<ServiceCostsPage />);
    expect(screen.getByRole("heading", { name: "Service costs" })).toBeInTheDocument();
    expect(screen.getByText("Service inventory")).toBeInTheDocument();
    expect(screen.getByText("100 SMS segments")).toBeInTheDocument();
    expect(screen.getByText("Invoice-backed")).toBeInTheDocument();
    expect(screen.getByText("Estimated")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add manual cost/i })).toBeInTheDocument();
  });

  it("shows the backend dependency instead of invented sample values", () => {
    mocks.useAdminResource.mockReturnValue({
      data: undefined, isLoading: false, isError: true,
      error: new AdminRequestError("Endpoint missing", 404, "endpoint_unavailable"),
      isFetching: false, refetch: vi.fn(),
    });
    render(<ServiceCostsPage />);
    expect(screen.getByText("Service-cost API not deployed")).toBeInTheDocument();
    expect(screen.getByText(/no sample figures/i)).toBeInTheDocument();
  });
});
