// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogFixture, definitionFixture, operationsFixture, payloadFixture, runDetailFixture, specFixture } from "./fixtures/report-builder";

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

import { GET, PATCH, POST } from "@/app/api/broka/[...path]/route";
import { GET as PDF } from "@/app/api/broka/report-builder/runs/[runId]/pdf/route";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function context(...segments: string[]) {
  return { params: Promise.resolve({ path: segments }) };
}

function mutation(method: "POST" | "PATCH", url: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const builderSpec = { title: "Weekly business review", categories: ["growth"], last_days: 7, comparison: "previous_period",
  filters: { category: null, county: null }, group_by: "day", visualization: "auto" };

beforeEach(() => {
  state.cookies = { broka_admin_access: "access-token" };
  state.calls = [];
  state.respond = () => json({});
});

describe("report builder reads", () => {
  it("serves the catalog and operations through their contracts", async () => {
    state.respond = (path) => path.startsWith("/admin/operations") ? json(operationsFixture()) : json(catalogFixture);
    const catalog = await GET(new Request("http://localhost/api/broka/admin/report-builder/catalog"), context("admin", "report-builder", "catalog"));
    expect(catalog.status).toBe(200);
    expect((await catalog.json()).limits.max_range_days).toBe(366);
    const ops = await GET(new Request("http://localhost/api/broka/admin/operations?window_hours=6"), context("admin", "operations"));
    expect(ops.status).toBe(200);
    expect(state.calls.at(-1)?.path).toBe("/admin/operations?window_hours=6");
  });

  it("refuses a payload that breaks the contract", async () => {
    state.respond = () => json({ ...runDetailFixture, payload: { ...payloadFixture, kpis: [{ key: "x" }] } });
    const response = await GET(new Request("http://localhost/api/broka/admin/report-builder/runs/run-1"), context("admin", "report-builder", "runs", "run-1"));
    expect(response.status).toBe(502);
  });
});

describe("report builder writes", () => {
  it("forwards a preview spec exactly and validates the answer", async () => {
    state.respond = () => json({ id: null, stored: false, title: "Weekly business review", spec: specFixture, payload: payloadFixture });
    const response = await POST(mutation("POST", "/api/broka/admin/report-builder/preview", builderSpec), context("admin", "report-builder", "preview"));
    expect(response.status).toBe(200);
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toMatchObject({ path: "/admin/report-builder/preview", method: "POST", token: "access-token" });
    expect(JSON.parse(state.calls[0].body ?? "{}")).toEqual(builderSpec);
  });

  it("refuses fields the spec does not have before calling the API", async () => {
    const response = await POST(mutation("POST", "/api/broka/admin/report-builder/preview", { ...builderSpec, sql: "1" }), context("admin", "report-builder", "preview"));
    expect(response.status).toBe(422);
    expect(state.calls).toHaveLength(0);
  });

  it("regenerates and runs with no body, and edits only with a version", async () => {
    state.respond = () => json(runDetailFixture);
    const regen = await POST(mutation("POST", "/api/broka/admin/report-builder/runs/run-1/regenerate"), context("admin", "report-builder", "runs", "run-1", "regenerate"));
    expect(regen.status).toBe(200);
    expect(state.calls[0]).toMatchObject({ path: "/admin/report-builder/runs/run-1/regenerate", method: "POST" });
    expect(state.calls[0].body).toBeUndefined();

    const stale = await PATCH(mutation("PATCH", "/api/broka/admin/report-builder/definitions/def-1", { enabled: false }), context("admin", "report-builder", "definitions", "def-1"));
    expect(stale.status).toBe(422);
    state.respond = () => json({ ...definitionFixture, enabled: false, version: 2 });
    const paused = await PATCH(mutation("PATCH", "/api/broka/admin/report-builder/definitions/def-1", { expected_version: 1, enabled: false }), context("admin", "report-builder", "definitions", "def-1"));
    expect(paused.status).toBe(200);

    state.respond = () => json({ id: "def-1", deleted: true });
    const gone = await POST(mutation("POST", "/api/broka/admin/report-builder/definitions/def-1/delete"), context("admin", "report-builder", "definitions", "def-1", "delete"));
    expect(gone.status).toBe(200);
  });

  it("relays the backend's reason for a refused spec", async () => {
    state.respond = () => json({ detail: "a report covers at most 366 days" }, 422);
    const response = await POST(mutation("POST", "/api/broka/admin/report-builder/runs", { spec: builderSpec }), context("admin", "report-builder", "runs"));
    expect(response.status).toBe(422);
    expect((await response.json()).message).toContain("at most 366 days");
  });

  it("does not let a path step outside the builder", async () => {
    const response = await POST(mutation("POST", "/api/broka/admin/report-builder/runs/../definitions"), context("admin", "report-builder", "runs", "..", "definitions"));
    expect(response.status).toBe(404);
    expect(state.calls).toHaveLength(0);
  });
});

describe("PDF download", () => {
  function pdfRequest(id: string) {
    return PDF(new Request(`http://localhost/api/broka/report-builder/runs/${id}/pdf`), { params: Promise.resolve({ runId: id }) });
  }

  it("relays the PDF with its file name", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 test");
    state.respond = () => new Response(bytes, { status: 200, headers: {
      "content-type": "application/pdf", "content-disposition": 'attachment; filename="broka-weekly-business-review-2025-03-01.pdf"' } });
    const response = await pdfRequest("run-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="broka-weekly-business-review-2025-03-01.pdf"');
    expect(new TextDecoder().decode(await response.arrayBuffer())).toBe("%PDF-1.4 test");
    expect(state.calls[0]).toMatchObject({ path: "/admin/report-builder/runs/run-1/pdf", token: "access-token" });
  });

  it("refuses something that is not a PDF, and a file name it does not recognise", async () => {
    state.respond = () => json({ hello: "world" });
    expect((await pdfRequest("run-1")).status).toBe(502);
    state.respond = () => new Response(new TextEncoder().encode("%PDF-1.4"), { status: 200, headers: {
      "content-type": "application/pdf", "content-disposition": 'attachment; filename="../../etc/passwd"' } });
    const renamed = await pdfRequest("run-1");
    expect(renamed.headers.get("content-disposition")).toBe('attachment; filename="broka-report.pdf"');
  });

  it("needs a session and a real id, and explains a failed build", async () => {
    expect((await pdfRequest("..")).status).toBe(404);
    state.respond = () => json({ detail: "failed" }, 409);
    const failed = await pdfRequest("run-2");
    expect(failed.status).toBe(409);
    expect((await failed.json()).message).toBe("This report failed to build; regenerate it first.");
    state.cookies = {};
    expect((await pdfRequest("run-1")).status).toBe(401);
  });
});
