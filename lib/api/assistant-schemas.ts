import { z } from "zod";

// The Intelligence Assistant (backend api/core/assistant.py, POST
// /admin/assistant/ask). Read-only: each answer states the date range, the
// definitions and the page behind its figures. A question that asks for an
// action is refused (intent "action") and names the page where it is done.
// The request schema is strict, so a field the API does not name is refused
// here, before it leaves the dashboard.

export const ASSISTANT_INTENTS = [
  "active_now", "anomalies", "forecast", "summary", "categories", "payments", "registrations",
  "listings", "active_users", "help", "action",
] as const;

export const AskInSchema = z.object({
  question: z.string().trim().min(1).max(300),
}).strict();
export type AskIn = z.infer<typeof AskInSchema>;

export const AnswerSchema = z.object({
  question: z.string(),
  intent: z.enum(ASSISTANT_INTENTS),
  refused: z.boolean(),
  answer: z.string(),
  points: z.array(z.string()),
  citations: z.array(z.object({
    label: z.string(),
    value: z.string(),
    period: z.string(),
    definition: z.string(),
    source: z.string(),
    href: z.string(),
  })),
  limitations: z.array(z.string()),
  links: z.array(z.object({ label: z.string(), href: z.string() })),
  generated_at: z.string(),
}).passthrough();
export type Answer = z.infer<typeof AnswerSchema>;
