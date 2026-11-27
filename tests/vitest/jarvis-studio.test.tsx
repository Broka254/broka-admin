import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { JarvisProvider } from "@/components/jarvis/provider";
import { InvestigationStudioView } from "@/components/jarvis/views/studio";

import { CONVERSATION_ID, statusFixture } from "./fixtures/jarvis";
import { installProxy, renderWithClient, type FakeProxy } from "./fixtures/jarvis-proxy";

let proxy: FakeProxy;

function renderStudio() {
  return renderWithClient(
    <JarvisProvider>
      <InvestigationStudioView />
    </JarvisProvider>,
  );
}

function askQuestion(text: string) {
  fireEvent.change(screen.getByLabelText("Question for Zeno"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Ask Zeno" }));
}

beforeAll(() => {
  // jsdom does not implement layout-driven scrolling; the transcript scrolls its newest answer into view.
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  proxy = installProxy();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("investigation", () => {
  it("creates an investigation, shows the answer with its findings and evidence, and lists it", async () => {
    renderStudio();
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

  it("links a related page the dashboard serves and drops one it does not", async () => {
    renderStudio();
    askQuestion("Why did replies fall?");
    await screen.findByText("Answer 1: seller reply rate fell to 41.2%");
    expect(screen.getAllByRole("link", { name: "Market" })[0]).toHaveAttribute("href", "/market");
    expect(screen.queryByRole("link", { name: /zeno/i })).toBeNull();
  });

  it("continues an earlier investigation with its conversation id and shows the stored turns", async () => {
    proxy.seedConversation();
    renderStudio();
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

  it("labels each follow-up question as a step, and leaves the first question unlabelled", async () => {
    proxy.seedConversation();
    renderStudio();
    fireEvent.click(await screen.findByRole("button", { name: /^Why did seller replies fall\?/ }));
    await screen.findByText("Seller reply rate fell to 41.2%");

    askQuestion("And which sellers?");
    await screen.findByText("Answer 1: seller reply rate fell to 41.2%");
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.queryByText("Step 1")).toBeNull();
  });

  it("fills the question box from a suggested question without sending it", async () => {
    renderStudio();
    fireEvent.click(screen.getByText("How did the business perform this window compared with the previous one?"));
    expect(screen.getByLabelText("Question for Zeno")).toHaveValue(
      "How did the business perform this window compared with the previous one?",
    );
    expect(proxy.callsTo("POST", "admin/zeno/chat")).toHaveLength(0);
  });

  it("sends a follow-up suggested by the answer when it is chosen", async () => {
    renderStudio();
    askQuestion("Why did replies fall?");
    await screen.findByText("Answer 1: seller reply rate fell to 41.2%");
    fireEvent.click(screen.getByRole("button", { name: "Which sellers are slowest to reply?" }));
    expect(screen.getByLabelText("Question for Zeno")).toHaveValue("Which sellers are slowest to reply?");
  });

  it("keeps the question and shows the model error when the answer fails, so nothing is retyped", async () => {
    renderStudio();
    proxy.chat = { status: 503, body: { code: "MODEL_UNAVAILABLE", message: "x", request_id: "r" } };
    askQuestion("Why did replies fall?");
    expect(await screen.findByText("The model is unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("Question for Zeno")).toHaveValue("Why did replies fall?");
  });

  it("refuses to send while the model gateway is not ready and says why", async () => {
    proxy.status = { status: 200, body: statusFixture({ model_gateway_ready: false, providers_configured: [] }) };
    renderStudio();
    fireEvent.change(screen.getByLabelText("Question for Zeno"), { target: { value: "Why?" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Ask Zeno" })).toBeDisabled());
    expect(
      screen.getByText("Investigations are paused until the model gateway is ready. Briefings still work."),
    ).toBeInTheDocument();
  });

  it("starts a fresh investigation without deleting the earlier one", async () => {
    proxy.seedConversation();
    renderStudio();
    fireEvent.click(await screen.findByRole("button", { name: /^Why did seller replies fall\?/ }));
    await screen.findByText("Seller reply rate fell to 41.2%");
    fireEvent.click(screen.getByRole("button", { name: "New investigation" }));
    expect(await screen.findByText("Choosing a question fills the box. You can edit it before sending.")).toBeInTheDocument();
    expect(proxy.callsTo("DELETE", "admin/zeno/conversations")).toHaveLength(0);
  });
});

describe("evidence inspector", () => {
  it("shows the figures and the checks behind the latest answer", async () => {
    renderStudio();
    askQuestion("Why did replies fall?");
    await screen.findByText("Answer 1: seller reply rate fell to 41.2%");

    const inspector = screen.getByRole("complementary", { name: "Evidence for this answer" });
    expect(await within(inspector).findByText("Seller reply rate")).toBeInTheDocument();
    expect(within(inspector).getByText("41.2%")).toBeInTheDocument();
    expect(within(inspector).getByText("marketplace.reply_rate")).toBeInTheDocument();
  });

  it("shows a reopened investigation's stored figures, and says checks are listed only for this session", async () => {
    proxy.seedConversation();
    renderStudio();
    fireEvent.click(await screen.findByRole("button", { name: /^Why did seller replies fall\?/ }));

    const inspector = screen.getByRole("complementary", { name: "Evidence for this answer" });
    expect(await within(inspector).findByText("Seller reply rate")).toBeInTheDocument();
    expect(
      within(inspector).getByText("The checks are listed for answers given in this session."),
    ).toBeInTheDocument();
  });
});

describe("history", () => {
  it("shows the empty history as a prompt, not as an error", async () => {
    renderStudio();
    expect(await screen.findByText(/No investigations yet/)).toBeInTheDocument();
  });

  it("deletes an investigation only after the administrator confirms", async () => {
    proxy.seedConversation();
    renderStudio();
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
    proxy.seedConversation();
    renderStudio();
    fireEvent.click(await screen.findByRole("button", { name: "Delete investigation: Why did seller replies fall?" }));
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(proxy.conversations).toHaveLength(1);
  });

  it("reports a failed deletion and keeps the investigation", async () => {
    proxy.seedConversation();
    proxy.deleteReply = { status: 503, body: { code: "backend_unavailable", message: "x", request_id: "r" } };
    renderStudio();
    fireEvent.click(await screen.findByRole("button", { name: "Delete investigation: Why did seller replies fall?" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete investigation" }));
    expect(await within(screen.getByRole("alertdialog")).findByRole("alert")).toHaveTextContent(
      "Zeno could not reach the BROKA API. Try again shortly.",
    );
  });

  it("opens the history as a drawer on narrow screens, keeps focus inside it and closes it with Escape", async () => {
    proxy.seedConversation();
    renderStudio();
    fireEvent.click(await screen.findByRole("button", { name: "History (1)" }));

    const drawer = screen.getByRole("dialog", { name: "Investigation history" });
    expect(drawer).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(drawer, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Investigation history" })).toBeNull());
  });
});

describe("disabled deployment", () => {
  it("says Jarvis Mode is off and requests no investigation data", async () => {
    proxy.status = { status: 503, body: { code: "ADMIN_ZENO_DISABLED", message: "x", request_id: "r" } };
    renderStudio();
    expect(await screen.findByText("Jarvis Mode is not enabled")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Investigation history" })).toBeNull();
    expect(proxy.callsTo("GET", "admin/zeno/conversations")).toHaveLength(0);
    expect(proxy.callsTo("GET", "admin/zeno/briefing")).toHaveLength(0);
  });
});
