import { History, Plus } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";

import { Panel } from "@/components/intelligence/visuals";
import { SkeletonPanel } from "@/components/ui/primitives";
import { JarvisRequestError } from "@/hooks/use-jarvis";
import {
  ZenoTurnMetadataSchema,
  type ZenoChatResponse,
  type ZenoConversationSummary,
  type ZenoInvestigation,
  type ZenoTurn,
} from "@/lib/api/jarvis-schemas";
import {
  formatUtc,
  jarvisErrorKind,
  splitStoredAnswer,
  STARTER_QUESTIONS,
} from "@/lib/jarvis/presentation";
import { relativeTime } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

import { AnswerBlock, QuestionBubble } from "@/components/jarvis/answer";
import { JarvisNotice } from "@/components/jarvis/readiness";

export const QUESTION_INPUT_ID = "jarvis-question";
const MAX_QUESTION = 2000;

export type AskNotice = { kind: ReturnType<typeof jarvisErrorKind>; retryAfterSeconds: number | null };

export function noticeFrom(error: unknown): AskNotice {
  if (error instanceof JarvisRequestError) {
    return { kind: jarvisErrorKind(error.code, error.status), retryAfterSeconds: error.retryAfterSeconds };
  }
  return { kind: "error", retryAfterSeconds: null };
}

function StarterState({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm leading-6 text-slate-300">
        Ask about any part of the business. Zeno plans which verified figures to read, then answers from those figures
        only. Every answer lists its evidence, and nothing is written back to BROKA.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {STARTER_QUESTIONS.map((item) => (
          <button
            key={item.question}
            type="button"
            onClick={() => onPick(item.question)}
            className="focus-ring group rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left transition hover:border-[#8b75ff]/35"
          >
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#a895ff]">{item.area}</span>
            <span className="mt-1 block text-sm leading-5 text-slate-200 group-hover:text-white">{item.question}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">Choosing a question fills the box. You can edit it before sending.</p>
    </div>
  );
}

function StoredTurn({
  turn,
  latest,
  onSuggest,
  suggestionsDisabled,
}: {
  turn: ZenoTurn;
  latest: ZenoChatResponse | null;
  onSuggest: (question: string) => void;
  suggestionsDisabled: boolean;
}) {
  const { headline, summary } = splitStoredAnswer(turn.content);
  const metadata = ZenoTurnMetadataSchema.safeParse(turn.metadata);
  const stored = metadata.success ? metadata.data : null;
  // The newest answer is kept in memory only so its structured parts (findings,
  // recommendations, suggestions) can show. The backend stores just the headline,
  // summary, evidence and limitations, so reopening an investigation shows those.
  const matchesLatest = latest !== null && turn.content === `${latest.answer.headline}\n\n${latest.answer.summary}`;
  const investigation: ZenoInvestigation | null = matchesLatest ? latest.investigation : stored?.investigation ?? null;
  return (
    <AnswerBlock
      headline={headline}
      summary={summary}
      evidence={turn.evidence}
      limitations={matchesLatest ? latest.limitations : stored?.limitations ?? []}
      findings={matchesLatest ? latest.findings : []}
      possibleCauses={matchesLatest ? latest.possible_causes : []}
      recommendations={matchesLatest ? latest.recommendations : []}
      relatedPages={matchesLatest ? latest.related_pages : []}
      suggestedQuestions={matchesLatest ? latest.suggested_questions : []}
      investigation={investigation}
      onSuggest={onSuggest}
      suggestionsDisabled={suggestionsDisabled}
    />
  );
}

export type InvestigationPanelProps = {
  active: ZenoConversationSummary | null;
  turns: ZenoTurn[];
  turnsLoading: boolean;
  turnsError: unknown;
  hasEarlierTurns: boolean;
  onLoadEarlier: () => void;
  latest: ZenoChatResponse | null;
  pendingQuestion: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onSuggest: (question: string) => void;
  onNew: () => void;
  onOpenHistory: () => void;
  historyCount: number;
  canAsk: boolean;
  composerNote: string | null;
  notice: AskNotice | null;
  onDismissNotice: () => void;
};

/** The conversation Zeno is in the middle of, and the box for the next question. */
export function InvestigationPanel({
  active,
  turns,
  turnsLoading,
  turnsError,
  hasEarlierTurns,
  onLoadEarlier,
  latest,
  pendingQuestion,
  draft,
  onDraftChange,
  onSubmit,
  onSuggest,
  onNew,
  onOpenHistory,
  historyCount,
  canAsk,
  composerNote,
  notice,
  onDismissNotice,
}: InvestigationPanelProps) {
  const logRef = useRef<HTMLDivElement | null>(null);
  const busy = pendingQuestion !== null;
  const hasConversation = active !== null || latest !== null || pendingQuestion !== null;
  const latestMatchedTurn = latest
    ? turns.some((turn) => turn.role === "assistant" && turn.content === `${latest.answer.headline}\n\n${latest.answer.summary}`)
    : true;

  // Keep the newest answer in view. On narrow screens the page itself scrolls,
  // so this only moves the transcript when it is its own scroll region.
  useEffect(() => {
    const element = logRef.current;
    if (element && (latest || pendingQuestion)) element.scrollTop = element.scrollHeight;
  }, [latest, pendingQuestion, turns.length]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!busy && canAsk && draft.trim()) onSubmit();
    }
  }

  function handleNew() {
    onNew();
    window.setTimeout(() => document.getElementById(QUESTION_INPUT_ID)?.focus(), 0);
  }

  const remaining = MAX_QUESTION - draft.length;
  const title = active ? active.title : "Investigate with Zeno";
  const description = active
    ? `${active.turn_count} turn${active.turn_count === 1 ? "" : "s"} · last updated ${relativeTime(active.updated_at)} · kept until ${formatUtc(active.expires_at)}`
    : "Start a new investigation or continue one from the history.";

  return (
    <Panel
      id="jarvis-investigation"
      eyebrow="Conversational investigation"
      title={title}
      description={description}
      actions={
        <>
          <button
            type="button"
            onClick={onOpenHistory}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs! font-semibold text-slate-200 hover:border-white/25 lg:hidden"
          >
            <History size={13} aria-hidden="true" />
            History ({historyCount})
          </button>
          <button
            type="button"
            onClick={handleNew}
            disabled={busy}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/35 bg-[#8b75ff]/12 px-3 py-1.5 text-xs! font-semibold text-[#ded8ff] hover:border-[#8b75ff]/60 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus size={13} aria-hidden="true" />
            New investigation
          </button>
        </>
      }
    >
      <div className="flex flex-col">
        <div
          ref={logRef}
          role="log"
          aria-label="Investigation transcript"
          aria-live="polite"
          className={cn(
            "scroll-thin min-h-[10rem] space-y-6 pr-1",
            hasConversation && "lg:max-h-[min(62vh,44rem)] lg:overflow-y-auto",
          )}
        >
          {!hasConversation ? (
            <StarterState onPick={onSuggest} />
          ) : (
            <>
              {hasEarlierTurns ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={onLoadEarlier}
                    disabled={turnsLoading}
                    className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs! font-semibold text-slate-300 hover:text-white disabled:opacity-50"
                  >
                    Load earlier messages
                  </button>
                </div>
              ) : null}

              {turnsError ? (
                <JarvisNotice
                  kind={
                    turnsError instanceof JarvisRequestError
                      ? jarvisErrorKind(turnsError.code, turnsError.status)
                      : "error"
                  }
                />
              ) : null}

              {turnsLoading && turns.length === 0 ? (
                <div aria-busy="true">
                  <p className="sr-only" role="status">
                    Loading this investigation
                  </p>
                  <SkeletonPanel rows={1} />
                </div>
              ) : null}

              {turns.map((turn) =>
                turn.role === "user" ? (
                  <QuestionBubble key={turn.id} text={turn.content} />
                ) : (
                  <StoredTurn
                    key={turn.id}
                    turn={turn}
                    latest={latest}
                    onSuggest={onSuggest}
                    suggestionsDisabled={busy}
                  />
                ),
              )}

              {pendingQuestion !== null ? (
                <div className="space-y-3">
                  <QuestionBubble text={pendingQuestion} pending />
                  <p role="status" className="flex items-center gap-2 pl-1 text-xs text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#54d7e9] motion-safe:animate-pulse" aria-hidden="true" />
                    Zeno is reading the verified figures for this question.
                  </p>
                </div>
              ) : null}

              {latest && !latestMatchedTurn ? (
                <AnswerBlock
                  headline={latest.answer.headline}
                  summary={latest.answer.summary}
                  evidence={latest.evidence}
                  limitations={latest.limitations}
                  findings={latest.findings}
                  possibleCauses={latest.possible_causes}
                  recommendations={latest.recommendations}
                  relatedPages={latest.related_pages}
                  suggestedQuestions={latest.suggested_questions}
                  investigation={latest.investigation}
                  onSuggest={onSuggest}
                  suggestionsDisabled={busy}
                />
              ) : null}
            </>
          )}
        </div>

        {notice ? (
          <div className="mt-5">
            <JarvisNotice
              kind={notice.kind}
              retryAfterSeconds={notice.retryAfterSeconds}
              onDismiss={onDismissNotice}
            />
          </div>
        ) : null}

        <form
          className="mt-5 space-y-2 border-t border-white/[0.07] pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && canAsk && draft.trim()) onSubmit();
          }}
        >
          <label htmlFor={QUESTION_INPUT_ID} className="text-xs font-semibold text-slate-300">
            Question for Zeno
          </label>
          <textarea
            id={QUESTION_INPUT_ID}
            rows={2}
            maxLength={MAX_QUESTION}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about revenue, supply, trust, operations, finance or growth"
            aria-describedby="jarvis-question-hint"
            aria-busy={busy}
            className="focus-ring w-full resize-y rounded-xl border border-white/12 bg-[#05060d]/80 px-4 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-600"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="jarvis-question-hint" className="text-[11px] leading-4 text-slate-500">
              {composerNote ?? "Enter sends. Shift+Enter adds a line."}
              {remaining <= 200 ? ` ${remaining} characters left.` : ""}
            </p>
            <button
              type="submit"
              disabled={busy || !canAsk || draft.trim() === ""}
              className="focus-ring inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8b75ff] to-[#6366f1] px-4 py-2 text-sm! font-semibold text-white shadow-[0_8px_24px_rgba(139,117,255,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
            >
              {busy ? "Investigating…" : "Ask Zeno"}
            </button>
          </div>
        </form>
      </div>
    </Panel>
  );
}
