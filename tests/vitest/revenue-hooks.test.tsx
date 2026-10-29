import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import { useRevenue, useTimeseries } from "@/hooks/use-revenue";

const revenuePayload = {
  currency: "KES",
  from: "2026-09-29",
  to: "2026-10-29",
  bucket: "day",
  income: { total_minor: 100000, streams: [] },
  costs: { total_minor: 40000, estimated_minor: 0, kinds: [] },
  profit_minor: 60000,
  margin_pct: 60,
  series: [],
  notes: [],
};

const timeseriesPayload = {
  from: "2026-09-29",
  to: "2026-10-29",
  bucket: "day",
  series: { signups: [{ t: "2026-10-28T00:00:00.000Z", v: 3 }] },
};

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function mockFetchJson(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

const params = { from: "2026-09-29", to: "2026-10-29", bucket: "day" as const };

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("useRevenue", () => {
  it("parses a successful response", async () => {
    mockFetchJson(200, revenuePayload);
    const { result } = renderHook(() => useRevenue(params), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.profit_minor).toBe(60000);
  });

  it("surfaces endpoint_unavailable errors", async () => {
    mockFetchJson(404, { code: "endpoint_unavailable", message: "Not deployed" });
    const { result } = renderHook(() => useRevenue(params), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as AdminRequestError;
    expect(error).toBeInstanceOf(AdminRequestError);
    expect(error.status).toBe(404);
    expect(error.code).toBe("endpoint_unavailable");
  });
});

describe("useTimeseries", () => {
  it("parses a successful response", async () => {
    mockFetchJson(200, timeseriesPayload);
    const { result } = renderHook(() => useTimeseries(params), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.series.signups).toHaveLength(1);
  });

  it("surfaces 404 as AdminRequestError", async () => {
    mockFetchJson(404, { code: "endpoint_unavailable", message: "Not deployed" });
    const { result } = renderHook(() => useTimeseries(params), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as AdminRequestError).status).toBe(404);
  });
});
