// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  accessToken: "access-token" as string | undefined,
  upstreamResponse: null as Response | null,
  upstreamStreamResponse: null as Response | null,
  streamCalls: [] as Array<{ path: string; headers?: Record<string, string>; token?: string }>,
  fetchCalls: [] as Array<{ path: string; method?: string; token?: string }>,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === "broka_admin_access" && state.accessToken) return { value: state.accessToken };
      return undefined;
    },
  }),
}));

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return {
    ...actual,
    upstreamFetch: vi.fn(async (path: string, init: RequestInit = {}, token?: string) => {
      state.fetchCalls.push({ path, method: init.method, token });
      return state.upstreamResponse ?? new Response("{}", { status: 200 });
    }),
    upstreamStream: vi.fn(async (path: string, init: { headers?: Record<string, string> } = {}, token?: string) => {
      state.streamCalls.push({ path, headers: init.headers, token });
      if (state.upstreamStreamResponse) return state.upstreamStreamResponse;
      return new Response("event: ping\n\n", { status: 200 });
    }),
    refreshAccessToken: vi.fn(),
  };
});

import { isSafeAdminPath, isStreamPath, resourceForPath } from "@/lib/api/admin";
import { GET, POST } from "@/app/api/broka/[...path]/route";

function context(...segments: string[]) {
  return { params: Promise.resolve({ path: segments }) };
}

describe("alert allowlist coverage", () => {
  it("allowlist covers alerts, stream, revenue, timeseries and loose details", () => {
    for (const path of [
      "admin/alerts",
      "admin/alerts/stream",
      "admin/revenue",
      "admin/analytics/timeseries",
      "admin/listings/abc",
      "admin/disputes/abc",
      "admin/stores/abc",
    ]) {
      expect(isSafeAdminPath(path)).toBe(true);
    }
    expect(resourceForPath("admin/alerts")).toBe("alerts");
    expect(resourceForPath("admin/revenue")).toBe("revenue");
    expect(resourceForPath("admin/analytics/timeseries")).toBe("timeseries");
    expect(resourceForPath("admin/listings/abc")).toBe("listingDetail");
    expect(resourceForPath("admin/disputes/abc")).toBe("disputeDetail");
    expect(resourceForPath("admin/stores/abc")).toBe("storeDetail");
    expect(isStreamPath("admin/alerts/stream")).toBe(true);
    expect(isStreamPath("admin/alerts")).toBe(false);
  });
});

describe("proxy SSE streaming", () => {
  beforeEach(() => {
    state.accessToken = "access-token";
    state.streamCalls = [];
    state.fetchCalls = [];
    state.upstreamStreamResponse = null;
  });

  it("passes the upstream event stream through unbuffered as text/event-stream", async () => {
    const chunks = ["event: alert\ndata: {\"id\":\"a1\"}\n\n", ": ping\n\n"];
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    });
    state.upstreamStreamResponse = new Response(stream, { status: 200 });
    const request = new Request("http://localhost/api/broka/admin/alerts/stream", {
      headers: { "last-event-id": "42" },
    });
    const response = await GET(request, context("admin", "alerts", "stream"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(text).toContain("event: alert");
    expect(text).toContain(": ping");
    expect(state.streamCalls).toHaveLength(1);
    expect(state.streamCalls[0]).toMatchObject({ path: "/admin/alerts/stream", token: "access-token" });
    expect(state.streamCalls[0]?.headers?.["Last-Event-ID"]).toBe("42");
    expect(state.fetchCalls).toHaveLength(0);
  });

  it("requires authentication for the stream", async () => {
    state.accessToken = undefined;
    const request = new Request("http://localhost/api/broka/admin/alerts/stream");
    const response = await GET(request, context("admin", "alerts", "stream"));
    expect(response.status).toBe(401);
  });

  it("forwards the idempotency key on alert mutations", async () => {
    state.upstreamResponse = new Response(
      JSON.stringify({
        id: 1, kind: "k", severity: "high", title: "t", body: null, href: null,
        status: "acknowledged", created_at: "2026-10-29T10:00:00.000Z",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    const request = new Request("http://localhost/api/broka/admin/alerts/a1/acknowledge", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json", "x-idempotency-key": "key-12345678" },
      body: JSON.stringify({}),
    });
    const response = await POST(request, context("admin", "alerts", "a1", "acknowledge"));
    expect(response.status).toBe(200);
    expect(state.fetchCalls).toHaveLength(1);
    const { upstreamFetch } = await import("@/lib/api/client");
    expect(vi.mocked(upstreamFetch).mock.calls[0]?.[1]?.headers).toMatchObject({ "X-Idempotency-Key": "key-12345678" });
  });
});
