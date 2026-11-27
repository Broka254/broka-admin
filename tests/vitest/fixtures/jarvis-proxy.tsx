import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { vi } from "vitest";

import { insightsFixture, pulseFixture } from "./intelligence";
import {
  briefingFixture,
  chatResponseFixture,
  CONVERSATION_ID,
  conversationSummaryFixture,
  statusFixture,
  turnsFixture,
} from "./jarvis";

export type Reply = { status: number; body: unknown; headers?: Record<string, string> };
export type Turn = Record<string, unknown>;
export type Conversation = { summary: Record<string, unknown>; turns: Turn[] };
export type Call = { method: string; path: string; body?: Record<string, unknown> };

/**
 * A small in-memory stand-in for the same-origin proxy. It answers the Jarvis
 * routes and the admin resources the views read, in the shapes the backend
 * uses, so the hooks run their real paging, caching and invalidation.
 */
export class FakeProxy {
  status: Reply = { status: 200, body: statusFixture() };
  briefing: Reply = { status: 200, body: briefingFixture() };
  chat: Reply | null = null;
  deleteReply: Reply | null = null;
  conversations: Conversation[] = [];
  /** Static resources by backend path. A path that is not set answers 404, which is what an older backend does. */
  resources = new Map<string, Reply>();
  calls: Call[] = [];
  private sequence = 0;

  private json(reply: Reply) {
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "content-type": "application/json", ...(reply.headers ?? {}) },
    });
  }

  private page(url: URL) {
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const all = [...this.conversations].sort((a, b) => String(b.summary.updated_at).localeCompare(String(a.summary.updated_at)));
    return {
      conversations: all.slice(offset, offset + limit).map((conversation) => ({
        ...conversation.summary,
        turn_count: conversation.turns.length,
      })),
      total: all.length,
      limit,
      offset,
    };
  }

  private detail(id: string, url: URL) {
    const conversation = this.conversations.find((item) => item.summary.id === id);
    if (!conversation) return { status: 404, body: { detail: "Conversation not found" } };
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 40);
    return {
      status: 200,
      body: {
        conversation: { ...conversation.summary, turn_count: conversation.turns.length },
        turns: conversation.turns.slice(offset, offset + limit),
        limit,
        offset,
      },
    };
  }

  private answerChat(body: Record<string, unknown>): Reply {
    this.sequence += 1;
    const message = String(body.message);
    const existing = typeof body.conversation_id === "string"
      ? this.conversations.find((item) => item.summary.id === body.conversation_id)
      : undefined;
    const id = existing ? String(existing.summary.id) : CONVERSATION_ID;
    const answer = chatResponseFixture({
      conversation_id: id,
      answer: { headline: `Answer ${this.sequence}: seller reply rate fell to 41.2%`, summary: "Down from 58%." },
    });
    const userTurn = { id: `user-${this.sequence}`, role: "user", content: message, evidence: [], metadata: {}, created_at: "2026-11-27T10:00:00" };
    const assistantTurn = {
      id: `assistant-${this.sequence}`,
      role: "assistant",
      content: `${answer.answer.headline}\n\n${answer.answer.summary}`,
      evidence: answer.evidence,
      metadata: { investigation: answer.investigation, limitations: answer.limitations },
      created_at: "2026-11-27T10:00:01",
    };
    if (existing) {
      existing.turns.push(userTurn, assistantTurn);
      existing.summary.updated_at = "2026-11-27T10:05:00";
    } else {
      this.conversations.push({
        summary: conversationSummaryFixture({ id, title: message, turn_count: 2 }),
        turns: [userTurn, assistantTurn],
      });
    }
    return { status: 200, body: answer };
  }

  handle(input: RequestInfo | URL, init?: RequestInit): Response {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    const path = url.pathname.replace("/api/broka/", "");
    this.calls.push({ method, path: `${path}${url.search}`, body });

    if (method === "GET" && path === "admin/zeno/status") return this.json(this.status);
    if (method === "GET" && path === "admin/zeno/briefing") return this.json(this.briefing);
    if (method === "GET" && path === "admin/zeno/conversations") {
      return this.json({ status: 200, body: this.page(url) });
    }
    const detailMatch = /^admin\/zeno\/conversations\/([^/]+)$/.exec(path);
    if (method === "GET" && detailMatch) {
      return this.json(this.detail(detailMatch[1], url));
    }
    if (method === "POST" && path === "admin/zeno/chat") {
      return this.json(this.chat ?? this.answerChat(body ?? {}));
    }
    if (method === "DELETE" && detailMatch) {
      const id = detailMatch[1];
      if (this.deleteReply) return this.json(this.deleteReply);
      this.conversations = this.conversations.filter((item) => item.summary.id !== id);
      return this.json({ status: 200, body: { deleted: true, id } });
    }
    if (method === "GET") {
      const resource = this.resources.get(path);
      if (resource) return this.json(resource);
    }
    return this.json({ status: 404, body: { detail: "Not Found" } });
  }

  callsTo(method: string, path: string) {
    return this.calls.filter((call) => call.method === method && call.path.startsWith(path));
  }

  seedConversation() {
    this.conversations = [{ summary: conversationSummaryFixture(), turns: turnsFixture() }];
  }
}

/** Replaces fetch with the proxy for the test. Call from beforeEach. */
export function installProxy(): FakeProxy {
  const proxy = new FakeProxy();
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(proxy.handle(input, init))));
  return proxy;
}

export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, refetchOnWindowFocus: false }, mutations: { retry: false } },
  });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

export function metricFixture(overrides: Record<string, unknown> & { key: string }) {
  return {
    label: overrides.key,
    kind: "period",
    unit: "count",
    good: "up",
    value: 10,
    previous: 8,
    delta: 2,
    change_pct: 25,
    definition: "Test definition for this figure.",
    caption: null,
    href: null,
    available: true,
    unavailable_reason: null,
    ...overrides,
  };
}

/** A command-centre snapshot. Live listings is deliberately absent, so the view must say it is not served. */
export function commandCentreFixture(overrides: Record<string, unknown> = {}) {
  return {
    generated_at: "2026-11-27T10:00:00.250000",
    window: {
      days: 7,
      from: "2026-11-20T10:00:00",
      to: "2026-11-27T10:00:00",
      previous_from: "2026-11-13T10:00:00",
      previous_to: "2026-11-20T10:00:00",
    },
    staff_excluded: true,
    activity_coverage_started_on: "2026-11-20",
    groups: [
      {
        key: "growth",
        title: "Growth",
        metrics: [
          metricFixture({ key: "registered_users", label: "Registered users", value: 1200, previous: 1100, delta: 100, change_pct: 9.1 }),
          metricFixture({ key: "new_registrations", label: "New registrations", value: 42, previous: 30, delta: 12, change_pct: 40 }),
          metricFixture({ key: "registration_growth", label: "Registration growth", unit: "percent", value: 40, previous: 30, delta: 10, change_pct: 33.3 }),
          metricFixture({ key: "active_users", label: "Active users", value: 180, previous: 160, delta: 20, change_pct: 12.5 }),
          metricFixture({ key: "returning_users", label: "Returning users", value: 90, previous: 80, delta: 10, change_pct: 12.5 }),
        ],
      },
      {
        key: "marketplace",
        title: "Marketplace",
        metrics: [
          metricFixture({ key: "total_listings", label: "Total listings", value: 640, previous: 600, delta: 40, change_pct: 6.7 }),
          metricFixture({ key: "new_listings", label: "New listings", value: 18, previous: 30, delta: -12, change_pct: -40, good: "up" }),
          metricFixture({ key: "first_listing_views", label: "First listing views", value: 900, previous: 850, delta: 50, change_pct: 5.9 }),
          metricFixture({ key: "seller_reply_rate", label: "Seller reply rate", unit: "percent", value: 41.2, previous: 58, delta: -16.8, change_pct: -29 }),
        ],
      },
      {
        key: "financial",
        title: "Financial",
        metrics: [
          metricFixture({ key: "revenue", label: "Revenue", unit: "kes_minor", value: 250000, previous: 100000, delta: 150000, change_pct: 150 }),
          metricFixture({ key: "successful_payments", label: "Successful payments", value: 6, previous: 4, delta: 2, change_pct: 50 }),
          metricFixture({ key: "failed_payments", label: "Failed payments", value: 3, previous: 1, delta: 2, change_pct: 200, good: "down" }),
          metricFixture({
            key: "payment_success_rate",
            label: "Payment success rate",
            unit: "percent",
            value: null,
            previous: null,
            delta: null,
            change_pct: null,
            available: false,
            unavailable_reason: "No payment attempts in this window, so a rate cannot be measured.",
          }),
        ],
      },
      {
        key: "trust",
        title: "Trust",
        metrics: [
          metricFixture({ key: "flagged_accounts", label: "Flagged accounts", value: 2, previous: 1, delta: 1, change_pct: 100, good: "down" }),
          metricFixture({ key: "open_disputes", label: "Open disputes", value: 1, previous: 1, delta: 0, change_pct: 0, good: "down" }),
          metricFixture({ key: "complaints_filed", label: "Complaints filed", value: 4, previous: 2, delta: 2, change_pct: 100, good: "down" }),
        ],
      },
      {
        key: "operations",
        title: "Operations",
        metrics: [
          metricFixture({ key: "api_availability", label: "API availability", unit: "percent", value: 99.9, previous: 99.8, delta: 0.1, change_pct: 0.1 }),
          metricFixture({ key: "api_latency_p95", label: "API latency (p95)", unit: "ms", value: 420, previous: 380, delta: 40, change_pct: 10.5, good: "down" }),
          metricFixture({ key: "payments_waiting", label: "Payments waiting", value: 0, previous: 0, delta: 0, change_pct: null }),
        ],
      },
    ],
    decisions: insightsFixture,
    pulse: pulseFixture,
    ...overrides,
  };
}

export function alertFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    kind: "dispute",
    severity: "high",
    title: "Dispute opened on a listing",
    body: "A buyer opened a dispute. Review it before the deadline.",
    href: "/disputes",
    status: "open",
    created_at: "2026-11-27T09:30:00",
    acknowledged_at: null,
    acknowledged_by: null,
    resolved_at: null,
    meta: null,
    ...overrides,
  };
}

export function alertListFixture(items: Array<Record<string, unknown>>, unread = items.length) {
  return { items, total: items.length, unread };
}

/** Daily analytics for the last 30 days. A null is a bucket the backend did not measure. */
export function timeseriesFixture() {
  const days = ["2026-11-25", "2026-11-26", "2026-11-27"];
  return {
    from: "2026-10-29",
    to: "2026-11-28",
    bucket: "day",
    coverage: { active_users_started_on: "2026-11-20" },
    series: {
      gmv_minor: [
        { t: days[0], v: 150000 },
        { t: days[1], v: null },
        { t: days[2], v: 420000 },
      ],
      listings_created: days.map((t, index) => ({ t, v: [4, 2, 7][index] })),
      deals_agreed: days.map((t, index) => ({ t, v: [1, 0, 2][index] })),
      disputes_opened: days.map((t, index) => ({ t, v: [0, 1, 0][index] })),
      active_users: days.map((t, index) => ({ t, v: [40, 44, 51][index] })),
    },
  };
}
