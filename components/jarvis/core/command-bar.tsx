"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ZenoCore, coreStateFor } from "@/components/jarvis/core/zeno-core";
import { useJarvis } from "@/components/jarvis/provider";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ERROR_COPY } from "@/lib/jarvis/presentation";
import { sectionForPath } from "@/lib/jarvis/sections";
import { cn } from "@/lib/utils";

export const COMMAND_INPUT_ID = "zeno-command-input";

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const AVAILABILITY_LINE: Record<string, string> = {
  checking: "Checking readiness",
  ready: "Answers come from verified figures, with their evidence",
  "model-not-ready": "The model gateway is not ready. Briefings still work.",
  disabled: "Zeno is not enabled on this deployment",
  unavailable: "Zeno could not be reached. You can still try a question.",
};

/**
 * Zeno in every Jarvis section. It shows what Zeno is doing: the question in
 * flight with the time it has taken, or the last answer. It offers the
 * current section's questions as suggestions. It never invents progress.
 */
export function ZenoCommandBar() {
  const pathname = usePathname();
  const section = sectionForPath(pathname);
  const jarvis = useJarvis();
  const reduced = useReducedMotion();
  const pending = jarvis.activity.pendingQuestion;
  const analysing = pending !== null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!analysing) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [analysing]);

  const core = coreStateFor({ availability: jarvis.availability, investigating: analysing });
  const elapsed = analysing && jarvis.activity.startedAt !== null ? Math.max(0, Math.floor((now - jarvis.activity.startedAt) / 1000)) : 0;
  const inputDisabled = !jarvis.canAsk || analysing;
  const placeholder = jarvis.availability === "disabled" ? "Zeno is not enabled on this deployment" : section.placeholder;

  let statusLine: string;
  if (analysing) {
    statusLine = `Investigating “${shorten(pending ?? "", 64)}” · ${elapsed}s`;
  } else if (jarvis.activity.lastAnswer) {
    statusLine = `Last answer: ${shorten(jarvis.activity.lastAnswer.headline, 80)}`;
  } else {
    statusLine = AVAILABILITY_LINE[jarvis.availability] ?? "";
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inputDisabled && jarvis.draft.trim()) void jarvis.submitDraft();
  }

  return (
    <section aria-label="Zeno command bar" className="jv-glass-raised sticky top-[4.25rem] z-20 overflow-hidden rounded-2xl border border-white/[0.09] shadow-[0_18px_50px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <ZenoCore state={core} size="sm" />
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a895ff]">Zeno · {section.label}</p>
          <p className="truncate text-xs text-slate-400" aria-live="polite">
            {statusLine}
          </p>
        </div>
        <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xl sm:flex-none sm:basis-[28rem]">
          <label htmlFor={COMMAND_INPUT_ID} className="sr-only">
            Ask Zeno
          </label>
          <input
            id={COMMAND_INPUT_ID}
            value={jarvis.draft}
            onChange={(event) => jarvis.setDraft(event.target.value)}
            disabled={inputDisabled}
            maxLength={2000}
            placeholder={placeholder}
            className="focus-ring min-w-0 flex-1 rounded-xl border border-white/12 bg-[#05060d]/80 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={inputDisabled || jarvis.draft.trim() === ""}
            className="focus-ring shrink-0 rounded-xl bg-gradient-to-r from-[#8b75ff] to-[#6366f1] px-3.5 py-2 text-sm! font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {analysing ? "Working" : "Ask"}
          </button>
        </form>
        {section.key === "studio" ? null : (
          <Link href="/assistant/studio" className="focus-ring hidden shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-300 hover:text-white md:inline-flex">
            Studio
          </Link>
        )}
      </div>

      {section.suggestions.length > 0 && !analysing && jarvis.canAsk ? (
        <div className="hidden flex-wrap gap-2 border-t border-white/[0.06] px-4 py-2 md:flex">
          {section.suggestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => {
                jarvis.setDraft(question);
                document.getElementById(COMMAND_INPUT_ID)?.focus();
              }}
              className="focus-ring rounded-full border border-white/10 px-2.5 py-1 text-left text-xs! text-slate-400 hover:border-[#8b75ff]/35 hover:text-slate-100"
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}

      {jarvis.notice ? (
        <p role="alert" className="border-t border-rose-400/20 bg-rose-400/[0.06] px-4 py-2 text-xs text-rose-100">
          {ERROR_COPY[jarvis.notice.kind].title}.
          <button type="button" onClick={jarvis.dismissNotice} className="focus-ring ml-2 rounded-md font-semibold underline-offset-2 hover:underline">
            Dismiss
          </button>
        </p>
      ) : null}

      {analysing ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden">
          <span className={cn("block h-full w-1/3 bg-gradient-to-r from-transparent via-[#8b75ff] to-[#54d7e9]", reduced ? "w-full opacity-30" : "jv-sweep")} />
        </span>
      ) : null}
    </section>
  );
}
