"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { COMMAND_INPUT_ID } from "@/components/jarvis/core/command-bar";
import { CORE_LABEL, ZenoCore, coreStateFor } from "@/components/jarvis/core/zeno-core";
import { useJarvis } from "@/components/jarvis/provider";
import { JarvisNotice } from "@/components/jarvis/readiness";
import { EmptyNote, FreshnessTag, GlassPanel, PageHeading, SectionHeader } from "@/components/jarvis/ui/primitives";
import { Skeleton } from "@/components/ui/primitives";
import { JarvisRequestError } from "@/hooks/use-jarvis";
import { formatCount } from "@/lib/intelligence";
import { DOMAIN_ORDER, DOMAINS } from "@/lib/jarvis/command-centre";
import { jarvisErrorKind, lastErrorLabel } from "@/lib/jarvis/presentation";
import { cn } from "@/lib/utils";

const STATE_DESCRIPTION: Record<string, string> = {
  checking: "Checking readiness before any question can be sent.",
  ready: "Answers come from verified figures, and each one shows its evidence.",
  "model-not-ready": "The model gateway is not ready. Briefings and the figures on every page still work.",
  disabled: "Zeno is not enabled on this deployment. The command centre and domain figures still work.",
  unavailable: "Zeno could not be reached. You can still try a question.",
};

function Diagnostic({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "good" | "bad" | "neutral" }) {
  return (
    <div className="inset-panel min-w-0 space-y-1.5 p-3">
      <dt className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            tone === "good" ? "bg-emerald-400" : tone === "bad" ? "bg-rose-400" : "bg-slate-500",
          )}
          aria-hidden="true"
        />
        {label}
      </dt>
      <dd className="break-words text-sm font-semibold text-slate-100">{value}</dd>
    </div>
  );
}

/**
 * Zeno's readiness and what it can investigate now. Its suggestions only fill
 * the command bar's input; nothing is sent until an administrator presses Ask.
 */
export function IntelligenceCoreView() {
  const jarvis = useJarvis();
  const state = coreStateFor({
    availability: jarvis.availability,
    investigating: jarvis.activity.pendingQuestion !== null,
  });
  const status = jarvis.status.data;
  const statusError = jarvis.status.error instanceof JarvisRequestError ? jarvis.status.error : null;
  const briefing = jarvis.briefing.data;
  const saved = jarvis.investigation.conversations.data?.pages[0]?.total ?? jarvis.investigation.summaries.length;
  const savedKnown = jarvis.investigation.conversations.isPending ? null : saved;
  const recommended = briefing?.recommended_investigations ?? [];
  const limitations = briefing?.limitations ?? [];

  function prefill(question: string) {
    jarvis.setDraft(question);
    document.getElementById(COMMAND_INPUT_ID)?.focus();
  }

  let readiness: ReactNode;
  if (jarvis.availability === "disabled") {
    readiness = <JarvisNotice kind="disabled" />;
  } else if (statusError) {
    readiness = <JarvisNotice kind={jarvisErrorKind(statusError.code, statusError.status)} />;
  } else if (!status) {
    readiness = <Skeleton className="h-40" />;
  } else {
    const providers = status.providers_configured;
    readiness = (
      <dl className="grid gap-3 sm:grid-cols-2">
        <Diagnostic label="Jarvis Mode" value={status.enabled ? "Enabled" : "Disabled"} tone={status.enabled ? "good" : "bad"} />
        <Diagnostic
          label="Model gateway"
          value={status.model_gateway_ready ? "Ready" : "Not ready"}
          tone={status.model_gateway_ready ? "good" : "bad"}
        />
        <Diagnostic
          label="Providers configured"
          value={providers.length > 0 ? providers.join(", ") : "None configured"}
          tone={providers.length > 0 ? "good" : "bad"}
        />
        <Diagnostic
          label="Tool registry"
          value={status.tool_registry_ready ? `Ready · ${formatCount(status.tool_count)} tools` : "Not ready"}
          tone={status.tool_registry_ready ? "good" : "bad"}
        />
        <Diagnostic
          label="Last model error"
          value={lastErrorLabel(status.last_error_category)}
          tone={status.last_error_category ? "bad" : "neutral"}
        />
      </dl>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Jarvis Mode · Zeno"
        title="Intelligence Core"
        description="Zeno's readiness, what it reads, and the investigations it can run now. Zeno answers from BROKA's verified figures and shows the evidence for each claim. It never changes marketplace records."
      />

      <GlassPanel raised labelledBy="core-state" className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <div className="flex justify-center md:justify-start">
          <ZenoCore state={state} size="lg" />
        </div>
        <div className="space-y-4">
          <SectionHeader
            id="core-state"
            eyebrow="Current state"
            title={CORE_LABEL[state]}
            description={STATE_DESCRIPTION[jarvis.availability] ?? ""}
            meta={status ? <FreshnessTag kind="snapshot" label="Checked" at={status.generated_at} /> : null}
          />
          <Link
            href="/assistant/studio"
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[#8b75ff]/35 bg-[#8b75ff]/10 px-3.5 py-2 text-sm! font-semibold text-[#ded8ff] hover:border-[#8b75ff]/60"
          >
            Open the Investigation Studio <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </GlassPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <GlassPanel labelledBy="core-readiness" className="space-y-4">
          <SectionHeader
            id="core-readiness"
            eyebrow="Readiness"
            title="Diagnostics"
            description="Names and counts only. Keys and provider messages are never shown."
          />
          {readiness}
        </GlassPanel>

        <GlassPanel labelledBy="core-saved" className="space-y-4">
          <SectionHeader
            id="core-saved"
            eyebrow="History"
            title="Saved investigations"
            description="Each investigation is kept by BROKA and listed in the Studio, where you can continue it."
          />
          <p className="font-display text-3xl font-bold tabular-nums text-white">
            {savedKnown === null ? "—" : formatCount(savedKnown)}
          </p>
        </GlassPanel>
      </div>

      <GlassPanel labelledBy="core-suggested" className="space-y-6">
        <SectionHeader
          id="core-suggested"
          eyebrow="Suggested investigations"
          title="Questions Zeno can answer now"
          description="Choosing a question fills the command bar. Nothing is sent until you press Ask."
        />
        {recommended.length > 0 ? (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">From today&apos;s briefing</p>
            <div className="flex flex-wrap gap-2">
              {recommended.slice(0, 6).map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={!jarvis.canAsk}
                  onClick={() => prefill(item)}
                  className="focus-ring rounded-full border border-white/10 px-3 py-1.5 text-left text-xs! text-slate-300 hover:border-[#8b75ff]/35 hover:text-white disabled:opacity-45"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {DOMAIN_ORDER.map((key) => (
          <div key={key} className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{DOMAINS[key].title}</p>
            <div className="flex flex-wrap gap-2">
              {DOMAINS[key].questions.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={!jarvis.canAsk}
                  onClick={() => prefill(question)}
                  className="focus-ring rounded-full border border-white/10 px-3 py-1.5 text-left text-xs! text-slate-300 hover:border-[#8b75ff]/35 hover:text-white disabled:opacity-45"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ))}
      </GlassPanel>

      <GlassPanel labelledBy="core-limits" className="space-y-4">
        <SectionHeader
          id="core-limits"
          eyebrow="Limits"
          title="What Zeno cannot see yet"
          description="Stated by the latest briefing. An answer never fills a gap with a guess."
        />
        {limitations.length === 0 ? (
          <EmptyNote>The latest briefing states no limitations.</EmptyNote>
        ) : (
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-400">
            {limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
