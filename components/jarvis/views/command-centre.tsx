"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Segmented } from "@/components/intelligence/visuals";
import { seriesValueLabel, useTimeseries } from "@/components/jarvis/domains/domain-panel";
import { useJarvis } from "@/components/jarvis/provider";
import { JarvisNotice } from "@/components/jarvis/readiness";
import {
  CountChip,
  EmptyNote,
  FreshnessTag,
  GlassPanel,
  MetricTile,
  PageHeading,
  RetryButton,
  SectionHeader,
  SignalCard,
} from "@/components/jarvis/ui/primitives";
import { TrendChart } from "@/components/jarvis/ui/trend-chart";
import { AlertRow, STREAM_TAG, useLiveAlerts } from "@/components/jarvis/views/live-feed";
import { Skeleton, ResourceState } from "@/components/ui/primitives";
import { JarvisRequestError } from "@/hooks/use-jarvis";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import type { ZenoBriefingFinding, ZenoBriefingSeverity } from "@/lib/api/jarvis-schemas";
import { formatCount } from "@/lib/intelligence";
import {
  attentionInsights,
  DOMAIN_ORDER,
  DOMAINS,
  domainAttention,
  findMetric,
  HEADLINE_METRICS,
  opportunityInsights,
  trendFor,
  type CommandCentre,
  type DomainDefinition,
  type MetricRow,
} from "@/lib/jarvis/command-centre";
import {
  areaLabel,
  jarvisErrorKind,
  SEVERITY_META,
  WINDOW_OPTIONS,
  windowLabel,
} from "@/lib/jarvis/presentation";
import { cn } from "@/lib/utils";

// The Command Centre: what changed, what needs attention and where to go next.
// Every figure is from the command-centre snapshot or the analytics series. A
// figure the backend did not send is labelled, never filled with zero.

type TrendKey = "gmv_minor" | "listings_created" | "active_users";

const TREND_OPTIONS: ReadonlyArray<{ value: TrendKey; label: string }> = [
  { value: "gmv_minor", label: "Agreed deal value" },
  { value: "listings_created", label: "Listings created" },
  { value: "active_users", label: "Active users" },
];

const SEVERITY_RANK: readonly ZenoBriefingSeverity[] = ["critical", "high", "warning", "positive", "info"];

function rankFindings(findings: readonly ZenoBriefingFinding[]): ZenoBriefingFinding[] {
  const rank = (severity: ZenoBriefingSeverity) => SEVERITY_RANK.indexOf(severity);
  return [...findings].sort((a, b) => rank(a.severity) - rank(b.severity));
}

function severityCounts(findings: readonly ZenoBriefingFinding[]): Array<{ severity: ZenoBriefingSeverity; count: number }> {
  return SEVERITY_RANK.map((severity) => ({ severity, count: findings.filter((item) => item.severity === severity).length })).filter(
    (item) => item.count > 0,
  );
}

function attentionText(count: number | null): string {
  if (count === null) return "Attention not measured";
  if (count === 0) return "Nothing needs attention";
  return count === 1 ? "1 signal needs attention" : `${formatCount(count)} signals need attention`;
}

function WindowSelect({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-400">
      <span className="whitespace-nowrap">Briefing window</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="focus-ring rounded-lg border border-white/12 bg-[#080a14] px-2.5 py-1.5 text-xs font-semibold text-slate-100"
      >
        {WINDOW_OPTIONS.map((days) => (
          <option key={days} value={days}>
            {windowLabel(days)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Hero({ centre }: { centre: CommandCentre | undefined }) {
  return (
    <GlassPanel raised as="div" className="relative overflow-hidden">
      <span aria-hidden="true" className="jv-rule absolute inset-x-0 top-0" />
      <PageHeading
        eyebrow="Jarvis Mode · Business command centre"
        title="Command Centre"
        description="What changed, what needs attention and where to look next. Figures are a snapshot from BROKA's command centre, and every signal names the figures it was drawn from."
        meta={
          centre ? (
            <>
              <FreshnessTag kind="snapshot" label="Snapshot" at={centre.generated_at} />
              <span className="text-[11px] text-slate-500">Window: last {formatCount(centre.window.days)} days</span>
            </>
          ) : null
        }
      />
    </GlassPanel>
  );
}

function HeadlineFigures({
  centre,
  pending,
  error,
  onRetry,
}: {
  centre: CommandCentre | undefined;
  pending: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (!centre && pending) {
    return (
      <div aria-busy="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[9.5rem]" />
        ))}
      </div>
    );
  }
  if (!centre) {
    return (
      <GlassPanel>
        <ResourceState
          state="error"
          message={isEndpointMissing(error) ? "This backend does not serve the command centre yet." : "The command centre could not be loaded."}
          action={<RetryButton onRetry={onRetry} />}
        />
      </GlassPanel>
    );
  }
  return (
    <section aria-label="Headline figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {HEADLINE_METRICS.map((item) => {
        const row: MetricRow = { group: item.group, key: item.key, metric: findMetric(centre, item.group, item.key) };
        return <MetricTile key={`${item.group}.${item.key}`} label={item.label} row={row} />;
      })}
    </section>
  );
}

function TrendPanel() {
  const [key, setKey] = useState<TrendKey>("gmv_minor");
  const series = useTimeseries();
  const option = TREND_OPTIONS.find((item) => item.value === key) ?? TREND_OPTIONS[0];
  const points = trendFor(series.data, key);
  const updated = series.dataUpdatedAt > 0 ? new Date(series.dataUpdatedAt).toISOString() : null;

  let body: ReactNode;
  if (series.isPending) {
    body = <Skeleton className="h-[200px]" />;
  } else if (series.error) {
    body = (
      <EmptyNote>
        {isEndpointMissing(series.error)
          ? "This backend does not serve the analytics time-series yet, so no trend is shown."
          : "The trend could not be loaded. The figures above are unaffected."}
      </EmptyNote>
    );
  } else if (points === null) {
    body = <EmptyNote>Not served by this backend.</EmptyNote>;
  } else {
    body = (
      <TrendChart
        series={[{ key, label: option.label, points, tone: "violet" }]}
        valueLabel={seriesValueLabel(key)}
        emptyText="The backend has not measured this series in the last 30 days."
      />
    );
  }

  return (
    <GlassPanel labelledBy="cc-trend" className="space-y-5">
      <SectionHeader
        id="cc-trend"
        eyebrow="Last 30 days"
        title={option.label}
        description="Daily values from BROKA's analytics. A day that was not measured stays blank rather than drawing as zero."
        meta={
          <>
            <Segmented
              value={key}
              options={TREND_OPTIONS.map(({ value, label }) => ({ value, label }))}
              onChange={setKey}
              label="Trend series"
            />
            {updated ? <FreshnessTag kind="snapshot" label="Last updated" at={updated} /> : null}
          </>
        }
      />
      {body}
    </GlassPanel>
  );
}

function BriefingCard() {
  const jarvis = useJarvis();
  const query = jarvis.briefing;
  const data = query.data;
  const error = query.error instanceof JarvisRequestError ? query.error : null;
  const investigateDisabled = !jarvis.canAsk || jarvis.activity.pendingQuestion !== null;
  const findings = data ? rankFindings(data.priority_findings) : [];
  const counts = data ? severityCounts(data.priority_findings) : [];

  return (
    <GlassPanel raised labelledBy="cc-briefing" className="flex flex-col gap-5">
      <SectionHeader
        id="cc-briefing"
        eyebrow="Zeno briefing"
        title="What changed"
        actions={<WindowSelect value={jarvis.windowDays} onChange={jarvis.setWindowDays} />}
      />

      {query.isPending ? (
        <div aria-busy="true">
          <p className="sr-only" role="status">
            Loading the briefing
          </p>
          <Skeleton className="h-48" />
        </div>
      ) : query.error ? (
        <JarvisNotice
          kind={jarvisErrorKind(error?.code, error?.status ?? 0)}
          onRetry={() => void query.refetch()}
          retryAfterSeconds={error?.retryAfterSeconds ?? null}
        />
      ) : data ? (
        <>
          <p className="font-display text-lg font-semibold leading-7 tracking-[-0.02em] text-white">{data.headline}</p>

          {counts.length > 0 ? (
            <div className="flex flex-wrap gap-2" aria-label="Signals by severity">
              {counts.map(({ severity, count }) => (
                <CountChip key={severity} label={SEVERITY_META[severity].label} count={count} tone={SEVERITY_META[severity].railTone} />
              ))}
            </div>
          ) : null}

          {findings.length === 0 ? (
            <EmptyNote>No priority signals were raised for this window.</EmptyNote>
          ) : (
            <ul className="space-y-3">
              {findings.slice(0, 3).map((finding) => (
                <li key={finding.id} className="space-y-2 rounded-xl border border-white/[0.06] bg-black/15 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                        SEVERITY_META[finding.severity].chip,
                      )}
                    >
                      {SEVERITY_META[finding.severity].label}
                    </span>
                    <span className="text-[11px] text-slate-500">{areaLabel(finding.area)}</span>
                    {!finding.evidence_backed ? <span className="text-[11px] italic text-slate-500">Signal only</span> : null}
                  </div>
                  <p className="text-sm font-semibold leading-5 text-slate-100">{finding.title}</p>
                  <button
                    type="button"
                    disabled={investigateDisabled}
                    onClick={() => void jarvis.ask(`Investigate this signal: ${finding.title}`)}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/30 bg-[#8b75ff]/10 px-2.5 py-1 text-xs! font-semibold text-[#ded8ff] hover:border-[#8b75ff]/55 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Investigate with Zeno
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <FreshnessTag kind="snapshot" label={data.cached ? "Recent briefing" : "Current briefing"} at={data.generated_at} />
            <Link href="/assistant/core" className="focus-ring inline-flex items-center gap-1 rounded-md text-xs font-semibold text-slate-300 hover:text-white">
              Suggested investigations <ArrowUpRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </>
      ) : null}
    </GlassPanel>
  );
}

function SignalsPanel({ centre, pending, error }: { centre: CommandCentre | undefined; pending: boolean; error: unknown }) {
  const jarvis = useJarvis();
  const investigateDisabled = !jarvis.canAsk || jarvis.activity.pendingQuestion !== null;
  const onInvestigate = jarvis.canAsk ? (question: string) => void jarvis.ask(question) : undefined;
  const attention = attentionInsights(centre);
  const working = opportunityInsights(centre);

  if (!centre) {
    return pending ? (
      <div aria-busy="true" className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    ) : (
      <EmptyNote>{error ? "The signals could not be loaded." : "No signals are available yet."}</EmptyNote>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <GlassPanel labelledBy="cc-attention" className="space-y-4">
        <SectionHeader
          id="cc-attention"
          eyebrow="Needs attention"
          title="Signals to act on"
          description="Raised by BROKA's rules from the snapshot's figures. Each one names the figures it was drawn from."
          meta={<CountChip label="need attention" count={attention.length} tone={attention.length > 0 ? "danger" : "neutral"} />}
        />
        {attention.length === 0 ? (
          <EmptyNote>No critical or warning signal is raised in the current snapshot.</EmptyNote>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {attention.slice(0, 4).map((insight) => (
              <SignalCard key={insight.id} insight={insight} onInvestigate={onInvestigate} investigateDisabled={investigateDisabled} />
            ))}
          </div>
        )}
      </GlassPanel>

      <GlassPanel labelledBy="cc-working" className="space-y-4">
        <SectionHeader
          id="cc-working"
          eyebrow="Opportunities"
          title="What is working or can grow"
          description="Positive results and openings BROKA's rules found in the snapshot."
          meta={<CountChip label="in view" count={working.length} tone="info" />}
        />
        {working.length === 0 ? (
          <EmptyNote>No opportunity or positive result is raised in the current snapshot.</EmptyNote>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {working.slice(0, 4).map((insight) => (
              <SignalCard key={insight.id} insight={insight} onInvestigate={onInvestigate} investigateDisabled={investigateDisabled} />
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

function DomainCard({ domain, count }: { domain: DomainDefinition; count: number | null }) {
  return (
    <Link
      href={domain.href}
      className="jv-glass focus-ring group flex min-h-[9rem] flex-col gap-3 p-5 transition hover:border-[#8b75ff]/35"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-display text-base font-semibold text-white">{domain.title}</span>
        <ArrowUpRight size={15} aria-hidden="true" className="shrink-0 text-slate-500 transition group-hover:text-[#ded8ff]" />
      </div>
      <p className="text-sm leading-6 text-slate-400">{domain.summary}</p>
      <p className="mt-auto text-xs font-semibold text-slate-500">{attentionText(count)}</p>
    </Link>
  );
}

function DomainGrid({ centre, operationsAnomalies }: { centre: CommandCentre | undefined; operationsAnomalies: number | null }) {
  return (
    <section aria-labelledby="cc-domains" className="space-y-4">
      <SectionHeader
        id="cc-domains"
        eyebrow="Domains"
        title="Explore by domain"
        description="Each domain has its own page with its figures, trend, signals and suggested investigations."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DOMAIN_ORDER.map((key) => {
          const domain = DOMAINS[key];
          const count = key === "operations" ? operationsAnomalies : domainAttention(centre, domain);
          return <DomainCard key={key} domain={domain} count={count} />;
        })}
      </div>
    </section>
  );
}

function LiveStrip() {
  const { alerts, streamStatus, liveIds } = useLiveAlerts(4);
  const stream = STREAM_TAG[streamStatus];
  const items = alerts.data?.items.slice(0, 4) ?? [];
  return (
    <GlassPanel labelledBy="cc-live" className="space-y-4">
      <SectionHeader
        id="cc-live"
        eyebrow="Live intelligence"
        title="Latest alerts"
        description="The four newest backend alerts. Live marks one that arrived while this page was open."
        meta={<FreshnessTag kind={stream.kind} label={stream.label} />}
        actions={
          <Link href="/assistant/live" className="focus-ring inline-flex items-center gap-1 rounded-md text-xs font-semibold text-slate-300 hover:text-white">
            Open the live feed <ArrowUpRight size={12} aria-hidden="true" />
          </Link>
        }
      />
      {alerts.isPending ? (
        <Skeleton className="h-28" />
      ) : alerts.error ? (
        <EmptyNote>The alerts could not be loaded.</EmptyNote>
      ) : items.length === 0 ? (
        <EmptyNote>The backend has no alerts recorded.</EmptyNote>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4" aria-label="Latest alerts">
          {items.map((alert) => (
            <AlertRow key={alert.id} alert={alert} live={liveIds.has(alert.id)} />
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}

/** The Command Centre page: headline figures, trend, briefing, signals, domains and live alerts. */
export function CommandCentreView() {
  const centre = useAdminResource("commandCenter");
  const anomalies = useAdminResource("operationsAnomalies");
  const operationsAnomalies = anomalies.data ? anomalies.data.anomalies.length : null;

  return (
    <div className="space-y-6">
      <Hero centre={centre.data} />
      <HeadlineFigures
        centre={centre.data}
        pending={centre.isPending}
        error={centre.error}
        onRetry={() => void centre.refetch()}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <TrendPanel />
        <BriefingCard />
      </div>
      <SignalsPanel centre={centre.data} pending={centre.isPending} error={centre.error} />
      <DomainGrid centre={centre.data} operationsAnomalies={operationsAnomalies} />
      <LiveStrip />
    </div>
  );
}
