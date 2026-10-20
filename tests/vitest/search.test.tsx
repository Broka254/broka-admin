import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAdminCommunications } from "@/hooks/use-admin-resource";
import { buildCommunicationListParams } from "@/lib/communications/search";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("communications server-side search", () => {
  it("builds title search, filters, and pagination offsets for the backend", () => {
    const params = buildCommunicationListParams({
      page: 2,
      pageSize: 15,
      search: "  maintenance  ",
      status: "published",
      communicationType: "maintenance",
      severity: "high",
    });
    expect(params.get("search")).toBe("maintenance");
    expect(params.get("offset")).toBe("30");
    expect(params.get("limit")).toBe("15");
    expect(params.get("status")).toBe("published");
    expect(params.get("communication_type")).toBe("maintenance");
    expect(params.get("severity")).toBe("high");
  });

  it("keeps the same search across pages while changing only the offset", () => {
    const first = buildCommunicationListParams({ page: 0, pageSize: 15, search: "incident" });
    const later = buildCommunicationListParams({ page: 3, pageSize: 15, search: "incident" });
    expect(first.get("search")).toBe("incident");
    expect(later.get("search")).toBe("incident");
    expect(first.get("offset")).toBe("0");
    expect(later.get("offset")).toBe("45");
  });

  it("debounces rapid text entry to the latest value", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    });
    rerender({ value: "m" });
    rerender({ value: "main" });
    rerender({ value: "maintenance" });
    expect(result.current).toBe("");
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe("");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("maintenance");
  });

  it("does not let a stale search response replace the newer query result", async () => {
    const alpha = deferred<Response>();
    const beta = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      return url.includes("search=alpha") ? alpha.promise : beta.promise;
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    const queryA = new URLSearchParams({ search: "alpha", limit: "15", offset: "0" });
    const queryB = new URLSearchParams({ search: "beta", limit: "15", offset: "0" });
    const { result, rerender } = renderHook(
      ({ query }) => useAdminCommunications(query),
      { initialProps: { query: queryA }, wrapper: Wrapper },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender({ query: queryB });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    beta.resolve(new Response(JSON.stringify({ items: [], total: 1, limit: 15, offset: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    await waitFor(() => expect(result.current.data?.total).toBe(1));

    alpha.resolve(new Response(JSON.stringify({ items: [], total: 999, limit: 15, offset: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.data?.total).toBe(1);
  });
});

