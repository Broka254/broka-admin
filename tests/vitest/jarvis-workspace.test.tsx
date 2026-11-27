import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { JarvisWorkspace } from "@/components/jarvis/jarvis-workspace";

import {
  briefingFixture,
  chatResponseFixture,
  CONVERSATION_ID,
  conversationSummaryFixture,
  statusFixture,
  turnsFixture,
} from "./fixtures/jarvis";

type Reply = { status: number; body: unknown; headers?: Record<string, string> };
type Turn = Record<string, unknown>;
type Conversation = { summary: Record<string, unknown>; turns: Turn[] };
type Call = { method: string; path: string; body?: Record<string, unknown> };

/**
 * A small in-memory stand-in for the same-origin proxy. It answers the
 * documented Jarvis routes in the shapes the backend uses, so the hooks run
 * their real paging, caching and invalidation.
 */
class FakeProxy {
  status: Reply = { status: 200, body: statusFixture() };
  briefing: Reply = { status: 200, body: briefingFixture() };
  chat: Reply | null = null;
  deleteReply: Reply | null = null;
  conversations: Conversation[] = [];
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
      const reply = this.detail(detailMatch[1], url);
      return this.json(reply);
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
    return this.json({ status: 404, body: { detail: "Not Found" } });
  }

  callsTo(method: string, path: string) {
    return this.calls.filter((call) => call.method === method && call.path.startsWith(path));
  }
}

let proxy: FakeProxy;

function renderWorkspace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, refetchOnWindowFocus: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <JarvisWorkspace />
    </QueryClientProvider>,
  );
}

function seedConversation() {
  proxy.conversations = [
    {
      summary: conversationSummaryFixture(),
      turns: turnsFixture(),
    },
  ];
}

beforeAll(() => {
  // jsdom does not implement layout-driven scrolling; the workspace calls it when a briefing signal is investigated.
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  proxy = new FakeProxy();
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(proxy.handle(input, init))));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function askQuestion(text: string) {
  fireEvent.change(screen.getByLabelText("Question for Zeno"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Ask Zeno" }));
}

describe("briefing", () => {
  it("shows the headline, the signals with their severity, and the readiness of the model", async () => {
    renderWorkspace();
    expect(await screen.findByRole("heading", { level: 1, name: "Jarvis Mode" })).toBeInTheDocument();
    expect(await screen.findByText("1 critical and 1 high-priority signal in the last 7 days")).toBeInTheDocument();
    // The finding title also appears as a recommended investigation, so the title is present twice.
    expect(screen.getAllByText("Seller replies are slowing").length).toBeGreaterThan(0);
    expect(screen.getByText("Payment webhook failures")).toBeInTheDocument();
    expect(screen.getByText("Signal only. No quantitative figure is attached.")).toBeInTheDocument();

    const readiness = screen.getByRole("region", { name: "System readiness" });
    expect(within(readiness).getByText("gemini, groq")).toBeInTheDocument();
    expect(within(readiness).getByText("Ready · 14 tools")).toBeInTheDocument();
    expect(within(readiness).getByText("Enabled")).toBeInTheDocument();
  });

  it("defaults the window to seven days and asks the backend for the chosen window", async () => {
    renderWorkspace();
    await screen.findByText("1 critical and 1 high-priority signal in the last 7 days");
    const select = screen.getByLabelText("Briefing window") as HTMLSelectElement;
    expect(select.value).toBe("7");
    expect(proxy.callsTo("GET", "admin/zeno/briefing")[0].path).toBe("admin/zeno/briefing?window_days=7");

    fireEvent.change(select, { target: { value: "30" } });
    await waitFor(() => expect(proxy.callsTo("GET", "admin/zeno/briefing?window_days=30")).not.toHaveLength(0));
  });

  it("keeps an unavailable figure from showing a number and states its reason", async () => {
    renderWorkspace();
    await screen.findByText("1 critical and 1 high-priority signal in the last 7 days");
    const refund = screen.getByLabelText("Refund rate, unavailable");
    expect(within(refund).getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(within(refund).getByText("No completed deals in this window, so a rate cannot be measured.")).toBeInTheDocument();
    // An unavailable figure has no previous value to compare, so none is shown at all.
    expect(within(refund).queryByText(/Previous value/)).toBeNull();
    expect(within(refund).queryByText(/^0/)).toBeNull();
  });

  it("shows a measured figure with its unit, period, source and definition", async () => {
    renderWorkspace();
    await screen.findByText("1 critical and 1 high-priority signal in the last 7 days");
    const card = screen.getByLabelText("Seller reply rate, measured");
    expect(within(card).getByText("41.2%")).toBeInTheDocument();
    expect(within(card).getByText("Unit: %")).toBeInTheDocument();
    // The period is in the card's footer and again in its details.
    expect(within(card).getAllByText(/20 Nov 2026, 10:00 UTC to 27 Nov 2026, 10:00 UTC/).length).toBeGreaterThan(0);
    expect(within(card).getByText(/Source: api\.core\.command_center/)).toBeInTheDocument();
    expect(within(card).getByText("Share of buyer messages answered by a seller within 24 hours.")).toBeInTheDocument();
    expect(within(card).getByText("briefing.command_center.reply_rate")).toBeInTheDocument();
  });

  it("states an empty window as empty rather than as a number of zero findings", async () => {
    proxy.briefing = {
      status: 200,
      body: briefingFixture({ priority_findings: [], opportunities: [], recommended_investigations: [], evidence: [] }),
    };
    renderWorkspace();
    expect(
      await screen.findByText("No priority signals were raised for this window. The limitations below state what this briefing does not cover."),
    ).toBeInTheDocument();
    expect(screen.getByText("No opportunities were identified in this window.")).toBeInTheDocument();
  });

  it("reports an outage as unavailable and retries it on request", async () => {
    proxy.briefing = { status: 503, body: { code: "backend_unavailable", message: "x", request_id: "r" } };
    renderWorkspace();
    expect(await screen.findByText("BROKA cannot be reached right now")).toBeInTheDocument();
    proxy.briefing = { status: 200, body: briefingFixture() };
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("1 critical and 1 high-priority signal in the last 7 days")).toBeInTheDocument();
  });

  it("refuses a briefing that does not match the contract and says nothing from it was shown", async () => {
    proxy.briefing = { status: 200, body: { ...briefingFixture(), forecast: [] } };
    renderWorkspace();
    expect(await screen.findByText("The response could not be verified")).toBeInTheDocument();
    expect(screen.queryByText("1 critical and 1 high-priority signal in the last 7 days")).toBeNull();
  });
});

describe("disabled deployment", () => {
  it("says Jarvis Mode is off, once, and requests no investigation data", async () => {
    proxy.status = { status: 503, body: { code: "ADMIN_ZENO_DISABLED", message: "x", request_id: "r" } };
    renderWorkspace();
    expect(await screen.findByText("Jarvis Mode is not enabled")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "System readiness" })).toBeNull();
    expect(proxy.callsTo("GET", "admin/zeno/briefing")).toHaveLength(0);
    expect(proxy.callsTo("GET", "admin/zeno/conversations")).toHaveLength(0);
  });
});

describe("investigation", () => {
  it("creates an investigation, shows the answer with its findings and evidence, and lists it", async () => {
    renderWorkspace();
    await screen.findByText("1 critical and 1 high-priority signal in the last 7 days");
    askQuestion("Why did replies fall?");

    expect(await screen.findByText("Answer 1: seller reply rate fell to 41.2%")).toBeInTheDocument();
    expect(screen.getByText("The seller reply rate is down 17 points against the previous window.")).toBeInTheDocument();
    expect(screen.getByText("A holiday period may have slowed seller responses.")).toBeInTheDocument();
    expect(screen.getByText("Possible causes (hypotheses, not verified)")).toBeInTheDocument();
    expect(screen.getByLabelText("Question for Zeno")).toHaveValue("");

    const [call] = proxy.callsTo("POST", "admin/zeno/chat");
    expect(call.body).toEqual({ message: "Why did replies fall?", context: { period_days: 7 } });

    const history = screen.getByRole("region", { name: "Investigation history" });
    await waitFor(() => expect(within(history).getByText("Why did replies fall?")).toBeInTheDocument());
  });

  it("drops a related page that the dashboard does not serve, and links a real one", async () => {
    renderWorkspace();
    await screen.findByText("1 critical and 1 high-priority signal in the last 7 days");
    askQuestion("Why did replies fall?");
    await screen.findByText("Answer 1: seller reply rate fell to 41.2%");
    expect(screen.getAllByRole("link", { name: "Market" })[0]).toHaveAttribute("href", "/market");
    expect(screen.queryByRole("link", { name: /zeno/i })).toBeNull();
  });

  it("continues an earlier investigation with its conversation id and shows the stored turns", async () => {
    seedConversation();
    renderWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: /^Why did seller replies fall\?/ }));

    expect(await screen.findByText("Seller reply rate fell to 41.2%")).toBeInTheDocument();
    expect(screen.getByText("Sellers answered 41.2% of buyer messages within 24 hours, down from 58%.")).toBeInTheDocument();
    const transcript = screen.getByRole("log", { name: "Investigation transcript" });
    expect(within(transcript).getByText(/Why did seller replies fall\?/)).toBeInTheDocument();
    expect(proxy.callsTo("GET", `admin/zeno/conversations/${CONVERSATION_ID}`)[0].path).toBe(
      `admin/zeno/conversations/${CONVERSATION_ID}?offset=0&limit=2`,
    );

    askQuestion("And which sellers?");
    await waitFor(() => expect(proxy.callsTo("POST", "admin/zeno/chat")).toHaveLength(1));
    expect(proxy.callsTo("POST", "admin/zeno/chat")[0].body).toMatchObject({ conversation_id: CONVERSATION_ID });
  });

  it("fills the question box from a suggested question without sending it", async () => {
    renderWorkspace();
    await screen.findByText("1 critical and 1 high-priority signal in the last 7 days");
    fireEvent.click(screen.getByText("How did the business perform this window compared with the previous one?"));
    expect(screen.getByLabelText("Question for Zeno")).toHaveValue(
      "How did the business perform this window compared with the previous one?",
    );
    expect(proxy.callsTo("POST", "admin/zeno/chat")).toHaveLength(0);
  });

  it("sends a follow-up suggested by the answer when it is chosen", async () => {
    renderWorkspace();
    await screen.findByText("1 critical and 1 high-priority signal in the last 7 days");
    askQuestion("Why did replies fall?");
    await screen.findByText("Answer 1: seller reply rate fell to 41.2%");
    fireEvent.click(screen.getByRole("button", { name: "Which sellers are slowest to reply?" }));
    expect(screen.getByLabelText("Question for Zeno")).toHaveValue("Which sellers are slowest to reply?");
  });

  it("asks Zeno to investigate a briefing signal from its card", async () => {
    renderWorkspace();
    await screen.findByText("1 critical and 1 high-priority signal in the last 7 days");
    fireEvent.click(screen.getAllByRole("button", { name: "Ask Zeno to investigate" })[0]);
    await waitFor(() => expect(proxy.callsTo("POST", "admin/zeno/chat")).toHaveLength(1));
    expect(proxy.callsTo("POST", "admin/zeno/chat")[0].body).toMatchObject({
      message: "Investigate this signal: Seller replies are slowing",
    });
  });

  it("keeps the question and shows the model error when the answer fails, so nothing is retyped", async () => {
    renderWorkspace();
    await screen.findByText("1 critical and 1 high-priority signal in the last 7 days");
    proxy.chat = { status: 503, body: { code: "MODEL_UNAVAILABLE", message: "x", request_id: "r" } };
    askQuestion("Why did replies fall?");
    expect(await screen.findByText("The model is unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("Question for Zeno")).toHaveValue("Why did replies fall?");
  });

  it("refuses to send while the model gateway is not ready and says why", async () => {
    proxy.status = { status: 200, body: statusFixture({ model_gateway_ready: false, providers_configured: [] }) };
    renderWorkspace();
    await screen.findByText("1 critical and 1 high-priority signal in the last 7 days");
    fireEvent.change(screen.getByLabelText("Question for Zeno"), { target: { value: "Why?" } });
    expect(screen.getByRole("button", { name: "Ask Zeno" })).toBeDisabled();
    expect(
      screen.getByText("Investigations are paused until the model gateway is ready. Briefings still work."),
    ).toBeInTheDocument();
  });

  it("starts a fresh investigation without deleting the earlier one", async () => {
    seedConversation();
    renderWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: /^Why did seller replies fall\?/ }));
    await screen.findByText("Seller reply rate fell to 41.2%");
    fireEvent.click(screen.getByRole("button", { name: "New investigation" }));
    expect(await screen.findByText("Choosing a question fills the box. You can edit it before sending.")).toBeInTheDocument();
    expect(proxy.callsTo("DELETE", "admin/zeno/conversations")).toHaveLength(0);
  });
});

describe("history", () => {
  it("shows the empty history as a prompt, not as an error", async () => {
    renderWorkspace();
    expect(await screen.findByText(/No investigations yet/)).toBeInTheDocument();
  });

  it("deletes an investigation only after the administrator confirms", async () => {
    seedConversation();
    renderWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: "Delete investigation: Why did seller replies fall?" }));

    const dialog = screen.getByRole("alertdialog", { name: "Delete this investigation?" });
    expect(proxy.callsTo("DELETE", "admin/zeno/conversations")).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Keep investigation" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(proxy.callsTo("DELETE", "admin/zeno/conversations")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Delete investigation: Why did seller replies fall?" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete investigation" }));

    await waitFor(() => expect(proxy.callsTo("DELETE", `admin/zeno/conversations/${CONVERSATION_ID}`)).toHaveLength(1));
    expect(await screen.findByText(/No investigations yet/)).toBeInTheDocument();
  });

  it("closes the confirmation with Escape and leaves the investigation in place", async () => {
    seedConversation();
    renderWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: "Delete investigation: Why did seller replies fall?" }));
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(proxy.conversations).toHaveLength(1);
  });

  it("reports a failed deletion and keeps the investigation", async () => {
    seedConversation();
    proxy.deleteReply = { status: 503, body: { code: "backend_unavailable", message: "x", request_id: "r" } };
    renderWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: "Delete investigation: Why did seller replies fall?" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete investigation" }));
    expect(await within(screen.getByRole("alertdialog")).findByRole("alert")).toHaveTextContent(
      "Zeno could not reach the BROKA API. Try again shortly.",
    );
  });

  it("opens the history as a drawer on narrow screens, keeps focus inside it and closes it with Escape", async () => {
    seedConversation();
    renderWorkspace();
    await screen.findByText("1 critical and 1 high-priority signal in the last 7 days");
    fireEvent.click(await screen.findByRole("button", { name: "History (1)" }));

    const drawer = screen.getByRole("dialog", { name: "Investigation history" });
    expect(drawer).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(drawer, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Investigation history" })).toBeNull());
  });
});
