"use client";

import { AlertTriangle, ArrowRight, ArrowUpRight, BadgeCheck, BellRing, CircleAlert, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { buildAlerts } from "@/components/dashboard/command-center";
import { DataFreshness, SectionHeading } from "@/components/intelligence/visuals";
import { StatusBadge, UnavailablePanel } from "@/components/ui/primitives";
import { isEndpointMissing } from "@/hooks/use-admin-resource";
import type { AdminResourcePayloads } from "@/lib/api/schemas";
import type { Insight, InsightSeverity } from "@/lib/api/intelligence-schemas";
import { areaLabel, evidenceEntries, formatCount, isInternalHref, SEVERITY_META, SEVERITY_ORDER } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

type Snapshot = AdminResourcePayloads["opsSnapshot"];
type Health = AdminResourcePayloads["serviceHealth"];
type DerivedAlert = ReturnType<typeof buildAlerts>[number];

export type PriorityKind = "queue" | "insight";
export type PrioritySignal = {
  id: string;
  kind: PriorityKind;
  severity: InsightSeverity;
  title: string;
  detail: string;
  href: string | null;
  cta: string;
  area?: string;
  evidence: Array<{ label: string; value: string }>;
};

/** Severity first; within a severity, operational queues outrank rules. */
const SEVERITY_RANK: Record<InsightSeverity, number> = Object.fromEntries(
  SEVERITY_ORDER.map((severity, index) => [severity, index]),
) as Record<InsightSeverity, number>;

export const PRIORITY_FILTERS: Array<{ value: InsightSeverity | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "opportunity", label: "Opportunity" },
  { value: "positive", label: "Working" },
];

/**
 * One ranked queue over two genuinely different signal types. Queue alerts
 * are live counts from the ops snapshot; insights are deterministic rules.
 * Ordering uses the backend severity of each item and never invents urgency.
 */
export function mergePrioritySignals({ alerts, insights }: { alerts: DerivedAlert[]; insights: Insight[] }): PrioritySignal[] {
  const queueSignals: PrioritySignal[] = alerts.map((alert) => ({
    id: `queue-${alert.id}`,
    kind: "queue",
    severity: alert.tone === "danger" ? "critical" : "warning",
    title: alert.title,
    detail: alert.detail,
    href: alert.href,
    cta: alert.cta,
    evidence: [],
  }));
  const insightSignals: PrioritySignal[] = insights.map((insight) => ({
    id: `insight-${insight.id}`,
    kind: "insight",
    severity: insight.severity,
    title: insight.title,
    detail: insight.detail,
    href: insight.action?.href ?? null,
    cta: insight.action?.label ?? "Open intelligence",
    area: insight.area,
    evidence: evidenceEntries(insight.evidence, 3).map((entry) => ({ label: entry.label, value: entry.value })),
  }));
  return [...queueSignals, ...insightSignals]
    .map((signal, index) => ({ signal, index }))
    .sort((a, b) => {
      const severity = SEVERITY_RANK[a.signal.severity] - SEVERITY_RANK[b.signal.severity];
      if (severity !== 0) return severity;
      if (a.signal.kind !== b.signal.kind) return a.signal.kind === "queue" ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ signal }) => signal);
}

export function filterPrioritySignals(signals: PrioritySignal[], filter: InsightSeverity | "all"): PrioritySignal[] {
  if (filter === "all") return signals;
  return signals.filter((signal) => signal.severity === filter);
}

export function countPrioritySignals(signals: PrioritySignal[]): Record<InsightSeverity | "all", number> {
  const counts = { all: signals.length, critical: 0, warning: 0, opportunity: 0, info: 0, positive: 0 } as Record<InsightSeverity | "all", number>;
  for (const signal of signals) counts[signal.severity] += 1;
  return counts;
}

function KindChip({ signal }: { signal: PrioritySignal }) {
  if (signal.kind === "queue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-100/90">
        <BellRing size={9} aria-hidden="true" /> Queue signal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#8b75ff]/25 bg-[#8b75ff]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#ded8ff]">
      <Sparkles size={9} aria-hidden="true" /> Rule · {areaLabel(signal.area ?? "")}
    </span>
  );
}

function PriorityRow({ signal, rank }: { signal: PrioritySignal; rank: number }) {
  const meta = SEVERITY_META[signal.severity];
  const href = signal.href && isInternalHref(signal.href) ? signal.href : null;
  return (
    <li className="priority-row" data-tone={meta.tone} data-testid={`priority-${signal.id}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-black/25 font-display text-[11px] font-bold tabular-nums text-slate-400" aria-hidden="true">{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <KindChip signal={signal} />
            <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em]", meta.text)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", meta.bar)} aria-hidden="true" />
              {meta.label}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-100">{signal.title}</p>
          <p className="mt-1 text-[11.5px] leading-5 text-slate-400">{signal.detail}</p>
          {signal.evidence.length ? (
            <dl className="mt-2 flex flex-wrap gap-1.5">
              {signal.evidence.map((entry) => (
                <div key={`${entry.label}-${entry.value}`} className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-0.5 text-[10px]">
                  <dt className="inline text-slate-500">{entry.label}: </dt>
                  <dd className="inline font-semibold tabular-nums text-slate-200">{entry.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {href ? (
          <Link href={href} className="focus-ring mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.09] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold text-slate-200 transition hover:border-[#8b75ff]/45 hover:text-[#ded8ff]">
            <span className="hidden sm:inline">{signal.cta}</span>
            <span className="sm:hidden">Open</span>
            <ArrowUpRight size={11} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function PriorityQueue({ insights, insightsLoading, insightsError, onRetryInsights, snapshot, health, snapshotState, windowDays }: {
  insights?: { insights: Insight[]; generated_at: string; counts: Record<string, number> };
  insightsLoading: boolean;
  insightsError: unknown;
  onRetryInsights?: () => void;
  snapshot?: Snapshot;
  health?: Health;
  snapshotState: "loading" | "ready" | "error" | "not-deployed" | "unavailable";
  windowDays: number;
}) {
  const [filter, setFilter] = useState<InsightSeverity | "all">("all");
  const alerts = useMemo(() => (snapshot ? buildAlerts(snapshot, health) : []), [snapshot, health]);
  const signals = useMemo(() => mergePrioritySignals({ alerts, insights: insights?.insights ?? [] }), [alerts, insights]);
  const counts = useMemo(() => countPrioritySignals(signals), [signals]);
  const filtered = useMemo(() => filterPrioritySignals(signals, filter), [signals, filter]);
  const insightsMissing = isEndpointMissing(insightsError);
  const insightsAbsent = insightsMissing || (!insightsLoading && !insightsError && !insights);
  const bothUnavailable = !snapshot && insightsAbsent;
  const loading = insightsLoading && !snapshot;

  return (
    <section className="instrument-panel p-5 sm:p-6" aria-labelledby="priority-heading">
      <SectionHeading
        id="priority-heading"
        eyebrow="Needs attention"
        title="Ranked priority queue"
        description="Operational queue counts and deterministic market rules in one reading order. Queue signals are live backend counts; rule signals explain their evidence. Severity comes from the backend, not from this view."
        meta={
          <DataFreshness
            state={loading ? "loading" : bothUnavailable ? "unavailable" : insightsError ? "error" : "ready"}
            generatedAt={insights?.generated_at}
            windowLabel={`last ${windowDays} days`}
            source="Rule signals use GET /admin/intelligence/insights. Queue signals use GET /admin/ops-snapshot and the service-health checks."
          />
        }
        actions={
          <>
            <StatusBadge tone={counts.critical ? "danger" : "success"}>{counts.critical ? `${counts.critical} critical` : "No critical items"}</StatusBadge>
            {counts.warning ? <StatusBadge tone="warning">{counts.warning} warning{counts.warning === 1 ? "" : "s"}</StatusBadge> : null}
            {counts.opportunity ? <StatusBadge tone="info">{counts.opportunity} opportunit{counts.opportunity === 1 ? "y" : "ies"}</StatusBadge> : null}
          </>
        }
      />

      {bothUnavailable ? (
        <UnavailablePanel
          compact
          title="The priority queue needs the upgraded BROKA API"
          detail="Neither /admin/ops-snapshot nor /admin/intelligence/insights is served by the connected backend. Verified platform totals still appear below; no priority is inferred without backend evidence."
        />
      ) : loading ? (
        <div className="mt-4 space-y-2" aria-busy="true">{Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-[86px]" />)}</div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Filter the priority queue by severity">
            {PRIORITY_FILTERS.map((option) => {
              const count = counts[option.value];
              if (option.value !== "all" && count === 0) return null;
              const active = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    "focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                    active ? "border-[#8b75ff]/45 bg-[#8b75ff]/15 text-[#ded8ff]" : "border-white/[0.08] text-slate-400 hover:text-slate-100",
                  )}
                >
                  {option.label}
                  <span className={cn("rounded-full px-1.5 text-[9px] font-black tabular-nums", active ? "bg-[#8b75ff]/25 text-[#ded8ff]" : "bg-white/[0.06] text-slate-500")}>{count}</span>
                </button>
              );
            })}
            <span className="ml-auto text-[10px] text-slate-600">
              {snapshot ? `Queue window ${snapshot.window_hours}h` : "Queue signals unavailable"} · {signals.length} ranked item{signals.length === 1 ? "" : "s"}
            </span>
          </div>

          {filtered.length ? (
            <ol className="mt-3 space-y-2" aria-label="Priority items">
              {filtered.slice(0, 8).map((signal, index) => <PriorityRow key={signal.id} signal={signal} rank={index + 1} />)}
            </ol>
          ) : signals.length ? (
            <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/15 p-5">
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-200"><CircleAlert size={14} className="text-slate-400" aria-hidden="true" />No item matches this filter for the last {windowDays} days.</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">This is not a claim that the marketplace is healthy; it only means no backend signal currently carries this severity.</p>
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-300/25 bg-emerald-400/10 text-emerald-200"><BadgeCheck size={15} aria-hidden="true" /></span>
              <div>
                <p className="text-sm font-semibold text-slate-100">No item met a threshold in this period</p>
                <p className="mt-1 text-[11.5px] leading-5 text-slate-400">Every operational queue reports zero and no rule fired for the last {windowDays} days. That is the literal result of the checks, not a forecast.</p>
              </div>
            </div>
          )}

          {insightsError && !insightsMissing ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-rose-200/80">
              <AlertTriangle size={11} aria-hidden="true" />
              Rule signals could not be refreshed; queue signals above remain live.
              {onRetryInsights ? <button type="button" onClick={onRetryInsights} className="focus-ring inline-flex items-center gap-1 font-semibold text-slate-300"><RefreshCw size={10} aria-hidden="true" />Retry</button> : null}
            </p>
          ) : null}
          {insightsMissing && snapshot ? (
            <p className="mt-3 text-[10px] leading-4 text-slate-500">Rule signals are not deployed on this backend (GET /admin/intelligence/insights returned 404). Only live queue counts are shown; no rule is simulated.</p>
          ) : null}
          {snapshotState === "not-deployed" ? (
            <p className="mt-3 text-[10px] leading-4 text-slate-500">Operational queues are not deployed on this backend (GET /admin/ops-snapshot returned 404), so the queue shows rule signals only.</p>
          ) : null}
          {counts.all > 8 && filter === "all" ? (
            <Link href="/intelligence#insights" className="focus-ring mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#a895ff] hover:text-[#ded8ff]">
              {counts.all - 8} more ranked item{counts.all - 8 === 1 ? "" : "s"}
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          ) : null}
        </>
      )}

      {!bothUnavailable && !loading && signals.length === 0 && !snapshotState.startsWith("not-deployed") ? (
        <p className="mt-2 text-[10px] text-slate-600">Rendered from the latest validated responses; nothing is estimated from visible rows.</p>
      ) : null}
      <p className="sr-only">{formatCount(signals.length)} ranked items</p>
    </section>
  );
}
