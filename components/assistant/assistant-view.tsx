"use client";

import { Bot, Send } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Chip, PageHeader, Panel } from "@/components/intelligence/visuals";
import { AdminRequestError } from "@/hooks/use-admin-resource";
import { useAskAssistant } from "@/hooks/use-assistant";
import type { Answer } from "@/lib/api/assistant-schemas";
import { formatDateTime } from "@/lib/format";

// The Intelligence Assistant. The backend computes each answer from the
// verified analytics, and every answer shows the figures behind it with their
// date range, definition and page. Nothing is stored, and no answer changes data.

const SUGGESTED = [
  "How many users are active right now?",
  "Which areas of the platform need attention?",
  "How many people signed up last week?",
  "What were payments like over the last 7 days?",
  "Which listings are receiving the most buyer interest?",
  "What will registrations look like next week?",
  "Generate a weekly performance summary.",
];

const input = "focus-ring w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600";
const button = "focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/40 bg-[#8b75ff]/15 px-3.5 py-2 text-xs font-semibold text-[#ded8ff] disabled:opacity-50";

function errorText(error: AdminRequestError | null): string | null {
  if (!error) return null;
  if (error.status === 429) return "You have asked a lot of questions in the last hour. Try again later.";
  if (error.status === 403) return "Your account cannot use the assistant.";
  return error.message;
}

function Citations({ answer }: { answer: Answer }) {
  if (!answer.citations.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-xs">
        <caption className="sr-only">Figures behind this answer</caption>
        <thead>
          <tr>
            {["Figure", "Value", "Period", "Definition", "Source", "Check"].map((heading) => (
              <th key={heading} scope="col" className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {answer.citations.map((citation, index) => (
            <tr key={`${citation.label}-${index}`} className="border-t border-white/[0.06] align-top">
              <td className="px-2 py-1.5 text-slate-200">{citation.label}</td>
              <td className="px-2 py-1.5 tabular-nums text-white">{citation.value}</td>
              <td className="px-2 py-1.5 text-slate-400">{citation.period}</td>
              <td className="px-2 py-1.5 text-slate-400">{citation.definition}</td>
              <td className="px-2 py-1.5 text-slate-500">{citation.source}</td>
              <td className="px-2 py-1.5">
                {citation.href.startsWith("/") ? <Link href={citation.href} className="focus-ring text-[#a895ff] hover:text-white">Open</Link> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnswerCard({ answer }: { answer: Answer }) {
  return (
    <Panel eyebrow="Answer" title={answer.question} actions={answer.refused ? <Chip tone="warning">Not carried out</Chip> : undefined}>
      <div className="space-y-4">
        <p data-testid="assistant-answer" className="text-sm leading-6 text-slate-100">{answer.answer}</p>
        {answer.points.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {answer.points.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}
          </ul>
        ) : null}
        <Citations answer={answer} />
        {answer.limitations.length ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Limits</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-400">
              {answer.limitations.map((limit) => <li key={limit}>{limit}</li>)}
            </ul>
          </div>
        ) : null}
        {answer.links.length ? (
          <div className="flex flex-wrap gap-2">
            {answer.links.map((link) => (
              <Link key={link.href} href={link.href} className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
        <p className="text-[11px] text-slate-600">Answered {formatDateTime(answer.generated_at)}.</p>
      </div>
    </Panel>
  );
}

export function AssistantView() {
  const ask = useAskAssistant();
  const [draft, setDraft] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);

  function submit(question: string) {
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;
    ask.mutate({ question: trimmed }, {
      onSuccess: (answer) => {
        setAnswers((list) => [answer, ...list].slice(0, 10));
        setDraft("");
      },
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(draft);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence"
        icon={<Bot size={14} />}
        title="Intelligence Assistant"
        description="Ask about the platform in plain words. Each answer is built from the verified analytics and says which date range, definitions and page it rests on. It only reads: it never changes an account, a payment or a message."
      />
      <Panel eyebrow="Ask" title="One question at a time">
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block space-y-1 text-[11px] font-semibold text-slate-400">
            Your question
            <input
              className={input}
              value={draft}
              maxLength={300}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="For example: How many users are active right now?"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={button} disabled={!draft.trim() || ask.isPending}>
              <Send size={13} aria-hidden="true" />{ask.isPending ? "Answering…" : "Ask"}
            </button>
            <span className="text-[11px] text-slate-500">{draft.length}/300</span>
          </div>
          {ask.error ? <p role="alert" className="text-xs text-rose-200">{errorText(ask.error)}</p> : null}
        </form>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Suggested questions">
          {SUGGESTED.map((question) => (
            <button
              key={question}
              type="button"
              disabled={ask.isPending}
              onClick={() => submit(question)}
              className="focus-ring rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-300 hover:text-white disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>
      </Panel>
      {answers.length ? (
        answers.map((answer, index) => <AnswerCard key={`${answer.generated_at}-${index}`} answer={answer} />)
      ) : (
        <p className="text-sm text-slate-500">No question asked yet in this session. Answers are not stored.</p>
      )}
    </div>
  );
}
