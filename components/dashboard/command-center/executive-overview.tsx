"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from "lucide-react";

import { DataFreshness, SectionHeading } from "@/components/intelligence/visuals";
import { InfoTip } from "@/components/ui/tooltip";
import { ResourceState, Skeleton, StatusBadge, UnavailablePanel } from "@/components/ui/primitives";
import { isEndpointMissing } from "@/hooks/use-admin-resource";
import type { CommandCenter, CommandMetric } from "@/lib/api/schemas";
import { attentionCounts, formatMetricValue, metricTrend, type Trend } from "@/lib/command-center";
import { formatShortDate } from "@/lib/format";
import { isInternalHref } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<Trend["tone"], string> = {
  good: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200",
  bad: "border-rose-300/25 bg-rose-400/10 text-rose-200",
  neutral: "border-white/[0.08] bg-white/[0.03] text-slate-400",
};

function TrendChip({ metric, days }: { metric: CommandMetric; days: number }) {
  const trend = metricTrend(metric);
  const Icon = trend.direction === "up" ? ArrowUpRight : trend.direction === "down" ? ArrowDownRight : Minus;
  const previous = metric.previous !== null ? formatMetricValue(metric.unit, metric.previous) : null;
  const title = previous !== null ? `Previous ${days} days: ${previous}` : trend.text;
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums", TONE_CLASSES[trend.tone])}
      title={title}
      data-tone={trend.tone}
    >
      {trend.direction !== "none" ? <Icon size={11} aria-hidden="true" /> : null}
      <span>{trend.text}</span>
      {previous !== null ? <span className="sr-only">{`, previously ${previous}`}</span> : null}
    </span>
  );
}

function kindLabel(kind: string, days: number): string {
  if (kind === "point_in_time") return "now";
  if (kind === "live") return "live";
  return `last ${days} d vs ${days} d before`;
}

function MetricRow({ metric, days }: { metric: CommandMetric; days: number }) {
  const label = metric.href && isInternalHref(metric.href)
    ? <Link href={metric.href} className="focus-ring truncate text-xs font-semibold text-slate-300 transition hover:text-white">{metric.label}</Link>
    : <span className="truncate text-xs font-semibold text-slate-300">{metric.label}</span>;
  return (
    <li data-testid={`metric-${metric.key}`} className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          {label}
          <InfoTip label={`What ${metric.label} counts`}>{metric.definition}</InfoTip>
        </div>
        <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
          {metric.available ? (metric.caption ?? kindLabel(metric.kind, days)) : metric.unavailable_reason}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <p className={cn("font-display text-[15px] font-bold leading-none tabular-nums", metric.available ? "text-white" : "text-slate-600")}>
          {metric.available ? formatMetricValue(metric.unit, metric.value) : "Unavailable"}
        </p>
        <TrendChip metric={metric} days={days} />
      </div>
    </li>
  );
}

export function ExecutiveOverview({ data, isLoading, error, onRetry }: {
  data?: CommandCenter;
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
}) {
  if (isLoading) {
    return (
      <section aria-label="Executive overview" aria-busy="true" className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {[0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-72" />)}
      </section>
    );
  }
  if (!data) {
    if (isEndpointMissing(error)) {
      return (
        <UnavailablePanel
          title="The Command Center figures need the upgraded BROKA API"
          detail="GET /admin/command-center is not served by the connected backend yet. The sections below still read their own endpoints."
        />
      );
    }
    return (
      <ResourceState
        state="error"
        message={error instanceof Error ? error.message : "The Command Center figures could not be loaded."}
        action={onRetry ? (
          <button type="button" onClick={onRetry} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">
            <RefreshCw size={12} aria-hidden="true" />Retry
          </button>
        ) : undefined}
      />
    );
  }

  const days = data.window.days;
  const attention = attentionCounts(data.decisions);
  return (
    <section aria-labelledby="executive-overview-title" className="space-y-4">
      <SectionHeading
        id="executive-overview-title"
        eyebrow="01 · Executive overview"
        title="Where BROKA stands"
        description={`Last ${days} days (${formatShortDate(data.window.from)} to ${formatShortDate(data.window.to)}, UTC) against the ${days} days before. Administrator accounts are excluded from the counts of accounts, listings and activity.`}
        meta={<DataFreshness
          label="Server-computed figures"
          generatedAt={data.generated_at}
          windowLabel={`${days}-day periods`}
          source="GET /admin/command-center. Each figure's definition is behind its info button; unavailable figures say why."
        />}
        actions={
          <a href="#decisions" className="focus-ring inline-flex items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white" data-testid="attention-link">
            {attention.total ? (
              <>
                {attention.critical ? <StatusBadge tone="danger">{attention.critical} critical</StatusBadge> : null}
                {attention.warning ? <StatusBadge tone="warning">{attention.warning} {attention.warning === 1 ? "warning" : "warnings"}</StatusBadge> : null}
                <span>Decisions</span>
              </>
            ) : <span>No critical or warning decisions</span>}
          </a>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {data.groups.map((group) => (
          <section key={group.key} aria-labelledby={`group-${group.key}`} className="holo-panel p-4 sm:p-5" data-testid={`group-${group.key}`}>
            <h3 id={`group-${group.key}`} className="font-display text-sm font-bold tracking-[-0.02em] text-white">{group.title}</h3>
            <ul className="mt-2 divide-y divide-white/[0.055]">
              {group.metrics.map((metric) => <MetricRow key={metric.key} metric={metric} days={days} />)}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
