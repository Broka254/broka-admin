// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  accessToken: "access-token" as string | undefined,
  upstreamResponse: null as Response | null,
  upstreamCalls: [] as Array<{ path: string; method?: string; headers?: HeadersInit; body?: BodyInit | null; token?: string }>,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "broka_admin_access" && state.accessToken ? { value: state.accessToken } : undefined),
  }),
}));

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return {
    ...actual,
    upstreamFetch: vi.fn(async (path: string, init: RequestInit = {}, token?: string) => {
      state.upstreamCalls.push({ path, method: init.method, headers: init.headers, body: init.body, token });
      return state.upstreamResponse ?? new Response("{}", { status: 200 });
    }),
    refreshAccessToken: vi.fn(),
  };
});

import { POST, PATCH } from "@/app/api/broka/[...path]/route";

const SEND = ["admin", "email", "send"];
const KEY = "0123456789abcdef";
const good = { to: "wanjiru@example.com", subject: "Re: your complaint", message: "Hello Wanjiru" };
const sent = { status: "sent", message_id: "re_msg_1", sender: "Broka Admin <admin@broka.co.ke>", reply_to: "admin@broka.co.ke" };

function context(...segments: string[]) {
  return { params: Promise.resolve({ path: segments }) };
}

function sendRequest(body: unknown, options: { key?: string | null; origin?: string | null; path?: string[] } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.origin !== null) headers.origin = options.origin ?? "http://localhost";
  if (options.key !== null) headers["X-Idempotency-Key"] = options.key ?? KEY;
  return new Request(`http://localhost/api/broka/${(options.path ?? SEND).join("/")}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function backend(status: number, body: unknown) {
  state.upstreamResponse = new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("POST /api/broka/admin/email/send", () => {
  beforeEach(() => {
    state.accessToken = "access-token";
    state.upstreamCalls = [];
    backend(200, sent);
  });

  it("forwards one validated request with the session token and the key, and nothing else", async () => {
    const response = await POST(sendRequest({ ...good, to: "  wanjiru@example.com " }), context(...SEND));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(sent);
    expect(state.upstreamCalls).toHaveLength(1);
    const call = state.upstreamCalls[0];
    expect(call).toMatchObject({ path: "/admin/email/send", method: "POST", token: "access-token" });
    expect(new Headers(call.headers).get("X-Idempotency-Key")).toBe(KEY);
    expect(JSON.parse(String(call.body))).toEqual(good);
  });

  it.each([
    { from: "ceo@broka.co.ke" },
    { sender: "x@y.com" },
    { reply_to: "x@y.com" },
    { html: "<b>x</b>" },
    { cc: "x@y.com" },
    { bcc: "x@y.com" },
  ])("refuses a request that names %j and never forwards it", async (extra) => {
    const response = await POST(sendRequest({ ...good, ...extra }), context(...SEND));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "validation_failed" });
    expect(state.upstreamCalls).toHaveLength(0);
  });

  it.each([
    { to: "nope" },
    { to: "a@b.com,c@d.com" },
    { subject: "a\nBcc: x@y.com" },
    { subject: "" },
    { message: "  " },
    { message: "x".repeat(10_001) },
  ])("refuses invalid input %j before the backend", async (bad) => {
    const response = await POST(sendRequest({ ...good, ...bad }), context(...SEND));
    expect(response.status).toBe(422);
    expect(state.upstreamCalls).toHaveLength(0);
  });

  it("requires an idempotency key of 8 to 128 characters", async () => {
    const missing = await POST(sendRequest(good, { key: null }), context(...SEND));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ code: "idempotency_key_required" });
    const short = await POST(sendRequest(good, { key: "short" }), context(...SEND));
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ code: "invalid_idempotency_key" });
    expect(state.upstreamCalls).toHaveLength(0);
  });

  it("needs a session, and a request from this application", async () => {
    state.accessToken = undefined;
    const signedOut = await POST(sendRequest(good), context(...SEND));
    expect(signedOut.status).toBe(401);
    state.accessToken = "access-token";
    const foreign = await POST(sendRequest(good, { origin: "https://evil.example" }), context(...SEND));
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toMatchObject({ code: "csrf_origin_mismatch" });
    expect(state.upstreamCalls).toHaveLength(0);
  });

  it.each([
    ["admin", "email", "send", "extra"],
    ["admin", "email"],
    ["admin", "email", "inbox"],
    ["admin", "email", "..", "send"],
    ["admin", "emails", "send"],
  ])("allowlists exactly this path and no other: %j", async (...segments) => {
    const response = await POST(sendRequest(good, { path: segments }), context(...segments));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "mutation_not_allowlisted" });
    expect(state.upstreamCalls).toHaveLength(0);
  });

  it("allowlists POST only", async () => {
    const request = new Request("http://localhost/api/broka/admin/email/send", {
      method: "PATCH",
      headers: { origin: "http://localhost", "content-type": "application/json", "X-Idempotency-Key": KEY },
      body: JSON.stringify(good),
    });
    expect((await PATCH(request, context(...SEND))).status).toBe(404);
    expect(state.upstreamCalls).toHaveLength(0);
  });

  it.each([
    { status: "queued", message_id: "x", sender: "s", reply_to: "r" },
    { status: "sent" },
    "sent",
  ])("turns an answer that breaks the contract into a 502 (%j)", async (drifted) => {
    backend(200, drifted);
    const response = await POST(sendRequest(good), context(...SEND));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "contract_validation_failed" });
  });

  describe("failures the backend names", () => {
    it.each([
      [503, "email_not_configured", "Email sending is not configured on this server."],
      [422, "email_rejected", "The email provider rejected this message. Check the recipient address and try again."],
      [502, "email_sender_refused", "The email provider refused BROKA's sender. Check the Resend API key and that the sending domain is verified in Resend."],
      [409, "email_duplicate_request", "This request key is already in use for a message that is still being sent, or for a different message."],
      [429, "email_provider_limit", "The email provider's sending limit was reached. Try again later."],
      [502, "email_provider_unavailable", "The email provider is unavailable or did not respond, so this message may not have been sent. Retrying is safe: the same request is never sent twice."],
    ])("relays a %i %s with its fixed message", async (status, code, detail) => {
      backend(status, { detail, code });
      const response = await POST(sendRequest(good), context(...SEND));
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ code, message: detail });
    });

    it.each([
      { detail: "Traceback: sqlite3.OperationalError at /srv/api/secret.py" },
      { detail: "boom", code: "DB_UNAVAILABLE" },
      { detail: "Traceback at /srv/secret.py", code: "something_else" },
      { detail: "Traceback at /srv/secret.py", code: ["email_rejected"] },
      { code: "email_provider_unavailable" },
      { detail: { nested: "Traceback" }, code: "email_provider_unavailable" },
    ])("still masks a 5xx that does not carry a listed code and a message (%j)", async (body) => {
      backend(502, body);
      const response = await POST(sendRequest(good), context(...SEND));
      const payload = (await response.json()) as { code: string; message: string };
      expect(response.status).toBe(502);
      expect(payload.code).toBe("upstream_error");
      expect(payload.message).not.toMatch(/traceback|secret\.py|sqlite/i);
      expect(payload.message).toMatch(/temporarily unavailable/i);
    });

    it("caps a relayed message at 300 characters", async () => {
      backend(502, { detail: "x".repeat(2000), code: "email_provider_unavailable" });
      const payload = (await (await POST(sendRequest(good), context(...SEND))).json()) as { message: string };
      expect(payload.message).toHaveLength(300);
    });

    it("treats a 401 as a signed-out session (the backend never uses it for a provider failure)", async () => {
      backend(401, { detail: "Invalid or expired token" });
      const response = await POST(sendRequest(good), context(...SEND));
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: "unauthorized" });
    });
  });

  describe("other operations are unchanged", () => {
    const preview = ["admin", "communications", "preview"];
    const previewBody = { audience: { kind: "all" } };

    it.each([[422, "validation_failed"], [409, "conflict"], [403, "forbidden"], [400, "upstream_error"]])(
      "relays a %i detail with the status-derived code, ignoring an email code",
      async (status, code) => {
        backend(status, { detail: "Audience too large", code: "email_rejected" });
        const response = await POST(sendRequest(previewBody, { key: null, path: preview }), context(...preview));
        expect(response.status).toBe(status);
        expect(await response.json()).toMatchObject({ code, message: "Audience too large" });
      },
    );

    it("masks a 5xx even when it carries an email code", async () => {
      backend(502, { detail: "Traceback /srv/x.py", code: "email_provider_unavailable" });
      const response = await POST(sendRequest(previewBody, { key: null, path: preview }), context(...preview));
      const payload = (await response.json()) as { code: string; message: string };
      expect(payload.code).toBe("upstream_error");
      expect(payload.message).not.toMatch(/traceback/i);
    });

    it("still reports a 404 as an endpoint the backend does not serve", async () => {
      backend(404, { detail: "Not Found" });
      const response = await POST(sendRequest(good), context(...SEND));
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: "endpoint_unavailable", message: expect.stringMatching(/does not serve this endpoint/i) });
    });
  });
});
