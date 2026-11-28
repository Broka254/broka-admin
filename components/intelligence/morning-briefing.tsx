"use client";

import { ArrowUpRight, BrainCircuit, ChevronDown, ChevronUp, Lightbulb, RefreshCw, Telescope } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Chip, Panel } from "@/components/intelligence/visuals";
import { UnavailablePanel } from "@/components/ui/primitives";
import { InfoTip } from "@/components/ui/tooltip";
import type { ZenoBriefingFinding, ZenoBriefingSeverity } from "@/lib/api/jarvis-schemas";
import { formatCount, isInternalHref, relativeTime } from "@/lib/intelligence";
import { JarvisRequestError, useJarvisBriefing } from "@/hooks/use-jarvis";

/**
 * The founder's AI morning briefing: the deterministic /admin/zeno/briefing
 * read rendered as a command-deck instrument. Nothing is invented here — the
 * panel only shows what the schema validated, and every failure mode has an
 * honest state (loading, not deployed, Jarvis disabled, error).
 */

const SEVERITY_ORDER: readonly ZenoBriefingSeverity[] = ["critical", "high", "warning", "positive", "info"];

const SEVERITY_UI: Record<ZenoBriefingSeverity, { label: string; tone: "danger" | "warning" | "success" | "info"; rail: string }> = {
  critical: { label: "Act now", tone: "danger", rail: "var(--broka-rose)" },
  high: { label: "Priority", tone: "danger", rail: "rgb(251 113 133 / 0.72)" },
  warning: { label: "Watch", tone: "warning", rail: "var(--broka-amber)" },
  positive: { label: "Working", tone: "success", rail: "var(--broka-emerald)" },
  info: { label: "Context", tone: "info", rail: "var(--broka-cyan)" },
};

function sortFindings(findings: readonly ZenoBriefingFinding[]): ZenoBriefingFinding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

function countBySeverity(findings: readonly ZenoBriefingFinding[]): Record<ZenoBriefingSeverity, number> {
  const counts = { critical: 0, high: 0, warning: 0, positive: 0, info: 0 } as Record<ZenoBriefingSeverity, number>;
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

type FailureKind = "missing" | "disabled" | "error";

function failureState(error: unknown): { kind: FailureKind; detail: string } {
  if (error instanceof JarvisRequestError) {
    if (error.status === 404) {
      return { kind: "missing", detail: "GET /admin/zeno/briefing is not served by the connected backend yet. The briefing appears after the Jarvis-enabled BROKA API deploy — nothing else on this page is affected." };
    }
    if (error.status === 403) {
      return { kind: "disabled", detail: "Jarvis Mode is not enabled for this deployment or this administrator, so the deterministic briefing is unavailable." };
    }
    return { kind: "error", detail: error.message };
  }
  return { kind: "error", detail: "The briefing could not be loaded." };
}

function FindingRow({ finding }: { finding: ZenoBriefingFinding }) {
  const ui = SEVERITY_UI[finding.severity];
  const content: ReactNode = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={ui.tone}>{ui.label}</Chip>
        <span className="hud-readout">{finding.area}</span>
        {!finding.evidence_backed ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">signal only</span>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-semibold leading-5 text-slate-100">{finding.title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{finding.detail}</p>
      {finding.evidence.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {finding.evidence.slice(0, 4).map((item) => (
            <span key={item} className="rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[10px] tabular-nums text-slate-400">{item}</span>
          ))}
          {finding.evidence.length > 4 ? <span className="text-[10px] text-slate-600">+{finding.evidence.length - 4} more</span> : null}
        </div>
      ) : null}
    </>
  );
  const classes = "priority-row group block";
  if (finding.href && isInternalHref(finding.href)) {
    return (
      <div className={classes} data-tone={finding.severity === "critical" || finding.severity === "high" ? "danger" : finding.severity === "warning" ? "warning" : finding.severity === "positive" ? "success" : "info"}>
        <div className="pointer-events-none relative z-10">{content}</div>
        <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 transition group-hover:text-[#a895ff]">Open <ArrowUpRight size={11} aria-hidden="true" /></span>
        <Link href={finding.href} className="focus-ring absolute inset-0 z-0" aria-label={`Open the surface behind: ${finding.title}`} />
      </div>
    );
  }
  return <div className={classes} data-tone={finding.severity === "critical" || finding.severity === "high" ? "danger" : finding.severity === "warning" ? "warning" : finding.severity === "positive" ? "success" : "info"}>{content}</div>;
}

function BriefingLoading() {
  return (
    <div className="space-y-4" aria-busy="true" role="status">
      <div className="flex items-center gap-2">
        <BrainCircuit size={14} className="text-[#a895ff]" aria-hidden="true" />
        <span className="hud-readout">Compiling the founder briefing…</span>
      </div>
      <div className="skeleton h-5 w-2/3 max-w-md" />
      <div className="space-y-2"><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-11/12" /><div className="skeleton h-3 w-4/5" /></div>
      <div className="grid gap-3 pt-1 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton h-24" />)}
      </div>
    </div>
  );
}

export function MorningBriefing({ windowDays, className }: { windowDays: number; className?: string }) {
  const briefing = useJarvisBriefing(windowDays);
  const [expanded, setShowAllFindings] = useState(false);

  if (briefing.isPending) {
    return (
      <section className={className} aria-label="AI morning briefing">
        <Panel id="briefing" eyebrow="Command intelligence" title="AI morning briefing" description="The deterministic founder briefing from Jarvis Mode: what changed, what needs a decision, and where to look first." tag="ZNO/BRF">
          <BriefingLoading />
        </Panel>
      </section>
    );
  }

  if (briefing.error) {
    const failure = failureState(briefing.error);
    if (failure.kind === "missing" || failure.kind === "disabled") {
      return (
        <section className={className} aria-label="AI morning briefing">
          <UnavailablePanel
            compact
            title={failure.kind === "missing" ? "The AI briefing needs the Jarvis-enabled BROKA API" : "Jarvis Mode is switched off for this deployment"}
            detail={failure.detail}
          />
        </section>
      );
    }
    return (
      <section className={className} aria-label="AI morning briefing">
        <Panel id="briefing" eyebrow="Command intelligence" title="AI morning briefing" tag="ZNO/BRF">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300">{failure.detail}</p>
            <button type="button" onClick={() => void briefing.refetch()} className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:text-white">
              <RefreshCw size={12} aria-hidden="true" />Retry
            </button>
          </div>
        </Panel>
      </section>
    );
  }

  const data = briefing.data;
  if (!data) return null;
  const findings = sortFindings(data.priority_findings);
  const counts = countBySeverity(data.priority_findings);
  const visible = expanded ? findings : findings.slice(0, 4);
  const attention = counts.critical + counts.high;

  return (
    <section className={className} aria-label="AI morning briefing">
      <Panel
        id="briefing"
        eyebrow="Command intelligence"
        title="AI morning briefing"
        description="The deterministic founder briefing from Jarvis Mode. Every figure traces to backend evidence; nothing is invented and no model call is required."
        tag="ZNO/BRF"
        actions={
          <>
            {attention > 0 ? <Chip tone="danger">{formatCount(attention)} to act on</Chip> : <Chip tone="success">Nothing urgent</Chip>}
            <Chip tone={data.cached ? "neutral" : "info"}>{data.cached ? "Cached read" : "Fresh read"}</Chip>
            <span className="freshness-chip"><span className="freshness-dot" data-state="ready" aria-hidden="true" /><span className="font-semibold text-slate-300">Generated {relativeTime(data.generated_at)}</span></span>
          </>
        }
      >
        <div className="relative">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-display text-xl font-bold tracking-[-0.03em] text-white neon-glow">{data.headline}</p>
          </div>
          <p className="mt-3 max-w-4xl text-[13px] leading-6 text-slate-300">{data.executive_summary}</p>

          {findings.length ? (
            <div className="mt-5">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="hud-label">Priority findings</p>
                {findings.length > 4 ? (
                  <button type="button" onClick={() => setShowAllFindings((value) => !value)} aria-expanded={expanded} className="focus-ring inline-flex items-center gap-1 rounded-lg border border-white/[0.09] bg-white/[0.025] px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-[#8b75ff]/40 hover:text-white">
                    {expanded ? <>Fewer <ChevronUp size={12} aria-hidden="true" /></> : <>All {findings.length} findings <ChevronDown size={12} aria-hidden="true" /></>}
                  </button>
                ) : null}
              </div>
              <div className="stagger space-y-2.5">
                {visible.map((finding) => <FindingRow key={finding.id} finding={finding} />)}
              </div>
            </div>
          ) : null}

          {data.opportunities.length || data.recommended_investigations.length ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {data.opportunities.length ? (
                <div className="inset-panel hud-frame hud-frame--cyan p-4">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#54d7e9]"><Lightbulb size={13} aria-hidden="true" />Opportunities</p>
                  <ul className="mt-3 space-y-3">
                    {data.opportunities.slice(0, 3).map((opportunity) => (
                      <li key={opportunity.title} className="text-xs leading-5 text-slate-300">
                        <p className="font-semibold text-slate-100">{opportunity.title}</p>
                        <p className="mt-0.5 text-slate-400">{opportunity.detail}</p>
                        {opportunity.href && isInternalHref(opportunity.href) ? (
                          <Link href={opportunity.href} className="focus-ring mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#a895ff] hover:text-[#ded8ff]">Open <ArrowUpRight size={11} aria-hidden="true" /></Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.recommended_investigations.length ? (
                <div className="inset-panel hud-frame p-4">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a895ff]"><Telescope size={13} aria-hidden="true" />Recommended investigations</p>
                  <ol className="mt-3 space-y-2">
                    {data.recommended_investigations.slice(0, 4).map((item, index) => (
                      <li key={item} className="flex items-baseline gap-2.5 text-xs leading-5 text-slate-300">
                        <span className="hud-readout shrink-0">{String(index + 1).padStart(2, "0")}</span>
                        <span className="min-w-0">{item}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-[10px] text-slate-600">Ask Jarvis Mode to run any of these — every answer cites its evidence.</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3">
            <span className="hud-readout">{formatCount(data.evidence.length)} evidence items</span>
            {data.limitations.length ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
                {data.limitations.length} stated limitation{data.limitations.length === 1 ? "" : "s"}
                <InfoTip label="What this briefing does not claim">
                  <ul className="list-disc space-y-1 pl-4 text-left text-xs normal-case tracking-normal text-slate-300">
                    {data.limitations.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </InfoTip>
              </span>
            ) : null}
            <span className="ml-auto text-[10px] text-slate-600">Read through the same-origin proxy; responses are schema-validated before render.</span>
          </div>
        </div>
      </Panel>
    </section>
  );
}
