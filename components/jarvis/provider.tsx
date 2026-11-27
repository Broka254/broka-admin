"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { noticeFrom, type AskNotice } from "@/components/jarvis/investigation";
import {
  JarvisRequestError,
  useJarvisBriefing,
  useJarvisInvestigation,
  useJarvisStatus,
  type InvestigationState,
} from "@/hooks/use-jarvis";
import { ZENO_BRIEFING_WINDOW } from "@/lib/api/jarvis-schemas";

// The Zeno session for the whole Jarvis workspace. It mounts once in the
// workspace layout, so an investigation, the command input and the last answer
// survive moving between sections. Everything is held in memory: nothing is
// written to browser storage, and the conversations themselves are the
// backend's.

export type ZenoAvailability = "checking" | "ready" | "model-not-ready" | "disabled" | "unavailable";

export type ZenoActivity = {
  pendingQuestion: string | null;
  startedAt: number | null;
  lastAnswer: { headline: string; conversationId: string; answeredAt: number } | null;
};

export type JarvisValue = {
  windowDays: number;
  setWindowDays: (days: number) => void;
  status: ReturnType<typeof useJarvisStatus>;
  briefing: ReturnType<typeof useJarvisBriefing>;
  availability: ZenoAvailability;
  canAsk: boolean;
  composerNote: string | null;
  investigation: InvestigationState;
  activity: ZenoActivity;
  draft: string;
  setDraft: (value: string) => void;
  notice: AskNotice | null;
  dismissNotice: () => void;
  ask: (question: string) => Promise<boolean>;
  submitDraft: () => Promise<void>;
  newInvestigation: () => void;
};

const JarvisContext = createContext<JarvisValue | null>(null);

function isDisabled(error: unknown): boolean {
  return error instanceof JarvisRequestError && error.code === "ADMIN_ZENO_DISABLED";
}

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [windowDays, setWindowDays] = useState<number>(ZENO_BRIEFING_WINDOW.default);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<AskNotice | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastAnswer, setLastAnswer] = useState<ZenoActivity["lastAnswer"]>(null);

  const status = useJarvisStatus();
  // Data is requested only once readiness has settled, so a disabled deployment
  // receives one status request and nothing that would fail the same way.
  const statusDisabled = isDisabled(status.error) || status.data?.enabled === false;
  const dataEnabled = !status.isPending && !statusDisabled;
  const briefing = useJarvisBriefing(windowDays, dataEnabled);
  const investigation = useJarvisInvestigation(dataEnabled);

  const disabled = statusDisabled || isDisabled(briefing.error) || isDisabled(investigation.conversations.error);
  const modelNotReady = status.data !== undefined && !status.data.model_gateway_ready;
  const availability: ZenoAvailability = disabled
    ? "disabled"
    : status.isPending
      ? "checking"
      : status.error
        ? "unavailable"
        : modelNotReady
          ? "model-not-ready"
          : "ready";
  const canAsk = availability === "ready" || availability === "unavailable" || availability === "checking";
  const composerNote = availability === "model-not-ready"
    ? "Investigations are paused until the model gateway is ready. Briefings still work."
    : availability === "disabled"
      ? "Zeno is not enabled on this deployment."
      : null;

  async function ask(question: string): Promise<boolean> {
    const text = question.trim();
    if (!text || !canAsk || investigation.pendingQuestion !== null) return false;
    setNotice(null);
    setStartedAt(Date.now());
    try {
      const response = await investigation.ask(text, windowDays);
      setLastAnswer({
        headline: response.answer.headline,
        conversationId: response.conversation_id,
        answeredAt: Date.now(),
      });
      return true;
    } catch (failure) {
      setNotice(noticeFrom(failure));
      return false;
    } finally {
      setStartedAt(null);
    }
  }

  async function submitDraft() {
    const question = draft.trim();
    if (!question) return;
    const sent = await ask(question);
    // A failed send keeps the text, so nothing has to be typed again.
    if (sent) setDraft((current) => (current.trim() === question ? "" : current));
  }

  function newInvestigation() {
    setNotice(null);
    investigation.startNew();
  }

  const value: JarvisValue = {
    windowDays,
    setWindowDays,
    status,
    briefing,
    availability,
    canAsk,
    composerNote,
    investigation,
    activity: { pendingQuestion: investigation.pendingQuestion, startedAt, lastAnswer },
    draft,
    setDraft,
    notice,
    dismissNotice: () => setNotice(null),
    ask,
    submitDraft,
    newInvestigation,
  };

  return <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>;
}

export function useJarvis(): JarvisValue {
  const value = useContext(JarvisContext);
  if (value === null) throw new Error("useJarvis must be used inside JarvisProvider");
  return value;
}
