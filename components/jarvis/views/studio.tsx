"use client";

import { useEffect, useState } from "react";

import { ConversationHistory, HistoryDrawer } from "@/components/jarvis/history";
import { ConfidenceChip } from "@/components/jarvis/evidence";
import { InvestigationPanel, QUESTION_INPUT_ID } from "@/components/jarvis/investigation";
import { useJarvis } from "@/components/jarvis/provider";
import { JarvisNotice } from "@/components/jarvis/readiness";
import { EmptyNote, GlassPanel, PageHeading, SectionHeader } from "@/components/jarvis/ui/primitives";
import type { ZenoEvidence } from "@/lib/api/jarvis-schemas";
import { describeEvidence } from "@/lib/jarvis/presentation";

/**
 * The figures and checks behind the answer on screen. The answer's findings and
 * next steps are in the transcript, so they are not repeated here.
 */
function Inspector({ evidence, checks }: { evidence: ZenoEvidence[] | null; checks: string[] | null }) {
  return (
    <GlassPanel as="aside" labelledBy="studio-inspector" className="space-y-5 p-5">
      <SectionHeader
        id="studio-inspector"
        eyebrow="Inspector"
        title="Evidence for this answer"
        description="The figures Zeno read, with their period and source, and the checks it ran. Nothing here is inferred beyond the figures themselves."
      />
      {evidence === null ? (
        <EmptyNote>Ask a question, or open an investigation, to inspect its evidence here.</EmptyNote>
      ) : (
        <>
          <section aria-labelledby="inspector-figures" className="space-y-3">
            <h3 id="inspector-figures" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Figures ({evidence.length})
            </h3>
            {evidence.length === 0 ? (
              <p className="text-xs leading-5 text-slate-500">No figures were attached to this answer.</p>
            ) : (
              <ul className="space-y-2">
                {evidence.map((item) => {
                  const view = describeEvidence(item);
                  return (
                    <li key={view.id} className="space-y-1.5 rounded-xl border border-white/[0.07] bg-black/20 p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-200">{view.label}</span>
                        <ConfidenceChip confidence={view.confidence} />
                      </div>
                      <p className="text-sm tabular-nums text-slate-100">
                        {view.valueText ?? view.unavailableReason ?? "No value reported"}
                      </p>
                      <p className="text-[11px] leading-4 text-slate-500">
                        {view.periodText} · {view.source}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="inspector-checks" className="space-y-2">
            <h3 id="inspector-checks" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Checks run
            </h3>
            {checks === null ? (
              <p className="text-xs leading-5 text-slate-500">
                The checks are listed for answers given in this session.
              </p>
            ) : checks.length === 0 ? (
              <p className="text-xs leading-5 text-slate-500">No checks were recorded for this answer.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {checks.map((tool) => (
                  <li key={tool} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-slate-300">
                    {tool}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </GlassPanel>
  );
}

/** Investigation Studio: the conversation with Zeno, its saved history, and the evidence behind the latest answer. */
export function InvestigationStudioView() {
  const jarvis = useJarvis();
  const investigation = jarvis.investigation;
  const [historyOpen, setHistoryOpen] = useState(false);

  // The history drawer is for narrow screens. Growing the window closes it, so
  // focus cannot stay inside a drawer that is hidden at that width.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const wide = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      if (wide.matches) setHistoryOpen(false);
    };
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  const total = investigation.conversations.data?.pages[0]?.total ?? null;
  const historyCount = total ?? investigation.summaries.length;

  // One set of history props feeds both the desktop rail and the drawer, so the
  // two can never disagree about what is listed or selected.
  const history = {
    summaries: investigation.summaries,
    total,
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
      jarvis.dismissNotice();
      investigation.select(conversationId);
      setHistoryOpen(false);
    },
    onNew: () => {
      jarvis.newInvestigation();
      setHistoryOpen(false);
    },
  };

  function prefill(question: string) {
    jarvis.setDraft(question);
    window.setTimeout(() => document.getElementById(QUESTION_INPUT_ID)?.focus(), 0);
  }

  const header = (
    <PageHeading
      eyebrow="Jarvis Mode · Studio"
      title="Investigation Studio"
      description="Work through a question in steps. Each answer lists the figures behind it, the checks Zeno ran and what to do next. Every investigation is saved to your history."
    />
  );

  if (jarvis.availability === "disabled") {
    return (
      <div className="space-y-6">
        {header}
        <JarvisNotice kind="disabled" />
      </div>
    );
  }

  const lastAssistant = [...investigation.turns].reverse().find((turn) => turn.role === "assistant") ?? null;
  // The answer on screen is preferred: its figures are available at once, while
  // the stored turns are fetched again after each question.
  const evidence = investigation.latest
    ? investigation.latest.evidence
    : lastAssistant
      ? lastAssistant.evidence
      : null;
  // The checks come from the in-memory answer only. Stored turns do not carry them.
  const checks = investigation.latest ? investigation.latest.investigation.tools_used : null;

  return (
    <div className="space-y-6">
      {header}

      <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
        <div className="hidden lg:sticky lg:top-[9.5rem] lg:block">
          <ConversationHistory
            {...history}
            headingId="studio-history-title"
            className="max-h-[min(62vh,44rem)]"
            trapDeleteFocus
          />
        </div>

        <InvestigationPanel
          active={investigation.active}
          turns={investigation.turns}
          turnsLoading={investigation.turnsLoading}
          turnsError={investigation.turnsError}
          hasEarlierTurns={investigation.hasEarlierTurns}
          onLoadEarlier={investigation.loadEarlierTurns}
          latest={investigation.latest}
          pendingQuestion={investigation.pendingQuestion}
          draft={jarvis.draft}
          onDraftChange={jarvis.setDraft}
          onSubmit={() => void jarvis.submitDraft()}
          onSuggest={prefill}
          onNew={jarvis.newInvestigation}
          onOpenHistory={() => setHistoryOpen(true)}
          historyCount={historyCount}
          canAsk={jarvis.canAsk}
          composerNote={jarvis.composerNote}
          notice={jarvis.notice}
          onDismissNotice={jarvis.dismissNotice}
        />

        <div className="hidden xl:sticky xl:top-[9.5rem] xl:block">
          <Inspector evidence={evidence} checks={checks} />
        </div>
      </div>

      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)}>
        <ConversationHistory
          {...history}
          headingId="studio-history-drawer-title"
          className="min-h-0 flex-1 border-0 bg-transparent p-0"
          trapDeleteFocus={false}
        />
      </HistoryDrawer>
    </div>
  );
}
