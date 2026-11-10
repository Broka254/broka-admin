// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { feedbackItemFixture, reportDetailFixture } from "./fixtures/intelligence";

type Call = { path: string; method?: string; body?: string; token?: string };

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
      state.calls.push({ path, method: init.method, body: typeof init.body === "string" ? init.body : undefined, token });
      return state.respond(path, init);
    }),
  };
});

import { hasDotSegment, isSafeAdminPath } from "@/lib/api/admin";
import { refreshAccessToken } from "@/lib/api/auth";
import { GET, PATCH, POST } from "@/app/api/broka/[...path]/route";
import { POST as USER_ACTION } from "@/app/api/broka/users/[userId]/[action]/route";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function context(...segments: string[]) {
  return { params: Promise.resolve({ path: segments }) };
}

function mutation(method: "POST" | "PATCH", url: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function upstream(path: string): Call[] {
  return state.calls.filter((call) => call.path === path);
}

beforeEach(() => {
  state.cookies = { broka_admin_access: "access-token" };
  state.calls = [];
  state.respond = () => json({});
});

describe("allowlist", () => {
  it("serves the intelligence, report and complaint reads, and refuses dot segments", async () => {
    for (const path of [
      "admin/intelligence/pulse", "admin/intelligence/insights", "admin/intelligence/categories", "admin/intelligence/geography",
      "admin/intelligence/funnel", "admin/intelligence/cohorts", "admin/intelligence/sellers",
      "admin/reports", "admin/reports/preview", "admin/reports/rep-1", "admin/feedback", "admin/feedback/stats", "admin/feedback/fb-1",
    ]) expect(isSafeAdminPath(path), path).toBe(true);
    expect(isSafeAdminPath("admin/reports/..")).toBe(false);
    expect(isSafeAdminPath("admin/feedback/%2e%2e")).toBe(false);
    expect(isSafeAdminPath("admin/reports/rep-1/extra")).toBe(false);
    expect(hasDotSegment("admin/communications/%2E%2E/cancel")).toBe(true);

    const read = await GET(new Request("http://localhost/api/broka/admin/feedback/.."), context("admin", "feedback", ".."));
    expect(read.status).toBe(404);
    const write = await PATCH(mutation("PATCH", "/api/broka/admin/communications/../cancel", { status: "resolved" }), context("admin", "communications", "..", "cancel"));
    expect(write.status).toBe(404);
    expect(await write.json()).toMatchObject({ code: "mutation_not_allowlisted" });
    expect(state.calls).toHaveLength(0);
  });
});

describe("complaint triage through the proxy", () => {
  it("forwards only the validated body, never the browser's query string", async () => {
    state.respond = () => json({ ...feedbackItemFixture, status: "resolved", admin_response: "Sorted", notified_devices: 2 });
    const response = await PATCH(
      mutation("PATCH", "/api/broka/admin/feedback/fb-1?user_id=someone-else&notify=false", { status: "resolved", admin_response: "Sorted" }),
      context("admin", "feedback", "fb-1"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "resolved", notified_devices: 2 });
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toMatchObject({ path: "/admin/feedback/fb-1", method: "PATCH", token: "access-token" });
    expect(JSON.parse(state.calls[0]?.body ?? "{}")).toEqual({ status: "resolved", admin_response: "Sorted" });
  });

  it("rejects fields the triage contract does not have", async () => {
    const response = await PATCH(mutation("PATCH", "/api/broka/admin/feedback/fb-1", { status: "resolved", user_id: "someone" }), context("admin", "feedback", "fb-1"));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "validation_failed" });
    expect(state.calls).toHaveLength(0);
  });

  it("passes an empty 204 success through instead of failing to parse it", async () => {
    state.respond = () => new Response(null, { status: 204 });
    const response = await PATCH(mutation("PATCH", "/api/broka/admin/feedback/fb-1", { status: "closed" }), context("admin", "feedback", "fb-1"));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });
});

describe("report generation through the proxy", () => {
  it("forwards a valid request and validates the stored report it returns", async () => {
    state.respond = () => json(reportDetailFixture);
    const response = await POST(mutation("POST", "/api/broka/admin/reports/generate", { kind: "weekly", period_date: "2026-11-03" }), context("admin", "reports", "generate"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "rep-1", stored: true });
    expect(JSON.parse(state.calls[0]?.body ?? "{}")).toEqual({ kind: "weekly", period_date: "2026-11-03" });
  });

  it("refuses unknown kinds before calling the API, and a malformed reply after", async () => {
    const bad = await POST(mutation("POST", "/api/broka/admin/reports/generate", { kind: "yearly" }), context("admin", "reports", "generate"));
    expect(bad.status).toBe(422);
    expect(state.calls).toHaveLength(0);

    state.respond = () => json({ id: "rep-1" });
    const malformed = await POST(mutation("POST", "/api/broka/admin/reports/generate", { kind: "daily" }), context("admin", "reports", "generate"));
    expect(malformed.status).toBe(502);
    expect(await malformed.json()).toMatchObject({ code: "contract_validation_failed" });
  });
});

describe("session refresh", () => {
  it("refreshes up front when only the refresh cookie is left", async () => {
    state.cookies = { broka_admin_refresh: "refresh-only-1" };
    state.respond = (path) => path === "/auth/token/refresh"
      ? json({ access_token: "fresh-access", refresh_token: "fresh-refresh", token_type: "bearer" })
      : json({ items: [], total: 0, limit: 25, offset: 0 });
    const response = await GET(new Request("http://localhost/api/broka/admin/feedback"), context("admin", "feedback"));
    expect(response.status).toBe(200);
    expect(upstream("/auth/token/refresh")).toHaveLength(1);
    expect(upstream("/admin/feedback")[0]?.token).toBe("fresh-access");
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain("broka_admin_access=fresh-access");
    expect(cookies).toContain("broka_admin_refresh=fresh-refresh");
  });

  it("ends the session, with the cookies' own attributes, when the refresh token is refused", async () => {
    // The production (embedded, HTTPS) setting; CI itself runs with secure cookies off.
    vi.stubEnv("BROKA_COOKIE_SECURE", "true");
    try {
      state.cookies = { broka_admin_refresh: "refresh-revoked-1" };
      state.respond = (path) => path === "/auth/token/refresh" ? json({ detail: "Invalid refresh token" }, 401) : json({});
      const response = await GET(new Request("http://localhost/api/broka/admin/feedback/stats"), context("admin", "feedback", "stats"));
      expect(response.status).toBe(401);
      expect(upstream("/admin/feedback/stats")).toHaveLength(0);
      const cookies = (response.headers.get("set-cookie") ?? "").toLowerCase();
      expect(cookies).toContain("broka_admin_access=;");
      expect(cookies).toContain("broka_admin_refresh=;");
      expect(cookies).toContain("max-age=0");
      // A bare delete sends neither; the embedded browser then ignores it.
      expect(cookies).toContain("samesite=none");
      expect(cookies).toContain("secure");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("spends a refresh token once when several requests need it at the same time", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    state.respond = () => json({ access_token: "shared-access", token_type: "bearer" });
    const { upstreamFetch } = await import("@/lib/api/client");
    vi.mocked(upstreamFetch).mockImplementationOnce(async (path: string, init: RequestInit = {}) => {
      state.calls.push({ path, method: init.method });
      await gate;
      return json({ access_token: "shared-access", token_type: "bearer" });
    });
    const first = refreshAccessToken("refresh-concurrent-1");
    const second = refreshAccessToken("refresh-concurrent-1");
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(a.accessToken).toBe("shared-access");
    expect(b.accessToken).toBe("shared-access");
    expect(upstream("/auth/token/refresh")).toHaveLength(1);
  });
});

describe("user action route", () => {
  function action(userId: string, name: string, body: unknown = { reason: "Repeated complaints" }) {
    const request = new Request(`http://localhost/api/broka/users/${userId}/${name}`, {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json", "idempotency-key": "key-1234567890abcdef" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    return USER_ACTION(request, { params: Promise.resolve({ userId, action: name }) });
  }

  it("resolves only its own allowlisted action names and real ids", async () => {
    expect((await action("user-1", "constructor")).status).toBe(404);
    expect((await action("user-1", "__proto__")).status).toBe(404);
    const dotted = await action("..", "flag");
    expect(dotted.status).toBe(404);
    expect(await dotted.json()).toMatchObject({ code: "invalid_id" });
    expect(state.calls).toHaveLength(0);
  });

  it("bounds the body and still requires a reason where the backend does", async () => {
    expect((await action("user-1", "flag", { reason: "x".repeat(9000) })).status).toBe(413);
    const missing = await action("user-1", "flag", {});
    expect(missing.status).toBe(422);
    expect(await missing.json()).toMatchObject({ code: "reason_required" });
    expect(state.calls).toHaveLength(0);
  });
});
