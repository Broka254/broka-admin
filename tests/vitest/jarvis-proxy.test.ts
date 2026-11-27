// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  cookies: {} as Record<string, string>,
  calls: [] as Array<{ path: string; method?: string; body?: string; token?: string }>,
  respond: (() => new Response("{}", { status: 200 })) as (path: string, init: RequestInit) => Response,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (state.cookies[name] ? { value: state.cookies[name] } : undefined),
  }),
}));

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return {
    ...actual,
    upstreamFetch: vi.fn(async (path: string, init: RequestInit = {}, token?: string) => {
      state.calls.push({
        path,
        method: init.method,
        body: typeof init.body === "string" ? init.body : undefined,
        token,
      });
      return state.respond(path, init);
    }),
  };
});

import * as route from "@/app/api/broka/[...path]/route";
import {
  briefingFixture,
  chatResponseFixture,
  CONVERSATION_ID,
  conversationDetailFixture,
  conversationListFixture,
  statusFixture,
} from "./fixtures/jarvis";

const ORIGIN = "http://localhost";
const UNSAFE_ID = "..";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function context(...segments: string[]) {
  return { params: Promise.resolve({ path: segments }) };
}

function getRequest(url: string) {
  return new Request(`${ORIGIN}${url}`);
}

function postRequest(url: string, body: unknown, options: { origin?: string | null; raw?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  return new Request(`${ORIGIN}${url}`, {
    method: "POST",
    headers,
    body: options.raw ?? JSON.stringify(body),
  });
}

function deleteRequest(url: string, origin: string | null = ORIGIN) {
  const headers: Record<string, string> = {};
  if (origin !== null) headers.origin = origin;
  return new Request(`${ORIGIN}${url}`, { method: "DELETE", headers });
}

function upstreamCalls(path: string) {
  return state.calls.filter((call) => call.path === path);
}

beforeEach(() => {
  state.cookies = { broka_admin_access: "access-token" };
  state.calls = [];
  state.respond = () => json({});
});

describe("GET allowlist for Jarvis Mode reads", () => {
  it("forwards the status read with the session token and returns the validated payload", async () => {
    state.respond = () => json(statusFixture());
    const response = await route.GET(getRequest("/api/broka/admin/zeno/status"), context("admin", "zeno", "status"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ enabled: true, tool_count: 14 });
    expect(upstreamCalls("/admin/zeno/status")[0]).toMatchObject({ method: "GET", token: "access-token" });
  });

  it("forwards a validated briefing window and nothing else", async () => {
    state.respond = () => json(briefingFixture());
    const response = await route.GET(
      getRequest("/api/broka/admin/zeno/briefing?window_days=30"),
      context("admin", "zeno", "briefing"),
    );
    expect(response.status).toBe(200);
    expect(upstreamCalls("/admin/zeno/briefing?window_days=30")).toHaveLength(1);
  });

  it("rebuilds the upstream query from validated values, dropping nothing it kept", async () => {
    state.respond = () => json(conversationListFixture());
    await route.GET(
      getRequest("/api/broka/admin/zeno/conversations?limit=20&offset=40"),
      context("admin", "zeno", "conversations"),
    );
    expect(upstreamCalls("/admin/zeno/conversations?limit=20&offset=40")).toHaveLength(1);
  });

  it("forwards a conversation read with its page window", async () => {
    state.respond = () => json(conversationDetailFixture());
    const response = await route.GET(
      getRequest(`/api/broka/admin/zeno/conversations/${CONVERSATION_ID}?limit=40&offset=0`),
      context("admin", "zeno", "conversations", CONVERSATION_ID),
    );
    expect(response.status).toBe(200);
    expect(upstreamCalls(`/admin/zeno/conversations/${CONVERSATION_ID}?limit=40&offset=0`)).toHaveLength(1);
  });

  it.each([
    ["a window above 30 days", "/api/broka/admin/zeno/briefing?window_days=31", ["admin", "zeno", "briefing"]],
    ["a window of zero", "/api/broka/admin/zeno/briefing?window_days=0", ["admin", "zeno", "briefing"]],
    ["a fractional window", "/api/broka/admin/zeno/briefing?window_days=7.5", ["admin", "zeno", "briefing"]],
    ["a signed window", "/api/broka/admin/zeno/briefing?window_days=-1", ["admin", "zeno", "briefing"]],
    ["a duplicated window", "/api/broka/admin/zeno/briefing?window_days=7&window_days=8", ["admin", "zeno", "briefing"]],
    ["an unknown parameter", "/api/broka/admin/zeno/briefing?window_days=7&user_id=other", ["admin", "zeno", "briefing"]],
    ["a parameter on the status read", "/api/broka/admin/zeno/status?verbose=1", ["admin", "zeno", "status"]],
    ["a page above 50", "/api/broka/admin/zeno/conversations?limit=51", ["admin", "zeno", "conversations"]],
    ["a negative offset", "/api/broka/admin/zeno/conversations?offset=-5", ["admin", "zeno", "conversations"]],
    ["a turn page above 40", `/api/broka/admin/zeno/conversations/${CONVERSATION_ID}?limit=41`, ["admin", "zeno", "conversations", CONVERSATION_ID]],
  ])("refuses %s before anything is sent upstream", async (_label, url, segments) => {
    const response = await route.GET(getRequest(url), context(...segments));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "invalid_query" });
    expect(state.calls).toHaveLength(0);
  });

  it.each([
    ["an unknown Jarvis path", ["admin", "zeno", "forecast"]],
    ["a conversation read with a non-UUID id", ["admin", "zeno", "conversations", "conv-1"]],
    ["a conversation read with a dot segment", ["admin", "zeno", "conversations", UNSAFE_ID]],
    ["a conversation read with an encoded slash in the id", ["admin", "zeno", "conversations", "a/b"]],
    ["a conversation read with an extra segment", ["admin", "zeno", "conversations", CONVERSATION_ID, "messages"]],
  ])("answers 404 for %s without contacting the backend", async (_label, segments) => {
    const response = await route.GET(getRequest(`/api/broka/${segments.join("/")}`), context(...segments));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "path_not_allowlisted" });
    expect(state.calls).toHaveLength(0);
  });

  it("requires a session before reading Jarvis data", async () => {
    state.cookies = {};
    const response = await route.GET(getRequest("/api/broka/admin/zeno/status"), context("admin", "zeno", "status"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
    expect(state.calls).toHaveLength(0);
  });
});

describe("GET failures from the backend", () => {
  it("relays only the approved code and message for a disabled deployment", async () => {
    state.respond = () =>
      json(
        { detail: { code: "ADMIN_ZENO_DISABLED", message: "Administrative Zeno is not enabled on this deployment." } },
        503,
      );
    const response = await route.GET(getRequest("/api/broka/admin/zeno/status"), context("admin", "zeno", "status"));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { code: string; message: string };
    expect(body.code).toBe("ADMIN_ZENO_DISABLED");
    expect(body.message).toBe("Jarvis Mode is not enabled on this deployment.");
  });

  it("does not relay a backend message or traceback from an unapproved failure", async () => {
    state.respond = () =>
      json({ detail: "Traceback (most recent call last): sqlite3.OperationalError at /srv/api/x.py" }, 500);
    const response = await route.GET(getRequest("/api/broka/admin/zeno/briefing"), context("admin", "zeno", "briefing"));
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).toMatch(/backend_unavailable/);
    expect(text).not.toMatch(/traceback|sqlite|srv\/api/i);
  });

  it("reports a missing conversation as not found", async () => {
    state.respond = () => json({ detail: "Conversation not found" }, 404);
    const response = await route.GET(
      getRequest(`/api/broka/admin/zeno/conversations/${CONVERSATION_ID}`),
      context("admin", "zeno", "conversations", CONVERSATION_ID),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "conversation_not_found" });
  });

  it("reports a backend that does not serve Jarvis Mode as needing an upgrade", async () => {
    state.respond = () => json({ detail: "Not Found" }, 404);
    const response = await route.GET(getRequest("/api/broka/admin/zeno/status"), context("admin", "zeno", "status"));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "endpoint_unavailable" });
  });

  it("replaces a permission error's text with the approved message", async () => {
    state.respond = () => json({ detail: "Missing permission: admin_summary" }, 403);
    const response = await route.GET(getRequest("/api/broka/admin/zeno/status"), context("admin", "zeno", "status"));
    const body = (await response.json()) as { code: string; message: string };
    expect(response.status).toBe(403);
    expect(body.code).toBe("forbidden");
    expect(body.message).not.toMatch(/permission/i);
  });

  it("passes a rate limit's Retry-After through only as a bounded number of seconds", async () => {
    state.respond = () => json({ detail: "Too many admin_zeno attempts." }, 429, { "Retry-After": "60" });
    const limited = await route.POST(
      postRequest("/api/broka/admin/zeno/chat", { message: "Revenue?" }),
      context("admin", "zeno", "chat"),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(await limited.json()).toMatchObject({ code: "rate_limited" });

    state.respond = () => json({ detail: "Too many" }, 429, { "Retry-After": "86400000" });
    const huge = await route.POST(
      postRequest("/api/broka/admin/zeno/chat", { message: "Revenue?" }),
      context("admin", "zeno", "chat"),
    );
    expect(huge.headers.get("retry-after")).toBeNull();
  });

  it("ends the session when the backend refuses the token", async () => {
    state.respond = () => json({ detail: "Not authenticated" }, 401);
    const response = await route.GET(getRequest("/api/broka/admin/zeno/status"), context("admin", "zeno", "status"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
    expect((response.headers.get("set-cookie") ?? "").toLowerCase()).toContain("max-age=0");
  });

  it("refuses a read whose payload does not match the contract", async () => {
    state.respond = () => json({ ...briefingFixture(), forecast: [] });
    const response = await route.GET(getRequest("/api/broka/admin/zeno/briefing"), context("admin", "zeno", "briefing"));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "contract_validation_failed" });
  });

  it("refuses a status read that is missing a required field", async () => {
    const incomplete: Record<string, unknown> = { ...statusFixture() };
    delete incomplete.model_gateway_ready;
    state.respond = () => json(incomplete);
    const response = await route.GET(getRequest("/api/broka/admin/zeno/status"), context("admin", "zeno", "status"));
    expect(response.status).toBe(502);
  });

  it("refreshes an expired access token once, retries the read and sets the new cookies", async () => {
    state.cookies = { broka_admin_access: "expired", broka_admin_refresh: "refresh-1" };
    let reads = 0;
    state.respond = (path) => {
      if (path === "/auth/token/refresh") {
        return json({ access_token: "fresh-access", refresh_token: "fresh-refresh", token_type: "bearer" });
      }
      reads += 1;
      return reads === 1 ? json({ detail: "expired" }, 401) : json(statusFixture());
    };
    const response = await route.GET(getRequest("/api/broka/admin/zeno/status"), context("admin", "zeno", "status"));
    expect(response.status).toBe(200);
    expect(upstreamCalls("/admin/zeno/status").map((call) => call.token)).toEqual(["expired", "fresh-access"]);
    expect(response.headers.get("set-cookie") ?? "").toContain("broka_admin_access=fresh-access");
  });
});

describe("POST /admin/zeno/chat", () => {
  it("forwards a validated question with its context and returns the validated answer", async () => {
    state.respond = () => json(chatResponseFixture());
    const response = await route.POST(
      postRequest("/api/broka/admin/zeno/chat", { message: "  Why did replies fall?  ", context: { period_days: 7 } }),
      context("admin", "zeno", "chat"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ conversation_id: CONVERSATION_ID });
    const [call] = upstreamCalls("/admin/zeno/chat");
    expect(call).toMatchObject({ method: "POST", token: "access-token" });
    expect(JSON.parse(call.body ?? "{}")).toEqual({
      message: "Why did replies fall?",
      context: { period_days: 7 },
    });
  });

  it("continues an existing conversation with its id", async () => {
    state.respond = () => json(chatResponseFixture());
    await route.POST(
      postRequest("/api/broka/admin/zeno/chat", { conversation_id: CONVERSATION_ID, message: "And by seller?" }),
      context("admin", "zeno", "chat"),
    );
    expect(JSON.parse(upstreamCalls("/admin/zeno/chat")[0].body ?? "{}")).toMatchObject({
      conversation_id: CONVERSATION_ID,
    });
  });

  it("drops a query string on the request so no unchecked parameter reaches the backend", async () => {
    state.respond = () => json(chatResponseFixture());
    await route.POST(
      new Request(`${ORIGIN}/api/broka/admin/zeno/chat?admin_id=someone-else`, {
        method: "POST",
        headers: { origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ message: "Revenue?" }),
      }),
      context("admin", "zeno", "chat"),
    );
    expect(upstreamCalls("/admin/zeno/chat")).toHaveLength(1);
  });

  it.each([
    ["an unknown field", { message: "Hi", admin_id: "someone-else" }],
    ["a blank question", { message: "   " }],
    ["a question over the limit", { message: "x".repeat(2001) }],
    ["a malformed conversation id", { message: "Hi", conversation_id: "../../x" }],
    ["a context period over 90 days", { message: "Hi", context: { period_days: 91 } }],
  ])("refuses %s before it is sent upstream", async (_label, body) => {
    const response = await route.POST(postRequest("/api/broka/admin/zeno/chat", body), context("admin", "zeno", "chat"));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "validation_failed" });
    expect(state.calls).toHaveLength(0);
  });

  it("refuses a cross-origin request before reading the body", async () => {
    const response = await route.POST(
      postRequest("/api/broka/admin/zeno/chat", { message: "Hi" }, { origin: "https://evil.example" }),
      context("admin", "zeno", "chat"),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "csrf_origin_mismatch" });
    expect(state.calls).toHaveLength(0);
  });

  it("requires a session", async () => {
    state.cookies = {};
    const response = await route.POST(postRequest("/api/broka/admin/zeno/chat", { message: "Hi" }), context("admin", "zeno", "chat"));
    expect(response.status).toBe(401);
    expect(state.calls).toHaveLength(0);
  });

  it("answers an unknown conversation with a 404 and the approved message", async () => {
    state.respond = () => json({ detail: "Conversation not found" }, 404);
    const response = await route.POST(
      postRequest("/api/broka/admin/zeno/chat", { conversation_id: CONVERSATION_ID, message: "Hi" }),
      context("admin", "zeno", "chat"),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "conversation_not_found" });
  });

  it.each([
    ["ADMIN_ZENO_DISABLED", 503, "Jarvis Mode is not enabled on this deployment."],
    [
      "MODEL_CONTEXT_UNSAFE",
      503,
      "This question could not be prepared safely for the model. Remove personal details or ask about aggregate figures.",
    ],
    ["MODEL_UNAVAILABLE", 503, "The intelligence model is unavailable. No answer was generated."],
    ["INVESTIGATION_TIMEOUT", 504, "The investigation took too long. Try a narrower question."],
  ])("relays %s with its approved message and status %i", async (code, status, message) => {
    state.respond = () => json({ detail: { code, message: "Provider text: sk-live-secret-123 at 10.0.0.4" } }, status);
    const response = await route.POST(postRequest("/api/broka/admin/zeno/chat", { message: "Hi" }), context("admin", "zeno", "chat"));
    const body = (await response.json()) as { code: string; message: string };
    expect(response.status).toBe(status);
    expect(body).toMatchObject({ code, message });
    expect(JSON.stringify(body)).not.toMatch(/sk-live|10\.0\.0\.4/);
  });

  it("refuses a successful reply that does not match the answer contract", async () => {
    state.respond = () => json({ ...chatResponseFixture(), investigation: { synthesis: "improvised" } });
    const response = await route.POST(postRequest("/api/broka/admin/zeno/chat", { message: "Hi" }), context("admin", "zeno", "chat"));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "contract_validation_failed" });
  });
});

describe("DELETE /admin/zeno/conversations/{id}", () => {
  it("forwards the deletion of the administrator's own conversation", async () => {
    state.respond = () => json({ deleted: true, id: CONVERSATION_ID });
    const response = await route.DELETE(
      deleteRequest(`/api/broka/admin/zeno/conversations/${CONVERSATION_ID}`),
      context("admin", "zeno", "conversations", CONVERSATION_ID),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, id: CONVERSATION_ID });
    expect(upstreamCalls(`/admin/zeno/conversations/${CONVERSATION_ID}`)[0]).toMatchObject({
      method: "DELETE",
      token: "access-token",
    });
  });

  it.each([
    ["the status read", ["admin", "zeno", "status"]],
    ["the conversation list", ["admin", "zeno", "conversations"]],
    ["an unrelated administrative resource", ["admin", "users", CONVERSATION_ID]],
    ["a conversation id that is not a UUID", ["admin", "zeno", "conversations", "conv-1"]],
    ["a dot segment", ["admin", "zeno", "conversations", UNSAFE_ID]],
    ["a nested path under a conversation", ["admin", "zeno", "conversations", CONVERSATION_ID, "turns"]],
  ])("refuses a DELETE to %s", async (_label, segments) => {
    const response = await route.DELETE(deleteRequest(`/api/broka/${segments.join("/")}`), context(...segments));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "mutation_not_allowlisted" });
    expect(state.calls).toHaveLength(0);
  });

  it("refuses a cross-origin deletion", async () => {
    const response = await route.DELETE(
      deleteRequest(`/api/broka/admin/zeno/conversations/${CONVERSATION_ID}`, "https://evil.example"),
      context("admin", "zeno", "conversations", CONVERSATION_ID),
    );
    expect(response.status).toBe(403);
    expect(state.calls).toHaveLength(0);
  });

  it("refuses a deletion with no origin at all", async () => {
    const response = await route.DELETE(
      deleteRequest(`/api/broka/admin/zeno/conversations/${CONVERSATION_ID}`, null),
      context("admin", "zeno", "conversations", CONVERSATION_ID),
    );
    expect(response.status).toBe(403);
    expect(state.calls).toHaveLength(0);
  });

  it("requires a session", async () => {
    state.cookies = {};
    const response = await route.DELETE(
      deleteRequest(`/api/broka/admin/zeno/conversations/${CONVERSATION_ID}`),
      context("admin", "zeno", "conversations", CONVERSATION_ID),
    );
    expect(response.status).toBe(401);
    expect(state.calls).toHaveLength(0);
  });

  it("reports a conversation that is already gone as not found", async () => {
    state.respond = () => json({ detail: "Conversation not found" }, 404);
    const response = await route.DELETE(
      deleteRequest(`/api/broka/admin/zeno/conversations/${CONVERSATION_ID}`),
      context("admin", "zeno", "conversations", CONVERSATION_ID),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "conversation_not_found" });
  });

  it("refuses a deletion result that does not confirm the deletion", async () => {
    state.respond = () => json({ deleted: false, id: CONVERSATION_ID });
    const response = await route.DELETE(
      deleteRequest(`/api/broka/admin/zeno/conversations/${CONVERSATION_ID}`),
      context("admin", "zeno", "conversations", CONVERSATION_ID),
    );
    expect(response.status).toBe(502);
  });
});

describe("method surface", () => {
  it("exports only the methods the proxy supports", () => {
    expect(route).toHaveProperty("GET");
    expect(route).toHaveProperty("POST");
    expect(route).toHaveProperty("PATCH");
    expect(route).toHaveProperty("DELETE");
    expect(route).not.toHaveProperty("PUT");
  });
});
