"use client";

import { Bot } from "lucide-react";
import { useEffect, useState } from "react";

import { Chip, PageHeader } from "@/components/intelligence/visuals";
import { BriefingPanel } from "@/components/jarvis/briefing";
import { ConversationHistory, HistoryDrawer } from "@/components/jarvis/history";
import { InvestigationPanel, noticeFrom, type AskNotice } from "@/components/jarvis/investigation";
import { JarvisNotice, ReadinessStrip } from "@/components/jarvis/readiness";
import { JarvisRequestError, useJarvisBriefing, useJarvisInvestigation, useJarvisStatus } from "@/hooks/use-jarvis";
import { ZENO_BRIEFING_WINDOW } from "@/lib/api/jarvis-schemas";

const QUESTION_ID = "jarvis-question";

function isDisabledError(error: unknown): boolean {
  return error instanceof JarvisRequestError && error.code === "ADMIN_ZENO_DISABLED";
}

/**
 * Jarvis Mode: the executive briefing, a conversational investigation, the
 * administrator's saved investigations, and the readiness of the model. Every
 * value shown comes from the proxy; nothing is stored in the browser.
 */
export function JarvisWorkspace() {
  const [windowDays, setWindowDays] = useState<number>(ZENO_BRIEFING_WINDOW.default);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<AskNotice | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const status = useJarvisStatus();
  const statusDisabled = isDisabledError(status.error) || status.data?.enabled === false;
  // Data is requested only after readiness has settled. A disabled deployment
  // therefore receives one status request, not a briefing and a list that
  // would each fail the same way.
  const dataEnabled = !status.isPending && !statusDisabled;
  const briefing = useJarvisBriefing(windowDays, dataEnabled);
  const investigation = useJarvisInvestigation(dataEnabled);
  const disabled = statusDisabled || isDisabledError(briefing.error) || isDisabledError(investigation.conversations.error);

  const modelNotReady = status.data !== undefined && !status.data.model_gateway_ready;
  const canAsk = !disabled && !modelNotReady;
  const composerNote = !disabled && modelNotReady
    ? "Investigations are paused until the model gateway is ready. Briefings still work."
    : null;

  // The drawer is for narrow screens only. Growing the window closes it, so
  // focus can never stay trapped inside a panel that is hidden at this width.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      if (wide.matches) setHistoryOpen(false);
    };
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  async function ask(question: string): Promise<boolean> {
    const text = question.trim();
    if (!text || !canAsk) return false;
    setNotice(null);
    try {
      await investigation.ask(text, windowDays);
      return true;
    } catch (failure) {
      setNotice(noticeFrom(failure));
      return false;
    }
  }

  async function submitDraft() {
    const question = draft.trim();
    if (!question) return;
    const sent = await ask(question);
    // Clear the box only if it still holds the question that was sent. A failed
    // send leaves the text in place so nothing has to be typed again.
    if (sent) setDraft((current) => (current.trim() === question ? "" : current));
  }

  function prefill(question: string) {
    setDraft(question);
    window.setTimeout(() => document.getElementById(QUESTION_ID)?.focus(), 0);
  }

  function investigateFromBriefing(question: string) {
    document.getElementById("jarvis-investigation")?.scrollIntoView({ block: "start" });
    void ask(question);
  }

  const readiness = disabled
    ? { label: "Disabled", tone: "danger" as const }
    : status.isPending
      ? { label: "Checking readiness", tone: "neutral" as const }
      : status.error
        ? { label: "Readiness unknown", tone: "warning" as const }
        : modelNotReady
          ? { label: "Model not ready", tone: "warning" as const }
          : { label: "Ready", tone: "success" as const };

  const historyCount = investigation.conversations.data?.pages[0]?.total ?? investigation.summaries.length;

  // One set of history props for both the desktop rail and the mobile drawer,
  // so the two can never disagree about what is listed or selected.
  const historyProps = {
    summaries: investigation.summaries,
    total: investigation.conversations.data?.pages[0]?.total ?? null,
    activeId: investigation.activeId,
    loading: investigation.conversations.isPending,
    error: investigation.conversations.error,
    onRetry: () => void investigation.conversations.refetch(),
    hasMore: investigation.conversations.hasNextPage,
    loadingMore: investigation.conversations.isFetchingNextPage,
    loadMoreError: investigation.conversations.isFetchNextPageError ? investigation.conversations.error : null,
    onLoadMore: () => void investigation.conversations.fetchNextPage(),
    onDelete: investigation.remove,
    onSelect: (conversationId: string) => {
      setNotice(null);
      investigation.select(conversationId);
      setHistoryOpen(false);
    },
    onNew: () => {
      setNotice(null);
      investigation.startNew();
      setHistoryOpen(false);
    },
  };

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6 pb-10">
      <PageHeader
        eyebrow="BROKA intelligence"
        title="Jarvis Mode"
        icon={<Bot size={15} aria-hidden="true" />}
        description="Zeno reads BROKA's verified figures and shows the evidence behind every answer. Jarvis Mode is read-only and changes no marketplace record."
        meta={<Chip tone={readiness.tone}>{readiness.label}</Chip>}
      />

      {disabled ? (
        <JarvisNotice kind="disabled" />
      ) : (
        <>
          <ReadinessStrip status={status} />

          <BriefingPanel
            query={briefing}
            windowDays={windowDays}
            onWindowChange={setWindowDays}
            onInvestigate={investigateFromBriefing}
            investigateDisabled={!canAsk || investigation.pendingQuestion !== null}
          />

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <InvestigationPanel
              active={investigation.active}
              turns={investigation.turns}
              turnsLoading={investigation.turnsLoading}
              turnsError={investigation.turnsError}
              hasEarlierTurns={investigation.hasEarlierTurns}
              onLoadEarlier={investigation.loadEarlierTurns}
              latest={investigation.latest}
              pendingQuestion={investigation.pendingQuestion}
              draft={draft}
              onDraftChange={setDraft}
              onSubmit={() => void submitDraft()}
              onSuggest={prefill}
              onNew={() => {
                setNotice(null);
                investigation.startNew();
              }}
              onOpenHistory={() => setHistoryOpen(true)}
              historyCount={historyCount}
              canAsk={canAsk}
              composerNote={composerNote}
              notice={notice}
              onDismissNotice={() => setNotice(null)}
            />

            <div className="hidden lg:sticky lg:top-24 lg:block">
              <ConversationHistory
                {...historyProps}
                headingId="jarvis-history-title"
                className="max-h-[min(70vh,46rem)]"
                trapDeleteFocus
              />
            </div>
          </div>

          <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)}>
            <ConversationHistory
              {...historyProps}
              headingId="jarvis-history-drawer-heading"
              className="min-h-0 flex-1 border-0 bg-transparent p-0"
              trapDeleteFocus={false}
            />
          </HistoryDrawer>
        </>
      )}
    </div>
  );
}
