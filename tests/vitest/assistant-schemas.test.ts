import { describe, expect, it } from "vitest";

import { AnswerSchema, AskInSchema } from "@/lib/api/assistant-schemas";

// The legacy /admin/assistant/ask contract is kept for compatibility. Jarvis
// Mode replaces its page, but the endpoint and these schemas still guard it.

const legacyAnswer = {
  question: "How many users are active right now?",
  intent: "active_now",
  refused: false,
  answer: "7 users were active in the presence window: the last 300 seconds.",
  points: [],
  citations: [
    {
      label: "Active users now",
      value: "7",
      period: "the last 300 seconds, sampled at 2025-06-15T12:00:00Z",
      definition: "Signed-in users whose live session sent a heartbeat inside the presence window.",
      source: "Live presence sampler (user sessions)",
      href: "/analytics/users",
    },
  ],
  limitations: ["A live count is one sample taken at one moment. It is not a daily total."],
  links: [{ label: "User analytics", href: "/analytics/users" }],
  generated_at: "2025-06-15T12:00:00Z",
};

describe("legacy assistant answer contract", () => {
  it("accepts a well-formed answer", () => {
    expect(AnswerSchema.safeParse(legacyAnswer).success).toBe(true);
  });

  it("refuses an answer with an unknown intent", () => {
    expect(AnswerSchema.safeParse({ ...legacyAnswer, intent: "delete_everything" }).success).toBe(false);
  });

  it("requires every citation to name its definition and source", () => {
    const missing = {
      ...legacyAnswer,
      citations: [{ ...legacyAnswer.citations[0], definition: undefined }],
    };
    expect(AnswerSchema.safeParse(missing).success).toBe(false);
  });
});

describe("legacy assistant question contract", () => {
  it("trims the question and refuses an empty one", () => {
    expect(AskInSchema.parse({ question: "  Revenue today?  " }).question).toBe("Revenue today?");
    expect(AskInSchema.safeParse({ question: "   " }).success).toBe(false);
  });

  it("refuses any field the endpoint does not name", () => {
    expect(AskInSchema.safeParse({ question: "Revenue today?", admin_id: "someone" }).success).toBe(false);
  });
});
