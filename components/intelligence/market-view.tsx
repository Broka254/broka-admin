"use client";

import { RefreshCw, ScanSearch } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Chip, DataFreshness, DetailDrawer, PageHeader, Panel, Segmented, StatTile } from "@/components/intelligence/visuals";
import { ResourceState } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import { useAnomalyScan, useMarketListing } from "@/hooks/use-market";
import type { MarketAnomaly, MarketListingRow } from "@/lib/api/market-schemas";
import { formatCount, formatPctValue, signalMeta } from "@/lib/intelligence";

const WINDOWS = [
  { value: "1", label: "24 hours" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;
type WindowValue = (typeof WINDOWS)[number]["value"];

const RANKINGS = [
  { value: "viewed", label: "Most viewed" },
  { value: "saved", label: "Most saved" },
  { value: "contacted", label: "Most contacted" },
  { value: "trending", label: "Trending" },
] as const;
type RankingKey = (typeof RANKINGS)[number]["value"];

type DemandRow = { label: string; demand?: number; supply_live: number; buyer_threads?: number; signal?: string };

function Unavailable({ error, retry, what }: { error: unknown; retry: () => void; what: string }) {
  return isEndpointMissing(error)
    ? <ResourceState state="unavailable" message={`${what} needs the upgraded BROKA API.`} />
    : <ResourceState state="error" message={error instanceof Error ? error.message : `${what} could not be loaded.`} action={<button type="button" onClick={retry} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200"><RefreshCw size={12} aria-hidden="true" />Retry</button>} />;
}

function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function ListingTable({ rows, onOpen, trending = false }: { rows: MarketListingRow[]; onOpen: (id: string) => void; trending?: boolean }) {
  if (!rows.length) return <p className="text-sm text-slate-500">Nothing to rank in this window.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-xs">
        <caption className="sr-only">Listings ranked by distinct users</caption>
        <thead><tr><Th>Listing</Th><Th right>Viewers</Th><Th right>Savers</Th><Th right>Likers</Th><Th right>Contacted</Th><Th right>View → contact</Th>{trending ? <Th right>Score (prev)</Th> : null}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.listing_id} className="border-t border-white/[0.06]">
              <td className="px-2 py-2"><button type="button" onClick={() => onOpen(row.listing_id)} className="focus-ring text-left font-semibold text-slate-100 hover:text-[#ded8ff]">{row.name}</button><p className="text-[10px] text-slate-500">{row.category ?? "Uncategorised"}{row.county ? ` · ${row.county}` : ""}</p></td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.viewers)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.savers)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.likers)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.contacters)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatPctValue(row.view_to_contact_pct)}</td>
              {trending ? <td className="px-2 py-2 text-right tabular-nums">{row.score} ({row.previous_score})</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConversionList({ title, rows, onOpen }: { title: string; rows: MarketListingRow[]; onOpen: (id: string) => void }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      {rows.length ? (
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li key={row.listing_id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <button type="button" onClick={() => onOpen(row.listing_id)} className="focus-ring text-sm font-semibold text-slate-100 hover:text-[#ded8ff]">{row.name}</button>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">{row.note}</p>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-slate-500">None found.</p>}
    </div>
  );
}

function ListingDrawer({ listingId, days, onClose }: { listingId: string | null; days: number; onClose: () => void }) {
  const detail = useMarketListing(listingId, Math.max(days, 7));
  const data = detail.data;
  return (
    <DetailDrawer open={listingId !== null} onClose={onClose} title={data?.listing.name ?? "Listing analytics"} subtitle={data ? `${data.listing.category ?? "Uncategorised"} · ${data.listing.county ?? "Unknown county"} · ${data.window.days}-day window` : undefined}>
      {detail.isLoading ? <ResourceState state="loading" message="Loading listing analytics…" /> : detail.isError ? <Unavailable error={detail.error} retry={() => void detail.refetch()} what="Listing analytics" /> : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Viewers" value={formatCount(data.funnel.viewers)} />
            <StatTile label="Saved or liked" value={formatCount(data.funnel.savers_or_likers)} />
            <StatTile label="Contacted" value={formatCount(data.funnel.contacters)} caption={`${formatPctValue(data.totals.view_to_contact_pct)} of viewers`} />
            <StatTile label="Deals agreed" value={formatCount(data.funnel.deals_agreed)} />
          </div>
          <p className="text-xs leading-5 text-slate-400">Ranks #{data.category_position.viewers_rank} by viewers among {formatCount(data.category_position.listings_compared)} engaged listings in its category. Category median contact rate: {formatPctValue(data.category_position.median_contact_rate_pct)}.</p>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Distinct users per day</p>
            <div className="mt-2 max-h-56 overflow-y-auto">
              <table className="w-full text-[11px]"><thead><tr><Th>Day</Th><Th right>Views</Th><Th right>Saves</Th><Th right>Likes</Th><Th right>Contacts</Th></tr></thead>
                <tbody>{data.daily.map((day) => <tr key={day.date} className="border-t border-white/[0.05]"><td className="px-2 py-1 text-slate-300">{day.date}</td><td className="px-2 py-1 text-right tabular-nums">{day.views}</td><td className="px-2 py-1 text-right tabular-nums">{day.saves}</td><td className="px-2 py-1 text-right tabular-nums">{day.likes}</td><td className="px-2 py-1 text-right tabular-nums">{day.contacts}</td></tr>)}</tbody></table>
            </div>
          </div>
          {data.snapshots.length ? <p className="text-[11px] text-slate-500">{data.snapshots.length} daily snapshots recorded; latest sell probability {data.snapshots.at(-1)?.sell_probability ?? "—"}.</p> : null}
        </div>
      ) : null}
    </DetailDrawer>
  );
}

function AnomalyCard({ anomaly }: { anomaly: MarketAnomaly }) {
  return (
    <li className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={anomaly.severity === "high" ? "danger" : "warning"}>{anomaly.severity}</Chip>
        <p className="text-sm font-semibold text-slate-100">{anomaly.label} {anomaly.direction} on {anomaly.date}</p>
      </div>
      <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3">
        <div><dt className="text-slate-500">Baseline</dt><dd className="text-slate-200">{anomaly.baseline.median} (same weekday, {anomaly.baseline.weeks} weeks)</dd></div>
        <div><dt className="text-slate-500">Observed / deviation</dt><dd className="text-slate-200">{anomaly.observed} / {anomaly.deviation.absolute > 0 ? "+" : ""}{anomaly.deviation.absolute} ({formatPctValue(anomaly.deviation.pct)}), z {anomaly.deviation.z_score}</dd></div>
        <div><dt className="text-slate-500">Impact</dt><dd className="text-slate-200">{anomaly.impact}</dd></div>
      </dl>
      <details className="mt-3 text-[11px] text-slate-400">
        <summary className="focus-ring cursor-pointer text-slate-300">Evidence · {anomaly.evidence.source}</summary>
        <p className="mt-1">{anomaly.evidence.baseline_days.map((day) => `${day.date}: ${day.value}`).join(" · ")}</p>
      </details>
      <p className="mt-3 text-xs text-slate-300"><span className="font-semibold text-[#ded8ff]">Suggested action:</span> {anomaly.suggested_action}</p>
      <p className="mt-1 text-[10px] text-slate-500">{anomaly.auto_action}</p>
    </li>
  );
}

export function MarketView() {
  const [windowValue, setWindowValue] = useState<WindowValue>("7");
  const [ranking, setRanking] = useState<RankingKey>("viewed");
  const [openListing, setOpenListing] = useState<string | null>(null);
  const days = Number(windowValue);
  const query = useMemo(() => new URLSearchParams({ window_days: windowValue }), [windowValue]);
  const demandQuery = useMemo(() => new URLSearchParams({ window_days: String(Math.min(180, Math.max(7, days))) }), [days]);

  const rankings = useAdminResource("marketRankings", query);
  const performance = useAdminResource("marketPerformance", query);
  const anomalies = useAdminResource("marketAnomalies");
  const models = useAdminResource("marketModels");
  const categories = useAdminResource("intelligenceCategories", demandQuery);
  const geography = useAdminResource("intelligenceGeography", demandQuery);
  const scan = useAnomalyScan();

  const categoryRows = ((categories.data as unknown as { categories?: DemandRow[] } | undefined)?.categories ?? []).slice(0, 8);
  const countyRows = ((geography.data as unknown as { counties?: DemandRow[] } | undefined)?.counties ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace intelligence"
        title="What buyers want, and what converts"
        description="Rankings count distinct users per listing, never repeat actions, and leave out staff and the listing's own seller. Every figure can be traced to the tables named in its definition."
        meta={<DataFreshness state={rankings.isLoading ? "loading" : rankings.isError ? "error" : rankings.data ? "ready" : "unavailable"} generatedAt={rankings.data?.generated_at} windowLabel={`last ${days === 1 ? "24 hours" : `${days} days`}`} source="GET /admin/intelligence/market/rankings, /performance, /anomalies and /models." />}
        actions={<Segmented label="Time window" value={windowValue} options={[...WINDOWS]} onChange={setWindowValue} />}
      />

      <Panel eyebrow="Rankings" title="Listings by distinct users" description={rankings.data?.definitions.views}
        actions={<Segmented label="Ranking" value={ranking} options={[...RANKINGS]} onChange={setRanking} />}>
        {rankings.isLoading ? <ResourceState state="loading" message="Ranking listings…" /> : rankings.isError ? <Unavailable error={rankings.error} retry={() => void rankings.refetch()} what="Rankings" /> : rankings.data ? (
          <>
            <ListingTable rows={rankings.data.rankings[ranking]} onOpen={setOpenListing} trending={ranking === "trending"} />
            {rankings.data.truncated ? <p className="mt-2 text-[11px] text-amber-200">Reads hit the row cap; counts may be understated.</p> : null}
          </>
        ) : null}
      </Panel>

      <Panel eyebrow="Conversion vs popularity" title="Seen is not the same as wanted" description={rankings.data?.conversion.benchmark ? `Median contact rate ${formatPctValue(rankings.data.conversion.benchmark.median_contact_rate_pct)} across ${rankings.data.conversion.benchmark.listings_compared} listings with enough viewers.` : rankings.data?.conversion.note ?? undefined}>
        {rankings.data ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <ConversionList title="Popular, not converting" rows={rankings.data.conversion.popular_not_converting} onOpen={setOpenListing} />
            <ConversionList title="Hidden gems" rows={rankings.data.conversion.hidden_gems} onOpen={setOpenListing} />
          </div>
        ) : <ResourceState state="loading" message="Comparing conversion…" />}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Demand" title="By category" description="Demand = buyer threads + interests + Buying Agent requests.">
          {categories.isError ? <Unavailable error={categories.error} retry={() => void categories.refetch()} what="Category demand" /> : (
            <table className="w-full text-xs"><thead><tr><Th>Category</Th><Th right>Demand</Th><Th right>Live listings</Th><Th>Signal</Th></tr></thead>
              <tbody>{categoryRows.map((row) => <tr key={row.label} className="border-t border-white/[0.06]"><td className="px-2 py-2 text-slate-100">{row.label}</td><td className="px-2 py-2 text-right tabular-nums">{formatCount(row.demand)}</td><td className="px-2 py-2 text-right tabular-nums">{formatCount(row.supply_live)}</td><td className="px-2 py-2 text-slate-400">{row.signal ? signalMeta(row.signal).label : "—"}</td></tr>)}</tbody></table>
          )}
        </Panel>
        <Panel eyebrow="Demand" title="By county" description="Buyer threads against live listings.">
          {geography.isError ? <Unavailable error={geography.error} retry={() => void geography.refetch()} what="Geographic demand" /> : (
            <table className="w-full text-xs"><thead><tr><Th>County</Th><Th right>Buyer threads</Th><Th right>Live listings</Th></tr></thead>
              <tbody>{countyRows.map((row) => <tr key={row.label} className="border-t border-white/[0.06]"><td className="px-2 py-2 text-slate-100">{row.label}</td><td className="px-2 py-2 text-right tabular-nums">{formatCount(row.buyer_threads)}</td><td className="px-2 py-2 text-right tabular-nums">{formatCount(row.supply_live)}</td></tr>)}</tbody></table>
          )}
        </Panel>
      </div>

      <Panel eyebrow="Performance" title="Sellers and buyers" description={performance.data?.definitions.seller_contact_rate}>
        {performance.isLoading ? <ResourceState state="loading" message="Measuring performance…" /> : performance.isError ? <Unavailable error={performance.error} retry={() => void performance.refetch()} what="Performance" /> : performance.data ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-xs"><caption className="sr-only">Top sellers</caption><thead><tr><Th>Seller</Th><Th right>Viewers</Th><Th right>Contacted</Th><Th right>Rate</Th><Th right>Deals</Th></tr></thead>
                <tbody>{performance.data.sellers.top.map((row) => <tr key={row.seller_id} className="border-t border-white/[0.06]"><td className="px-2 py-2 text-slate-100">{row.name ?? row.seller_id.slice(0, 8)}</td><td className="px-2 py-2 text-right tabular-nums">{row.viewers}</td><td className="px-2 py-2 text-right tabular-nums">{row.contacters}</td><td className="px-2 py-2 text-right tabular-nums">{formatPctValue(row.contact_rate_pct)}</td><td className="px-2 py-2 text-right tabular-nums">{row.deals_agreed}</td></tr>)}</tbody></table>
            </div>
            <div className="overflow-x-auto">
              <p className="mb-2 text-[11px] text-slate-500">{formatCount(performance.data.buyers.browsers_without_contact)} of {formatCount(performance.data.buyers.total)} buyers browsed without contacting anyone.</p>
              <table className="w-full min-w-[420px] text-xs"><caption className="sr-only">Top buyers</caption><thead><tr><Th>Buyer</Th><Th right>Viewed</Th><Th right>Saved</Th><Th right>Contacted</Th><Th right>Deals</Th></tr></thead>
                <tbody>{performance.data.buyers.top.map((row) => <tr key={row.buyer_id} className="border-t border-white/[0.06]"><td className="px-2 py-2 text-slate-100">{row.name ?? row.buyer_id.slice(0, 8)}</td><td className="px-2 py-2 text-right tabular-nums">{row.listings_viewed}</td><td className="px-2 py-2 text-right tabular-nums">{row.listings_saved}</td><td className="px-2 py-2 text-right tabular-nums">{row.listings_contacted}</td><td className="px-2 py-2 text-right tabular-nums">{row.deals_agreed}</td></tr>)}</tbody></table>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel eyebrow="Anomalies" title="What moved against its normal"
        description={anomalies.data ? `Day ${anomalies.data.evaluated_day} against the same weekday over ${anomalies.data.baseline_weeks} weeks (median and MAD). Alerts never suspend or change an account.` : undefined}
        actions={<button type="button" onClick={() => scan.mutate()} disabled={scan.isPending} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/35 bg-[#8b75ff]/10 px-3 py-1.5 text-xs font-semibold text-[#ded8ff] disabled:opacity-50"><ScanSearch size={13} aria-hidden="true" />{scan.isPending ? "Scanning…" : "Raise alerts"}</button>}>
        {scan.data ? <p role="status" className="mb-3 text-xs text-emerald-200">{scan.data.alerts_created} new alert{scan.data.alerts_created === 1 ? "" : "s"}, {scan.data.alerts_existing} already open.</p> : null}
        {scan.isError ? <p role="alert" className="mb-3 text-xs text-rose-200">{scan.error.message}</p> : null}
        {anomalies.isLoading ? <ResourceState state="loading" message="Checking metrics…" /> : anomalies.isError ? <Unavailable error={anomalies.error} retry={() => void anomalies.refetch()} what="Anomaly detection" /> : anomalies.data ? (
          <>
            {anomalies.data.anomalies.length ? <ul className="space-y-3">{anomalies.data.anomalies.map((anomaly) => <AnomalyCard key={anomaly.metric} anomaly={anomaly} />)}</ul> : <p className="text-sm text-slate-400">Nothing unusual across {anomalies.data.checked.length} metrics.</p>}
            <ul className="mt-4 space-y-1 text-[11px] text-slate-500">{anomalies.data.not_instrumented.map((entry) => <li key={entry.metric}><span className="font-semibold text-slate-400">{entry.metric}:</span> not monitored. {entry.reason}</li>)}</ul>
          </>
        ) : null}
      </Panel>

      <Panel eyebrow="Models" title="Forecasts, risk and recommendations" description={models.data?.definitions.validated}>
        {models.isLoading ? <ResourceState state="loading" message="Running models…" /> : models.isError ? <Unavailable error={models.error} retry={() => void models.refetch()} what="Models" /> : models.data ? (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {models.data.forecasts.map((forecast) => (
                <div key={forecast.metric} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs">
                  <div className="flex items-center justify-between gap-2"><p className="font-semibold text-slate-100">{forecast.label}</p><Chip tone={forecast.validated ? "success" : "neutral"}>{forecast.validated ? "Validated" : "Withheld"}</Chip></div>
                  {forecast.validated ? <p className="mt-2 text-slate-300">Next 7 days: {formatCount(forecast.forecast.reduce((sum, day) => sum + day.expected, 0))} expected (backtest error {formatPctValue((forecast.backtest.wape ?? 0) * 100)}).</p> : <p className="mt-2 text-slate-500">{forecast.withheld_reason}</p>}
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-3 text-xs text-slate-300">
              <div className="rounded-xl border border-white/[0.07] p-4"><p className="font-semibold text-slate-100">Churn risk <Chip tone={models.data.churn.validated ? "success" : "neutral"}>{models.data.churn.validated ? "Validated" : "Unvalidated"}</Chip></p><p className="mt-2">{formatCount(models.data.churn.at_risk_total)} previously active users are going quiet.</p><p className="mt-1 text-slate-500">{models.data.churn.rule}</p></div>
              <div className="rounded-xl border border-white/[0.07] p-4"><p className="font-semibold text-slate-100">Supply gaps</p>{models.data.supply.gaps.length ? <ul className="mt-2 space-y-1">{models.data.supply.gaps.slice(0, 4).map((gap) => <li key={gap.category}>{gap.category}: about {gap.suggested_new_listings} more listings ({gap.live_listings} live, {gap.weekly_demand}/week demand)</li>)}</ul> : <p className="mt-2 text-slate-500">No category lacks supply.</p>}</div>
              <div className="rounded-xl border border-white/[0.07] p-4"><p className="font-semibold text-slate-100">Payments <Chip tone={models.data.payments.status === "rising" ? "danger" : "neutral"}>{models.data.payments.status.replace("_", " ")}</Chip></p><p className="mt-2">Failure rate {formatPctValue((models.data.payments.recent_failure_rate ?? 0) * 100)} this week, {formatPctValue((models.data.payments.prior_failure_rate ?? 0) * 100)} before.</p><p className="mt-1 text-slate-500">{models.data.payments.projection}</p></div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Recommendations</p>
              {models.data.recommendations.length ? (
                <ul className="mt-2 space-y-3">{models.data.recommendations.map((rec) => (
                  <li key={rec.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <p className="text-sm font-semibold text-slate-100">{rec.title} <Chip tone={rec.priority === "high" || rec.priority === "critical" ? "danger" : "neutral"}>{rec.priority}</Chip></p>
                    <p className="mt-1 text-xs text-slate-300">{rec.action}</p>
                    <p className="mt-2 text-[10px] text-slate-500">Based on: {rec.evidence.map((e) => `${e.label} ${e.value ?? "—"} (${e.source})`).join(" · ")}</p>
                  </li>
                ))}</ul>
              ) : <p className="mt-2 text-sm text-slate-500">No recommendation has enough evidence yet.</p>}
            </div>
          </div>
        ) : null}
      </Panel>

      <ListingDrawer listingId={openListing} days={days} onClose={() => setOpenListing(null)} />
    </div>
  );
}
