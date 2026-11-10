// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push, refresh: vi.fn() }),
  usePathname: () => "/complaints",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { ComplaintDrawer } from "@/components/complaints/complaint-drawer";
import { ComplaintsDesk } from "@/components/complaints/complaints-desk";
import { FeedbackAdminItemSchema } from "@/lib/api/intelligence-schemas";
import { feedbackDetailFixture, feedbackItemFixture, feedbackStatsFixture } from "./fixtures/intelligence";

type Captured = { url: string; method: string; body?: unknown };

function setup(handler: (url: string, init?: RequestInit) => Response | undefined) {
  const calls: Captured[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    return handler(url, init) ?? new Response(JSON.stringify({ message: "unexpected" }), { status: 500 });
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { calls, Wrapper };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  nav.search = "";
  nav.replace.mockReset();
  nav.push.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ComplaintDrawer", () => {
  const preview = FeedbackAdminItemSchema.parse(feedbackItemFixture);

  it("shows the case, who filed it and what it is about, with its deadline", async () => {
    const { Wrapper } = setup((url) => (url.endsWith(`/admin/feedback/${preview.id}`) ? json(feedbackDetailFixture) : undefined));
    render(<ComplaintDrawer id={preview.id} preview={preview} onClose={() => undefined} />, { wrapper: Wrapper });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Seller asked me to pay outside the app" })).toBeInTheDocument();
    expect(within(dialog).getByText("#3F2A9C")).toBeInTheDocument();
    expect(within(dialog).getByText("Overdue by 2h")).toBeInTheDocument();
    expect(within(dialog).getByText("Wanjiru Reporter")).toBeInTheDocument();
    expect(await within(dialog).findByText("iPhone 13 128GB")).toBeInTheDocument();
    expect(within(dialog).getByText(/3 complaints about them \(2 open\)/)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "All about them" })).toHaveAttribute("href", "/complaints?about=user-7&queue=all");
    expect(within(dialog).getByRole("link", { name: "Call +254700000001" })).toHaveAttribute("href", "tel:+254700000001");
  });

  it("sends a templated reply with its status and reports where it was delivered", async () => {
    const { calls, Wrapper } = setup((url, init) => {
      if (init?.method === "PATCH") {
        return json({ ...feedbackItemFixture, status: "in_progress", admin_response: "On it", responded_at: "2026-11-10T08:00:00Z", notified_devices: 1 });
      }
      return url.includes("/admin/feedback/") ? json(feedbackDetailFixture) : undefined;
    });
    render(<ComplaintDrawer id={preview.id} preview={preview} onClose={() => undefined} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole("button", { name: "We're on it" }));
    expect(screen.getByLabelText("Status")).toHaveValue("in_progress");
    expect(screen.getByLabelText("Push notification preview")).toHaveTextContent("BROKA replied to your complaint");
    fireEvent.click(screen.getByRole("button", { name: /Send reply & update/ }));

    expect(await screen.findByText(/Pushed to 1 device\./)).toBeInTheDocument();
    const patch = calls.find((call) => call.method === "PATCH");
    expect(patch?.url).toBe(`/api/broka/admin/feedback/${encodeURIComponent(preview.id)}`);
    expect(patch?.body).toEqual({
      status: "in_progress",
      admin_response: "Thank you for telling us. A member of the BROKA team is looking into this now and will update you here.",
    });
  });

  it("will not send an empty update, and Escape closes it", async () => {
    const onClose = vi.fn();
    const { calls, Wrapper } = setup((url) => (url.includes("/admin/feedback/") ? json(feedbackDetailFixture) : undefined));
    render(<ComplaintDrawer id={preview.id} preview={preview} onClose={onClose} />, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reply to the reporter"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(calls.some((call) => call.method === "PATCH")).toBe(false);
  });
});

describe("ComplaintsDesk", () => {
  it("lists the queue most urgent first with deadlines, and opens a case in place", async () => {
    nav.search = "queue=overdue";
    const { calls, Wrapper } = setup((url) => {
      if (url.includes("/admin/feedback/stats")) return json(feedbackStatsFixture);
      if (url.includes("/admin/feedback?")) return json({ items: [feedbackItemFixture], total: 1, limit: 25, offset: 0 });
      if (url.includes("/admin/feedback/")) return json(feedbackDetailFixture);
      return undefined;
    });
    render(<ComplaintsDesk />, { wrapper: Wrapper });

    const row = await screen.findByTestId(`complaint-row-${feedbackItemFixture.id}`);
    expect(within(row).getByText("Overdue by 2h")).toBeInTheDocument();
    expect(within(row).getByText("Urgent")).toBeInTheDocument();
    const list = calls.find((call) => call.url.includes("/admin/feedback?"));
    expect(new URL(list?.url ?? "", "http://x").searchParams.get("queue")).toBe("overdue");
    expect(new URL(list?.url ?? "", "http://x").searchParams.get("sort")).toBe("priority");

    expect(await screen.findByText("Most-reported accounts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "3 complaints" })).toHaveAttribute("href", "/complaints?about=user-7&queue=all");

    fireEvent.click(row);
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
    const target = String(nav.replace.mock.calls[0]?.[0]);
    expect(target).toContain(`id=${feedbackItemFixture.id}`);
    expect(target).toContain("queue=overdue");
  });

  it("says when nothing is waiting", async () => {
    const { Wrapper } = setup((url) => {
      if (url.includes("/admin/feedback/stats")) return json({ ...feedbackStatsFixture, unanswered: 0, sla_breached: 0, sla_breached_urgent: 0 });
      if (url.includes("/admin/feedback?")) return json({ items: [], total: 0, limit: 25, offset: 0 });
      return undefined;
    });
    render(<ComplaintsDesk />, { wrapper: Wrapper });
    expect(await screen.findByText("Nothing is waiting for a reply.")).toBeInTheDocument();
    expect(await screen.findByText("All inside deadlines")).toBeInTheDocument();
  });
});
