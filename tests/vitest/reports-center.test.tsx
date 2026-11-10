// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/reports",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { ReportsCenter } from "@/components/reports/reports-center";
import { reportDetailFixture } from "./fixtures/intelligence";

const meta = {
  id: reportDetailFixture.id,
  kind: reportDetailFixture.kind,
  title: reportDetailFixture.title,
  headline: reportDetailFixture.headline,
  period_start: reportDetailFixture.period_start,
  period_end: reportDetailFixture.period_end,
  period_label: reportDetailFixture.period_label,
  generated_at: reportDetailFixture.generated_at,
  generated_by: reportDetailFixture.generated_by,
  insight_counts: reportDetailFixture.insight_counts,
};

const archive = {
  items: [meta],
  total: 1,
  limit: 30,
  offset: 0,
  generated_at: "2026-11-10T08:00:00Z",
  schedule: { enabled: true, timezone: "EAT (UTC+3)", kinds: ["daily", "weekly", "monthly"] },
};

function setup() {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    if (method === "POST" && url.endsWith("/admin/reports/generate")) return new Response(JSON.stringify({ ...reportDetailFixture, id: "rep-2", generated_by: "admin-1" }), { status: 200 });
    if (url.includes("/admin/reports?")) return new Response(JSON.stringify(archive), { status: 200 });
    if (url.endsWith("/admin/reports/rep-1")) return new Response(JSON.stringify(reportDetailFixture), { status: 200 });
    return new Response(JSON.stringify({ message: "unexpected" }), { status: 500 });
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { calls, Wrapper };
}

beforeEach(() => {
  nav.search = "";
  nav.replace.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReportsCenter", () => {
  it("opens the latest stored report from the archive", async () => {
    const { calls, Wrapper } = setup();
    render(<ReportsCenter />, { wrapper: Wrapper });
    expect(await screen.findByRole("heading", { name: "Weekly founder report · 3–9 Nov 2026" })).toBeInTheDocument();
    expect(screen.getByText("Automatic · EAT (UTC+3)")).toBeInTheDocument();
    expect(screen.getByText("Liquidity (7-day buyer contact)")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Markdown/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Print \/ PDF/ })).toBeInTheDocument();
    const list = calls.find((call) => call.url.includes("/admin/reports?"));
    expect(new URL(list?.url ?? "", "http://x").searchParams.get("kind")).toBe("weekly");
  });

  it("generates the last closed period and opens what it wrote", async () => {
    const { calls, Wrapper } = setup();
    render(<ReportsCenter />, { wrapper: Wrapper });
    await screen.findByRole("heading", { name: "Weekly founder report · 3–9 Nov 2026" });
    fireEvent.click(screen.getByRole("button", { name: /^Generate$/ }));
    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true));
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({ kind: "weekly" });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/reports?id=rep-2", { scroll: false }));
  });
});
