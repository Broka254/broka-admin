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
      state.calls.push({ path, method: init.method, body: typeof init.body === "string" ? init.body : undefined, token });
      return state.respond(path, init);
    }),
  };
});

import { GET, POST } from "@/app/api/broka/[...path]/route";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function context(...segments: string[]) {
  return { params: Promise.resolve({ path: segments }) };
}

function post(url: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const answer = {
  question: "How many users are active right now?",
  intent: "active_now",
  refused: false,
  answer: "7 users were active in the presence window: the last 300 seconds.",
  points: [],
  citations: [{
    label: "Active users now", value: "7", period: "the last 300 seconds, sampled at 2025-06-15T12:00:00Z",
    definition: "Signed-in users whose live session sent a heartbeat inside the presence window.",
    source: "Live presence sampler (user sessions)", href: "/analytics/users",
  }],
  limitations: ["A live count is one sample taken at one moment. It is not a daily total."],
  links: [{ label: "User analytics", href: "/analytics/users" }],
  generated_at: "2025-06-15T12:00:00Z",
};

const anomalies = {
  generated_at: "2025-06-15T12:00:00Z", data_as_of: "2025-06-15T00:00:00Z", evaluated_day: "2025-06-14",
  baseline: { from: "2025-05-17T00:00:00Z", to_exclusive: "2025-06-14T00:00:00Z", days: 28, min_measured_days: 7 },
  rules: { min_samples_per_day: 720, z_threshold: 3.5, high_z: 6 },
  anomalies: [], figures: [], covered_elsewhere: [], not_covered: [],
};

beforeEach(() => {
  state.cookies = { broka_admin_access: "access-token" };
  state.calls = [];
  state.respond = () => json({});
});

describe("assistant proxy", () => {
  it("forwards a question exactly and relays a valid answer", async () => {
    state.respond = () => json(answer);
    const response = await POST(
      post("/api/broka/admin/assistant/ask", { question: "How many users are active right now?" }),
      context("admin", "assistant", "ask"),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).intent).toBe("active_now");
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toMatchObject({ path: "/admin/assistant/ask", method: "POST", token: "access-token" });
    expect(JSON.parse(state.calls[0].body ?? "{}")).toEqual({ question: "How many users are active right now?" });
  });

  it("refuses a field the question does not have before the API is called", async () => {
    const response = await POST(
      post("/api/broka/admin/assistant/ask", { question: "x", sql: "drop table users" }),
      context("admin", "assistant", "ask"),
    );
    expect(response.status).toBe(422);
    expect(state.calls).toHaveLength(0);
  });

  it("refuses an empty question", async () => {
    const response = await POST(
      post("/api/broka/admin/assistant/ask", { question: "   " }),
      context("admin", "assistant", "ask"),
    );
    expect(response.status).toBe(422);
    expect(state.calls).toHaveLength(0);
  });

  it("refuses an answer that breaks the contract", async () => {
    state.respond = () => json({ ...answer, intent: "delete_everything" });
    const response = await POST(
      post("/api/broka/admin/assistant/ask", { question: "Tell me a joke" }),
      context("admin", "assistant", "ask"),
    );
    expect(response.status).toBe(502);
  });

  it("reads the operations anomaly checks through the allowlist", async () => {
    state.respond = () => json(anomalies);
    const response = await GET(
      new Request("http://localhost/api/broka/admin/operations/anomalies"),
      context("admin", "operations", "anomalies"),
    );
    expect(response.status).toBe(200);
    expect(state.calls[0]).toMatchObject({ path: "/admin/operations/anomalies", token: "access-token" });
  });
});
