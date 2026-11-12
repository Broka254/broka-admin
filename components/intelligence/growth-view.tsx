"use client";

import { ArrowRight, CalendarDays, RefreshCw, Timer, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";

import { DataFreshness, PageHeader, Panel, Segmented, StatTile } from "@/components/intelligence/visuals";
import { InfoTip } from "@/components/ui/tooltip";
import { ResourceState } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import type { CohortsResponse, FunnelStep } from "@/lib/api/intelligence-schemas";
import { formatShortDate } from "@/lib/format";
import { formatCount, formatDuration, formatPctValue } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
] as const;
type Range = (typeof RANGES)[number]["value"];

/** Day-aligned (UTC) so the query key, and the cache, holds for the day. */
export function rangeStart(days: number, now: Date = new Date()): string {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - days * 86_400_000);
  return start.toISOString().slice(0, 10);
}

/** The step that loses the largest share of the people who reached the one before. */
export function biggestDrop(steps: FunnelStep[]): { from: FunnelStep; to: FunnelStep; lostPct: number } | null {
  let worst: { from: FunnelStep; to: FunnelStep; lostPct: number } | null = null;
  for (let index = 1; index < steps.length; index += 1) {
    const previous = steps[index - 1];
    const step = steps[index];
    if (!previous.count || step.pct_of_previous === null) continue;
    const lost = 100 - step.pct_of_previous;
    if (!worst || lost > worst.lostPct) worst = { from: previous, to: step, lostPct: lost };
  }
  return worst;
}

function Funnel({ steps, accent }: { steps: FunnelStep[]; accent: "violet" | "cyan" }) {
  const drop = biggestDrop(steps);
  const bar = accent === "violet" ? "from-[#8b75ff] to-[#b9a8ff]" : "from-[#54d7e9] to-[#9ef0fb]";
  return (
    <div>
      <ol className="space-y-2" aria-label={`${accent === "violet" ? "Seller" : "Buyer"} conversion stages`}>
        {steps.map((step, index) => {
          const width = Math.max(step.count ? 3 : 0, step.pct_of_start ?? 0);
          const isDrop = drop?.to.key === step.key;
          const conversion = step.pct_of_previous;
          const lost = conversion === null ? null : 100 - conversion;
          return (
            <li key={step.key}>
              <div className={cn("rounded-xl border p-2.5 transition", isDrop ? "border-rose-400/25 bg-rose-400/[0.04]" : "border-transparent")}>
                <div className="flex items-center gap-3">
                  <div className="relative h-10 flex-1 overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.025]">
                    <div className={cn("absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r opacity-80", bar)} style={{ width: `${Math.min(100, width)}%` }} />
                    <div className="relative flex h-full items-center justify-between gap-2 px-3 text-xs">
                      <span className="truncate font-semibold text-white drop-shadow">{step.label}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-white drop-shadow">{formatCount(step.count)}</span>
                    </div>
                  </div>
                  <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{formatPctValue(step.pct_of_start)}</span>
                </div>
                {index > 0 ? (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 pl-1 text-[10px]">
                    <span className={cn("inline-flex items-center gap-1 tabular-nums", isDrop ? "font-semibold text-rose-300" : "text-slate-500")}>
                      <ArrowRight size={9} aria-hidden="true" />{formatPctValue(conversion)} continue · {formatPctValue(lost)} lost
                      {isDrop ? <span className="ml-1 rounded-full border border-rose-400/30 bg-rose-400/10 px-1.5 py-0.5 font-semibold uppercase tracking-[0.08em]">Biggest drop</span> : null}
                    </span>
                    <span className="text-slate-600">{formatCount(step.count)} of {formatCount(steps[index - 1].count)}</span>
                  </div>
                ) : <p className="mt-1 pl-1 text-[10px] text-slate-600">Cohort start · 100%</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {drop && drop.lostPct > 0 ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/15 bg-rose-400/[0.05] p-3 text-xs leading-5 text-rose-100">
          <TrendingDown size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {formatPctValue(drop.lostPct)} of people who {drop.from.label.toLowerCase()} did not go on to {drop.to.label.toLowerCase()}. Fixing this step moves the whole funnel.
        </p>
      ) : null}
    </div>
  );
}

function heat(pct: number | null): string {
  if (pct === null) return "transparent";
  const alpha = 0.08 + Math.min(1, pct / 60) * 0.78;
  return `rgba(139, 117, 255, ${alpha.toFixed(2)})`;
}

function averageColumn(cohorts: CohortsResponse["cohorts"], index: number): number | null {
  const values = cohorts.map((cohort) => cohort.retention_pct[index]).filter((value): value is number => value !== null && value !== undefined);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function CohortHeatmap({ data }: { data: CohortsResponse }) {
  const columns = Math.max(0, ...data.cohorts.map((cohort) => cohort.retention_pct.length));
  const averages = useMemo(() => Array.from({ length: columns }, (_, index) => averageColumn(data.cohorts, index)), [data.cohorts, columns]);
  const deterioration = useMemo(() => {
    let worst: { from: number; to: number; drop: number } | null = null;
    for (let index = 1; index < averages.length; index += 1) {
      const from = averages[index - 1];
      const to = averages[index];
      if (from === null || to === null) continue;
      const drop = from - to;
      if (drop > 0 && (!worst || drop > worst.drop)) worst = { from: index - 1, to: index, drop };
    }
    return worst;
  }, [averages]);
  if (!data.cohorts.length || columns === 0) return <p className="text-sm text-slate-500">No signups in these weeks yet.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><InfoTip label="How retention is calculated">{data.definitions.activity ?? "A user is retained in a week when they record activity in that week."} {data.definitions.week ?? ""}</InfoTip>Darker means a larger share of the signup week was active.</span>
        <span className="inline-flex items-center gap-1.5"><CalendarDays size={11} aria-hidden="true" />Signup weeks are UTC-aligned · {data.weeks} weeks shown</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
          <caption className="sr-only">Weekly retention by signup cohort. Each cell shows the percentage of that signup week active in the week after signup.</caption>
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <th scope="col" className="px-2 py-1 text-left">Signup week</th>
              <th scope="col" className="px-2 py-1 text-right">Users</th>
              {Array.from({ length: columns }, (_, index) => <th key={index} scope="col" className="px-2 py-1 text-center" title={index === 0 ? data.definitions.week_0 : undefined}>{index === 0 ? "Wk 0" : `+${index}`}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.cohorts.map((cohort) => (
              <tr key={cohort.week_start}>
                <th scope="row" className="whitespace-nowrap px-2 py-1 text-left font-semibold text-slate-200">{formatShortDate(cohort.week_start)}</th>
                <td className="px-2 py-1 text-right tabular-nums text-slate-400">{formatCount(cohort.size)}</td>
                {Array.from({ length: columns }, (_, index) => {
                  const value = index < cohort.retention_pct.length ? cohort.retention_pct[index] : undefined;
                  if (value === undefined) return <td key={index} className="h-9 min-w-12 rounded-md border border-dashed border-white/[0.05]" aria-label="Not yet observed" />;
                  return (
                    <td key={index} className="p-0">
                      <button
                        type="button"
                        aria-label={cohort.size ? `${formatPctValue(value)} of the ${formatCount(cohort.size)} users who signed up in the week of ${formatShortDate(cohort.week_start)} were active in week ${index}` : `No signups in the week of ${formatShortDate(cohort.week_start)}`}
                        className="focus-ring grid h-9 min-w-12 w-full place-items-center rounded-md text-center font-semibold tabular-nums text-white transition hover:ring-1 hover:ring-white/30"
                        style={{ background: heat(cohort.size ? value : null), border: cohort.size ? "1px solid rgba(195,202,226,0.07)" : "1px dashed rgba(195,202,226,0.12)" }}
                        title={cohort.size ? `${formatPctValue(value)} of ${cohort.size} active` : "No signups"}
                      >
                        {cohort.size ? formatPctValue(value, 0) : "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row" className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Average</th>
              <td className="px-2 py-1" />
              {averages.map((average, index) => <td key={index} className="px-2 py-1 text-center text-[10px] tabular-nums text-slate-400">{formatPctValue(average, 0)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {deterioration ? (
        <p className="rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-3 text-[11px] leading-5 text-amber-100/90">
          Retention deteriorates most between week {deterioration.from} and week {deterioration.to}: the average falls by {formatPctValue(deterioration.drop)} points. Weeks with no observed users are excluded from the average.
        </p>
      ) : null}
      {data.truncated ? <p className="text-[11px] text-amber-200">Activity reads hit the row cap; later weeks may be understated.</p> : null}
    </div>
  );
}

export function GrowthView() {
  const [range, setRange] = useState<Range>("90");
  const [weeks, setWeeks] = useState<"8" | "12">("8");
  const funnelQuery = useMemo(() => new URLSearchParams({ from: rangeStart(Number(range)) }), [range]);
  const cohortQuery = useMemo(() => new URLSearchParams({ weeks }), [weeks]);
  const funnel = useAdminResource("intelligenceFunnel", funnelQuery);
  const cohorts = useAdminResource("intelligenceCohorts", cohortQuery);

  const failure = (error: unknown, retry: () => void, what: string) => isEndpointMissing(error)
    ? <ResourceState state="unavailable" message={`${what} needs the upgraded BROKA API. It appears automatically after the backend deploy.`} />
    : <ResourceState state="error" message={error instanceof Error ? error.message : `${what} could not be loaded.`} action={<button type="button" onClick={retry} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200"><RefreshCw size={12} aria-hidden="true" />Retry</button>} />;

  const sellerDrop = funnel.data ? biggestDrop(funnel.data.seller_journey) : null;
  const buyerDrop = funnel.data ? biggestDrop(funnel.data.buyer_journey) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Growth engine"
        title="Who arrives, who acts, who comes back"
        description="People who signed up in the range, followed through both sides of the marketplace to today, and weekly cohorts by how many stay active."
        meta={<DataFreshness
          state={funnel.isLoading ? "loading" : funnel.isError ? "error" : funnel.data ? "ready" : "unavailable"}
          generatedAt={funnel.data?.generated_at}
          windowLabel="signups since the range start"
          source="GET /admin/intelligence/funnel for journeys and timing; GET /admin/intelligence/cohorts for weekly retention."
        />}
        actions={<Segmented label="Signup range" value={range} options={[...RANGES]} onChange={setRange} />}
      />

      {funnel.data ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Funnel summary">
          <StatTile label="Signed up" value={formatCount(funnel.data.cohort.users)} caption={`since ${formatShortDate(funnel.data.cohort.from)}`} />
          <StatTile label="Posted a listing" value={formatPctValue(funnel.data.seller_journey.find((step) => step.key === "posted_listing")?.pct_of_start)} caption="of signups" accent="text-[#a895ff]" />
          <StatTile label="To first listing" value={formatDuration(funnel.data.timing.median_hours_to_first_listing)} caption="median after signup" icon={<Timer size={14} />} />
          <StatTile label="To first buyer message" value={formatDuration(funnel.data.timing.median_hours_to_first_buyer_message)} caption="median after signup" icon={<Timer size={14} />} accent="text-cyan-200" />
        </section>
      ) : null}

      {funnel.data && (sellerDrop || buyerDrop) ? (
        <section className="grid gap-3 lg:grid-cols-2" aria-label="Biggest conversion drop-offs">
          {[sellerDrop ? { label: "Seller journey", drop: sellerDrop, href: "/intelligence#categories" } : null, buyerDrop ? { label: "Buyer journey", drop: buyerDrop, href: "/intelligence#sellers" } : null].filter(Boolean).map((entry) => entry ? (
            <div key={entry.label} className="flex items-start gap-3 rounded-xl border border-rose-400/18 bg-rose-400/[0.045] p-4">
              <TrendingDown size={16} className="mt-0.5 shrink-0 text-rose-300" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-200">{entry.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{formatPctValue(entry.drop.lostPct)} lost between {entry.drop.from.label.toLowerCase()} and {entry.drop.to.label.toLowerCase()}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">The single largest drop in this funnel. Concentrate experimentation here before optimising later stages.</p>
              </div>
            </div>
          ) : null)}
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Supply side" title="Seller journey" description={funnel.data?.definitions.became_seller}>
          {funnel.isLoading ? <ResourceState state="loading" message="Following sellers…" /> : funnel.isError ? failure(funnel.error, () => void funnel.refetch(), "The growth funnel") : funnel.data ? <Funnel steps={funnel.data.seller_journey} accent="violet" /> : null}
        </Panel>
        <Panel eyebrow="Demand side" title="Buyer journey" description={funnel.data?.definitions.engaged}>
          {funnel.isLoading ? <ResourceState state="loading" message="Following buyers…" /> : funnel.isError ? failure(funnel.error, () => void funnel.refetch(), "The growth funnel") : funnel.data ? <Funnel steps={funnel.data.buyer_journey} accent="cyan" /> : null}
        </Panel>
      </div>

      <Panel
        eyebrow="Retention"
        title="Weekly cohorts"
        description={cohorts.data ? `${cohorts.data.definitions.activity ?? ""} ${cohorts.data.definitions.week ?? ""}`.trim() : "Share of each signup week active in each week after."}
        actions={<Segmented label="Cohort weeks" value={weeks} options={[{ value: "8", label: "8 weeks" }, { value: "12", label: "12 weeks" }]} onChange={setWeeks} />}
      >
        {cohorts.isLoading ? <ResourceState state="loading" message="Building cohorts…" /> : cohorts.isError ? failure(cohorts.error, () => void cohorts.refetch(), "Cohort retention") : cohorts.data ? <CohortHeatmap data={cohorts.data} /> : null}
      </Panel>
    </div>
  );
}
