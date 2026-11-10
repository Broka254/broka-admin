"use client";

import { ArrowRight, Coins, Droplets, MessageCircle, PackageOpen, RefreshCw, ShieldAlert, ShoppingBag, Sparkles, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Chip } from "@/components/intelligence/visuals";
import { ResourceState } from "@/components/ui/primitives";
import { isEndpointMissing } from "@/hooks/use-admin-resource";
import type { Insight, InsightSeverity, InsightsResponse } from "@/lib/api/intelligence-schemas";
import { areaLabel, evidenceEntries, isInternalHref, relativeTime, SEVERITY_META, SEVERITY_ORDER } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

const AREA_ICONS: Record<string, typeof Droplets> = {
  liquidity: Droplets,
  growth: TrendingUp,
  supply: PackageOpen,
  demand: ShoppingBag,
  sellers: MessageCircle,
  trust: ShieldAlert,
  money: Coins,
  targets: Target,
};

export function InsightCard({ insight, compact = false }: { insight: Insight; compact?: boolean }) {
  const meta = SEVERITY_META[insight.severity];
  const Icon = AREA_ICONS[insight.area] ?? Sparkles;
  const evidence = evidenceEntries(insight.evidence, compact ? 2 : 4);
  return (
    <article className="insight-card group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(140deg,rgba(19,24,43,0.85),rgba(8,10,20,0.92))] p-4 pl-5" data-severity={insight.severity} data-testid={`insight-${insight.id}`}>
      <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", meta.bar, meta.glow)} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300" aria-hidden="true"><Icon size={14} /></span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{areaLabel(insight.area)}</span>
        <Chip tone={meta.tone} className="ml-auto">{meta.label}</Chip>
      </div>
      <h3 className={cn("mt-3 text-sm font-semibold leading-snug", meta.text)}>{insight.title}</h3>
      {!compact ? <p className="mt-1.5 text-xs leading-5 text-slate-400">{insight.detail}</p> : null}
      {evidence.length ? (
        <dl className="mt-3 flex flex-wrap gap-1.5">
          {evidence.map((entry) => (
            <div key={entry.key} className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1 text-[10px]">
              <dt className="inline text-slate-500">{entry.label}: </dt>
              <dd className="inline font-semibold text-slate-200 tabular-nums">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {insight.action && isInternalHref(insight.action.href) ? (
        <Link href={insight.action.href} className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/30 bg-[#8b75ff]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#ded8ff] transition hover:bg-[#8b75ff]/20">
          {insight.action.label}
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      ) : null}
    </article>
  );
}

type FeedProps = {
  data?: InsightsResponse;
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  limit?: number;
  compact?: boolean;
  columns?: 1 | 2 | 3;
};

/**
 * What needs the founder's attention, most urgent first. The backend ranks
 * and words each insight from deterministic rules; this view only filters.
 */
export function InsightFeed({ data, isLoading, error, onRetry, limit, compact = false, columns = 1 }: FeedProps) {
  const [severity, setSeverity] = useState<InsightSeverity | "all">("all");
  const insights = useMemo(() => {
    const all = data?.insights ?? [];
    const filtered = severity === "all" ? all : all.filter((insight) => insight.severity === severity);
    return limit ? filtered.slice(0, limit) : filtered;
  }, [data, severity, limit]);

  if (isLoading) return <div className="grid gap-3" aria-busy="true">{[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.025]" />)}</div>;
  if (error) {
    if (isEndpointMissing(error)) return <ResourceState state="unavailable" message="Insights need the upgraded BROKA API (GET /admin/intelligence/insights). They appear automatically after the backend deploy." />;
    return <ResourceState state="error" message={error instanceof Error ? error.message : "Insights could not be loaded."} action={onRetry ? <button type="button" onClick={onRetry} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200"><RefreshCw size={12} aria-hidden="true" />Retry</button> : undefined} />;
  }
  if (!data) return null;

  const total = data.insights.length;
  const available = SEVERITY_ORDER.filter((key) => (data.counts[key] ?? 0) > 0);

  return (
    <div className="space-y-3">
      {!compact && total > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Filter insights by severity">
          <FilterButton active={severity === "all"} onClick={() => setSeverity("all")}>All · {total}</FilterButton>
          {available.map((key) => (
            <FilterButton key={key} active={severity === key} onClick={() => setSeverity(key)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_META[key].bar)} aria-hidden="true" />
              {SEVERITY_META[key].label} · {data.counts[key]}
            </FilterButton>
          ))}
          <span className="ml-auto text-[10px] text-slate-600">Computed {relativeTime(data.generated_at)} · last {data.window_days} days</span>
        </div>
      ) : null}
      {total === 0 ? (
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-5 text-sm text-emerald-100">
          <p className="font-semibold">Nothing needs you right now.</p>
          <p className="mt-1 text-xs leading-5 text-emerald-100/70">No rule fired for the last {data.window_days} days: complaints are inside their deadlines and no metric moved past its threshold.</p>
        </div>
      ) : (
        <div className={cn("grid gap-3", columns === 2 && "lg:grid-cols-2", columns === 3 && "lg:grid-cols-2 2xl:grid-cols-3")}>
          {insights.map((insight) => <InsightCard key={insight.id} insight={insight} compact={compact} />)}
        </div>
      )}
      {limit && total > insights.length && severity === "all" ? (
        <Link href="/intelligence#insights" className="focus-ring inline-flex items-center gap-1.5 text-xs font-semibold text-[#a895ff] hover:text-[#ded8ff]">
          {total - insights.length} more insight{total - insights.length === 1 ? "" : "s"}
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
        active ? "border-[#8b75ff]/45 bg-[#8b75ff]/15 text-[#ded8ff]" : "border-white/[0.08] text-slate-400 hover:text-slate-100",
      )}
    >
      {children}
    </button>
  );
}
