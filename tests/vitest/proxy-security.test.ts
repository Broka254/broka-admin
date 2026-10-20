// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  accessToken: "access-token" as string | undefined,
  upstreamResponse: null as Response | null,
  upstreamCalls: [] as Array<{ path: string; method?: string; headers?: HeadersInit; token?: string }>,
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
      state.upstreamCalls.push({ path, method: init.method, headers: init.headers, token });
      return state.upstreamResponse ?? new Response("{}", { status: 200 });
    }),
    refreshAccessToken: vi.fn(),
  };
});

import { isSafeAdminPath } from "@/lib/api/admin";
import { POST, GET } from "@/app/api/broka/[...path]/route";

function context(...segments: string[]) {
  return { params: Promise.resolve({ path: segments }) };
}

function mutationRequest(body: string, options: { origin?: string | null; contentType?: string; path?: string[] } = {}) {
  const headers: Record<string, string> = {};
  if (options.origin !== null) headers.origin = options.origin ?? "http://localhost";
  if (options.contentType !== undefined) headers["content-type"] = options.contentType;
  return new Request(`http://localhost/api/broka/${(options.path ?? ["admin", "communications", "preview"]).join("/")}`, {
    method: "POST",
    headers,
    body,
  });
}

describe("admin proxy security boundaries", () => {
  beforeEach(() => {
    state.accessToken = "access-token";
    state.upstreamCalls = [];
    state.upstreamResponse = new Response(
      JSON.stringify({ kind: "all", count: 10, max_audience: 100, allowed: true }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });

  it("keeps the GET allowlist narrow and rejects unknown paths", async () => {
    expect(isSafeAdminPath("admin/communications")).toBe(true);
    expect(isSafeAdminPath("admin/communications/comm-1")).toBe(true);
    expect(isSafeAdminPath("admin/communications/comm-1/secret")).toBe(false);
    expect(isSafeAdminPath("admin/summary/extra")).toBe(false);

    const response = await GET(
      new Request("http://localhost/api/broka/admin/communications/comm-1/secret"),
      context("admin", "communications", "comm-1", "secret"),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "path_not_allowlisted" });
  });

  it("rejects cross-origin mutations before reading or forwarding the body", async () => {
    const response = await POST(
      mutationRequest(JSON.stringify({ audience: { kind: "all" } }), { origin: "https://evil.example" }),
      context("admin", "communications", "preview"),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "csrf_origin_mismatch" });
    expect(state.upstreamCalls).toHaveLength(0);
  });

  it("requires an authenticated session cookie", async () => {
    state.accessToken = undefined;
    const response = await POST(
      mutationRequest(JSON.stringify({ audience: { kind: "all" } }), {
        contentType: "application/json",
      }),
      context("admin", "communications", "preview"),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
    expect(state.upstreamCalls).toHaveLength(0);
  });

  it("rejects oversized and unsupported payloads before forwarding", async () => {
    const oversized = await POST(
      mutationRequest("x".repeat(512 * 1024 + 1), {
        contentType: "application/json",
      }),
      context("admin", "communications", "preview"),
    );
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toMatchObject({ code: "payload_too_large" });

    const unsupported = await POST(
      mutationRequest("{}", { contentType: "text/plain" }),
      context("admin", "communications", "preview"),
    );
    expect(unsupported.status).toBe(415);
    expect(await unsupported.json()).toMatchObject({ code: "unsupported_content_type" });
    expect(state.upstreamCalls).toHaveLength(0);
  });

  it("enforces the actual streamed size when content-length is absent", async () => {
    const bytes = new Uint8Array(512 * 1024 + 1);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/broka/admin/communications/preview", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    expect(request.headers.get("content-length")).toBeNull();

    const response = await POST(request, context("admin", "communications", "preview"));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "payload_too_large" });
    expect(state.upstreamCalls).toHaveLength(0);
  });

  it("validates malformed JSON and forwards an ordinary valid request", async () => {
    const malformed = await POST(
      mutationRequest("{", { contentType: "application/json" }),
      context("admin", "communications", "preview"),
    );
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ code: "invalid_json" });

    const valid = await POST(
      mutationRequest(JSON.stringify({ audience: { kind: "all" } }), {
        contentType: "application/json",
      }),
      context("admin", "communications", "preview"),
    );
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({ kind: "all", count: 10 });
    expect(state.upstreamCalls).toHaveLength(1);
    expect(state.upstreamCalls[0]).toMatchObject({
      path: "/admin/communications/preview",
      method: "POST",
      token: "access-token",
    });
  });

  it("does not export unlisted HTTP methods", async () => {
    const route = await import("@/app/api/broka/[...path]/route");
    expect(route).not.toHaveProperty("DELETE");
    expect(route).not.toHaveProperty("PUT");
  });
});
