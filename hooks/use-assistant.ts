"use client";

import { useMutation } from "@tanstack/react-query";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import { AnswerSchema, type Answer, type AskIn } from "@/lib/api/assistant-schemas";

// Ask the Intelligence Assistant through the dashboard proxy, which checks the
// question against AskInSchema before it leaves. Each answer is parsed again
// here. Nothing is stored, and no answer changes data.
export function useAskAssistant() {
  return useMutation<Answer, AdminRequestError, AskIn>({
    mutationFn: async (input) => {
      const response = await fetch("/api/broka/admin/assistant/ask", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      if (!response.ok) {
        throw new AdminRequestError(payload.message ?? "The assistant could not answer.", response.status, payload.code);
      }
      return AnswerSchema.parse(payload);
    },
  });
}
