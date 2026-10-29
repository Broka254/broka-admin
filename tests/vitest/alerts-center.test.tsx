// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlertCenter } from "@/components/dashboard/alert-center";

const alertRow = {
  id: 1, kind: "escrow", severity: "critical", title: "Payout failed", body: "Funds stuck.",
  href: "/finance-integrity", status: "open", created_at: "2026-10-29T10:00:00.000Z",
  acknowledged_at: null, acknowledged_by: null, resolved_at: null, meta: null,
};

function setup(fetchImpl: (url: RequestInfo | URL) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  // SSE hook opens an EventSource in the component; stub it closed.
  vi.stubGlobal("EventSource", class {
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    addEventListener() {}
    close() {}
  } as unknown as typeof EventSource);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, Wrapper };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AlertCenter", () => {
  it("renders the feed with filters and unread count", async () => {
    const { Wrapper } = setup(async () =>
      new Response(JSON.stringify({ items: [alertRow], total: 1, unread: 2 }), { status: 200 }),
    );
    render(<AlertCenter />, { wrapper: Wrapper });
    expect(await screen.findByText("Payout failed")).toBeInTheDocument();
    expect(screen.getByText("2 unread")).toBeInTheDocument();
    expect(screen.getByLabelText("Alert filters")).toBeInTheDocument();
  });

  it("sends an acknowledge mutation with the idempotency header", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const { Wrapper } = setup(async (url) => {
      const href = String(url);
      if (href.includes("/acknowledge")) {
        calls.push({ url: href });
        return new Response(JSON.stringify({ ...alertRow, status: "acknowledged" }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [alertRow], total: 1, unread: 1 }), { status: 200 });
    });
    // Capture headers through a fetch wrapper instead: re-stub with capture.
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/acknowledge")) calls.push({ url: href, init });
      if (href.includes("/acknowledge")) return new Response(JSON.stringify({ ...alertRow, status: "acknowledged" }), { status: 200 });
      return new Response(JSON.stringify({ items: [alertRow], total: 1, unread: 1 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AlertCenter />, { wrapper: Wrapper });
    fireEvent.click(await screen.findByText("Acknowledge"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/acknowledge"), expect.anything()));
    const init = fetchMock.mock.calls.find((call) => String(call[0]).includes("/acknowledge"))?.[1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get("X-Idempotency-Key")).toBeTruthy();
  });

  it("shows an empty state when the feed has no rows", async () => {
    const { Wrapper } = setup(async () =>
      new Response(JSON.stringify({ items: [], total: 0, unread: 0 }), { status: 200 }),
    );
    render(<AlertCenter />, { wrapper: Wrapper });
    expect(await screen.findByText("No alerts match these filters")).toBeInTheDocument();
  });

  it("shows a not-deployed panel on 404", async () => {
    const { Wrapper } = setup(async () =>
      new Response(JSON.stringify({ code: "path_not_allowlisted", message: "nope" }), { status: 404 }),
    );
    render(<AlertCenter />, { wrapper: Wrapper });
    expect(await screen.findByText("Alert source not deployed")).toBeInTheDocument();
  });
});
