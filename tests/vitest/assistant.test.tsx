import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-assistant", () => ({ useAskAssistant: vi.fn() }));

import { AssistantView } from "@/components/assistant/assistant-view";
import { AdminRequestError } from "@/hooks/use-admin-resource";
import { useAskAssistant } from "@/hooks/use-assistant";
import { AnswerSchema, type Answer } from "@/lib/api/assistant-schemas";

const active = {
  question: "How many users are active right now?",
  intent: "active_now",
  refused: false,
  answer: "7 users were active in the presence window: the last 300 seconds.",
  points: [],
  citations: [{
    label: "Active users now", value: "7",
    period: "the last 300 seconds, sampled at 2025-06-15T12:00:00Z",
    definition: "Signed-in users whose live session sent a heartbeat inside the presence window.",
    source: "Live presence sampler (user sessions)", href: "/analytics/users",
  }],
  limitations: ["A live count is one sample taken at one moment. It is not a daily total."],
  links: [{ label: "User analytics", href: "/analytics/users" }],
  generated_at: "2025-06-15T12:00:00Z",
};

const refusal = {
  question: "Suspend user rb-b1 for the weekend",
  intent: "action",
  refused: true,
  answer: "I can't suspend anything or change records from here. To suspend it, open the page and use its controls.",
  points: [], citations: [], limitations: [],
  links: [{ label: "Users", href: "/users" }],
  generated_at: "2025-06-15T12:00:00Z",
};

const ask = { mutate: vi.fn(), isPending: false, error: null as AdminRequestError | null };

beforeEach(() => {
  ask.mutate = vi.fn((input: { question: string }, options?: { onSuccess?: (answer: Answer) => void }) => {
    const answer = input.question === refusal.question ? refusal : { ...active, question: input.question };
    options?.onSuccess?.(AnswerSchema.parse(answer));
  });
  ask.isPending = false;
  ask.error = null;
  vi.mocked(useAskAssistant).mockReturnValue(ask as never);
});

describe("AssistantView", () => {
  it("answers with the figures behind it, their period, definition and page", () => {
    render(<AssistantView />);
    fireEvent.change(screen.getByLabelText(/Your question/), { target: { value: active.question } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(ask.mutate).toHaveBeenCalledWith({ question: active.question }, expect.any(Object));
    expect(screen.getByTestId("assistant-answer")).toHaveTextContent("7 users were active");
    const table = screen.getByRole("table", { name: "Figures behind this answer" });
    expect(within(table).getByText("the last 300 seconds, sampled at 2025-06-15T12:00:00Z")).toBeInTheDocument();
    expect(within(table).getByText("Signed-in users whose live session sent a heartbeat inside the presence window.")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/analytics/users");
    expect(screen.getByText("A live count is one sample taken at one moment. It is not a daily total.")).toBeInTheDocument();
  });

  it("labels a refused instruction as not carried out and links to where it is done", () => {
    render(<AssistantView />);
    fireEvent.change(screen.getByLabelText(/Your question/), { target: { value: refusal.question } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText("Not carried out")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/users");
  });

  it("sends a suggested question at once", () => {
    render(<AssistantView />);
    fireEvent.click(screen.getByRole("button", { name: "Generate a weekly performance summary." }));
    expect(ask.mutate).toHaveBeenCalledWith({ question: "Generate a weekly performance summary." }, expect.any(Object));
  });

  it("does not send an empty question and says answers are not stored", () => {
    render(<AssistantView />);
    expect(screen.getByText(/Answers are not stored/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Your question/), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    expect(ask.mutate).not.toHaveBeenCalled();
  });

  it("says when the administrator has asked too many questions", () => {
    ask.error = new AdminRequestError("Too many requests", 429);
    vi.mocked(useAskAssistant).mockReturnValue(ask as never);
    render(<AssistantView />);
    expect(screen.getByRole("alert")).toHaveTextContent("You have asked a lot of questions in the last hour.");
  });
});

describe("assistant answer contract", () => {
  it("refuses an answer with an unknown intent", () => {
    expect(AnswerSchema.safeParse({ ...active, intent: "delete_everything" }).success).toBe(false);
  });

  it("requires every citation to name its definition and source", () => {
    const missing = { ...active, citations: [{ ...active.citations[0], definition: undefined }] };
    expect(AnswerSchema.safeParse(missing).success).toBe(false);
  });
});
