// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAlertsStream } from "@/hooks/use-alerts-stream";
import type { AlertListResponse } from "@/lib/api/schemas";

type Listener = (event: { data: string }) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, Listener[]>();
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: Listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  emit(type: string, data: string) {
    for (const listener of this.listeners.get(type) ?? []) listener({ data });
  }
  close() {
    this.closed = true;
  }
}

function setup(initial?: AlertListResponse) {
  FakeEventSource.instances = [];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (initial) {
    client.setQueryData(["broka-admin", "alerts", "limit=50&offset=0"], initial);
    client.setQueryData(["broka-admin", "alerts-unread"], initial.unread);
  }
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, Wrapper };
}

const seed: AlertListResponse = {
  items: [
    {
      id: 1, kind: "k", severity: "high", title: "First", body: null, href: null,
      status: "open", created_at: "2026-10-29T10:00:00.000Z",
      acknowledged_at: null, acknowledged_by: null, resolved_at: null, meta: null,
    },
  ],
  total: 1,
  unread: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useAlertsStream", () => {
  it("prepends alert events into the alerts cache and updates unread on stats", async () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);
    const { client, Wrapper } = setup(seed);
    renderHook(() => useAlertsStream(), { wrapper: Wrapper });
    const source = FakeEventSource.instances[0];
    act(() => source.onopen?.());

    act(() =>
      source.emit("alert", JSON.stringify({
        id: 2, kind: "k", severity: "critical", title: "Second", body: "b", href: "/finance-integrity",
        status: "open", created_at: "2026-10-29T11:00:00.000Z",
        acknowledged_at: null, acknowledged_by: null, resolved_at: null, meta: null,
      })),
    );
    const cached = client.getQueryData<AlertListResponse>(["broka-admin", "alerts", "limit=50&offset=0"]);
    expect(cached?.items[0]?.id).toBe(2);

    act(() => source.emit("stats", JSON.stringify({ unread: 7 })));
    expect(client.getQueryData(["broka-admin", "alerts-unread"])).toBe(7);
  });

  it("falls back to polling after three consecutive errors and reports offline", async () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);
    vi.useFakeTimers();
    const { Wrapper } = setup(seed);
    const { result } = renderHook(() => useAlertsStream(), { wrapper: Wrapper });
    const source = FakeEventSource.instances[0];
    act(() => { source.onerror?.(); });
    act(() => { source.onerror?.(); });
    expect(result.current.status).toBe("connecting");
    act(() => { source.onerror?.(); });
    expect(result.current.status).toBe("offline");
    expect(source.closed).toBe(true);
  });

  it("reports offline when EventSource is unavailable (SSR guard)", async () => {
    const { Wrapper } = setup();
    const saved = (globalThis as Record<string, unknown>).EventSource;
    delete (globalThis as Record<string, unknown>).EventSource;
    try {
      const { result } = renderHook(() => useAlertsStream(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.status).toBe("offline"));
    } finally {
      (globalThis as Record<string, unknown>).EventSource = saved;
    }
  });
});
