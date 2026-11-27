"use client";

import { useMemo, type ReactNode } from "react";

import { COMMAND_INPUT_ID } from "@/components/jarvis/core/command-bar";
import { useJarvis } from "@/components/jarvis/provider";
import { EmptyNote, GlassPanel, MetricTile, RetryButton, SignalCard, SectionHeader } from "@/components/jarvis/ui/primitives";
import { TrendChart, type TrendSeries } from "@/components/jarvis/ui/trend-chart";
import { ProgressBar } from "@/components/intelligence/visuals";
import { Skeleton, ResourceState } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import { buildRevenueQuery } from "@/lib/api/revenue";
import { formatKES } from "@/lib/format";
import { formatCount, humanizeKey } from "@/lib/intelligence";
import {
  type CommandCentre,
  type DomainDefinition,
  formatTargetValue,
  insightsFor,
  lastDaysRange,
  metricRows,
  trendFor,
} from "@/lib/jarvis/command-centre";

/** The last 30 UTC days of the analytics time-series. Shared by every panel, so it is requested once. */
export function useTimeseries(days = 30) {
  const query = useMemo(() => {
    const range = lastDaysRange(days, new Date());
    return buildRevenueQuery({ from: range.from, to: range.to, bucket: "day" });
  }, [days]);
  return useAdminResource("timeseries", query);
}

/** Money series are shown in shillings; every other series is a count. */
export function seriesValueLabel(key: string): (value: number) => string {
  return key === "gmv_minor" ? (value) => formatKES(value) : (value) => formatCount(value);
}

export type PanelState = { pending: boolean; error: unknown; onRetry: () => void };

function DomainTrend({ domain }: { domain: DomainDefinition }) {
  const series = useTimeseries();
  if (domain.series.length === 0) return null;
  if (series.isPending) return <Skeleton className="h-[200px]" />;
  if (series.error) {
    return (
      <EmptyNote>
        {isEndpointMissing(series.error)
          ? "This backend does not serve the analytics time-series yet, so no trend is shown."
          : "The trend could not be loaded. The figures above are unaffected."}
      </EmptyNote>
    );
  }
  const trends: TrendSeries[] = domain.series.map((item, index) => ({
    key: item.key,
    label: item.label,
    points: trendFor(series.data, item.key) ?? [],
    tone: index === 0 ? "violet" : "cyan",
  }));
  return (
    <TrendChart
      series={trends}
      valueLabel={seriesValueLabel(domain.series[0].key)}
      emptyText="The backend has not measured this series in the last 30 days."
    />
  );
}

/**
 * One domain on a Jarvis page: its figures, its trend where the backend has
 * one, the signals Zeno's rules raised for it, and questions to investigate.
 * `extra` carries anything specific to the domain, such as operations anomalies.
 */
export function DomainPanel({
  domain,
  centre,
  state,
  extra,
}: {
  domain: DomainDefinition;
  centre: CommandCentre | undefined;
  state: PanelState;
  extra?: ReactNode;
}) {
  const jarvis = useJarvis();
  const rows = useMemo(() => metricRows(centre, domain), [centre, domain]);
  const signals = useMemo(() => insightsFor(centre, domain.insightAreas).slice(0, 3), [centre, domain.insightAreas]);
  const headingId = `domain-${domain.key}`;
  const investigateDisabled = !jarvis.canAsk || jarvis.activity.pendingQuestion !== null;

  return (
    <GlassPanel labelledBy={headingId} className="space-y-6">
      <SectionHeader id={headingId} eyebrow={domain.title} title={domain.title} description={domain.summary} />

      {state.pending && !centre ? (
        <div aria-busy="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-[9.5rem]" />
          ))}
        </div>
      ) : state.error && !centre ? (
        <ResourceState state="error" message="The figures for this domain could not be loaded." action={<RetryButton onRetry={state.onRetry} />} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <MetricTile key={`${row.group}.${row.key}`} label={row.metric?.label ?? humanizeKey(row.key)} row={row} />
            ))}
          </div>

          <DomainTrend domain={domain} />

          {signals.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Zeno&apos;s signals for {domain.title}</p>
              <div className="grid gap-3 lg:grid-cols-3">
                {signals.map((insight) => (
                  <SignalCard
                    key={insight.id}
                    insight={insight}
                    onInvestigate={jarvis.canAsk ? (question) => void jarvis.ask(question) : undefined}
                    investigateDisabled={investigateDisabled}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {extra}

          <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
            <span className="w-full text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Suggested investigations</span>
            {domain.questions.map((question) => (
              <button
                key={question}
                type="button"
                disabled={!jarvis.canAsk}
                onClick={() => {
                  jarvis.setDraft(question);
                  document.getElementById(COMMAND_INPUT_ID)?.focus();
                }}
                className="focus-ring rounded-full border border-white/10 px-3 py-1.5 text-left text-xs! text-slate-300 hover:border-[#8b75ff]/35 hover:text-white disabled:opacity-45"
              >
                {question}
              </button>
            ))}
          </div>
        </>
      )}
    </GlassPanel>
  );
}

/** Operations: the anomaly judgements the backend made for the last complete day. */
export function OperationsAnomalies() {
  const anomalies = useAdminResource("operationsAnomalies");
  if (anomalies.isPending) return <Skeleton className="h-32" />;
  if (anomalies.error) {
    return (
      <EmptyNote>
        {isEndpointMissing(anomalies.error)
          ? "This backend does not serve the anomaly judgements yet."
          : "The anomaly judgements could not be loaded."}
      </EmptyNote>
    );
  }
  const data = anomalies.data;
  if (!data) return null;
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        Judged against their own history, for {data.evaluated_day}
      </p>
      {data.anomalies.length === 0 ? (
        <EmptyNote>No operational figure was flagged against its own history on that day.</EmptyNote>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.anomalies.map((item) => (
            <li key={`${item.key}-${item.date}`} className="jv-glass space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100">
                  {item.severity === "high" ? "High" : "Medium"}
                </span>
                <span className="text-sm font-semibold text-slate-100">{item.label}</span>
              </div>
              <p className="text-sm leading-6 text-slate-300">{item.what_happened}</p>
              <p className="text-xs leading-5 text-slate-400">{item.impact}</p>
              <p className="text-xs leading-5 text-[#ded8ff]">Suggested: {item.suggested_action}</p>
              <dl className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-500">
                <div>
                  <dt className="inline">Observed </dt>
                  <dd className="inline font-semibold tabular-nums text-slate-200">{item.observed === null ? "—" : formatCount(item.observed)}</dd>
                </div>
                <div>
                  <dt className="inline">Baseline median </dt>
                  <dd className="inline font-semibold tabular-nums text-slate-200">
                    {item.baseline_median === null ? "—" : formatCount(item.baseline_median)}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Source </dt>
                  <dd className="inline text-slate-300">{item.source}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
      {data.not_covered.length > 0 ? (
        <details className="text-xs text-slate-500">
          <summary className="focus-ring cursor-pointer rounded-md font-semibold text-slate-400">
            Figures not judged ({data.not_covered.length})
          </summary>
          <ul className="mt-2 space-y-1 pl-4">
            {data.not_covered.map((item) => (
              <li key={item.figure}>
                {humanizeKey(item.figure)}: {item.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** Growth: the founder's targets, each with its measured progress or an honest absence of one. */
export function TargetsList({ centre }: { centre: CommandCentre | undefined }) {
  const targets = centre?.pulse.targets ?? [];
  if (!centre) return null;
  if (targets.length === 0) return <EmptyNote>No targets are set for this window.</EmptyNote>;
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Targets for this window</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {targets.map((target) => (
          <li key={target.key} className="jv-glass space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-100">{target.label}</span>
              <span className={target.met ? "text-xs font-semibold text-emerald-200" : "text-xs font-semibold text-amber-100"}>
                {target.met ? "Met" : "Not met"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Actual <span className="font-semibold tabular-nums text-slate-200">{formatTargetValue(target.actual, target.unit)}</span> against a target of{" "}
              <span className="font-semibold tabular-nums text-slate-200">{formatTargetValue(target.target, target.unit)}</span>
            </p>
            {target.progress_pct === null ? (
              <p className="text-[11px] text-slate-500">No progress figure is available for this target.</p>
            ) : (
              <ProgressBar value={target.progress_pct} max={100} label={`${target.label} progress`} tone={target.met ? "success" : "warning"} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Trust and safety: the complaints queue as the feedback service counts it. Missing counts stay missing. */
export function ComplaintsQueue() {
  const stats = useAdminResource("feedbackStats");
  if (stats.isPending) return <Skeleton className="h-20" />;
  if (stats.error) return <EmptyNote>The complaints queue could not be loaded.</EmptyNote>;
  const data = stats.data;
  if (!data) return null;
  const urgent = data.open_by_severity?.urgent;
  const items: Array<{ label: string; value: number | null }> = [
    { label: "Open complaints", value: data.open_complaints ?? null },
    { label: "Urgent and open", value: typeof urgent === "number" ? urgent : null },
    { label: "All feedback", value: data.total ?? null },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="jv-glass p-4">
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</dt>
          <dd className="mt-2 font-display text-2xl font-bold tabular-nums text-white">{item.value === null ? "—" : formatCount(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
