"use client";

import { Download, ExternalLink, RefreshCw, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { ListingFunnelTiles } from "@/components/intelligence/listing-analytics";
import { Chip, DataFreshness, DeltaChip, DetailDrawer, PageHeader, Panel, Segmented } from "@/components/intelligence/visuals";
import { ResourceState } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import { useAnomalyScan, useMarketListing } from "@/hooks/use-market";
import type { MarketAnomaly, MarketListingRow } from "@/lib/api/market-schemas";
import { downloadCSV } from "@/lib/csv";
import { formatCount, formatDuration, formatMinutes, formatPctValue, signalMeta } from "@/lib/intelligence";
import {
  MARKET_WINDOWS, MAX_CUSTOM_RANGE_DAYS, RANKING_OPTIONS, buildMarketQuery, customRangeError, defaultCustomRange,
  demandWindowDays, filterOptions, formatScore, isRankingKey, isScoreRanking, rangeDays, rankingCsvFilename,
  rankingCsvRows, scoreBreakdown, windowLabel, type CustomRange, type MarketWindow, type RankingKey,
} from "@/lib/market";

const UPGRADE = "Needs the upgraded BROKA API.";

type SortColumn = "viewers" | "savers" | "likers" | "contacters" | "negotiators" | "deal_buyers" | "score";
const SORT_COLUMN: Record<RankingKey, SortColumn> = {
  viewed: "viewers", saved: "savers", liked: "likers", contacted: "contacters",
  negotiated: "negotiators", converted: "deal_buyers", trending: "score", growing: "score",
};
const RANKING_LABEL = Object.fromEntries(RANKING_OPTIONS.map((option) => [option.value, option.label])) as Record<RankingKey, string>;
const EMPTY_RANKING: Record<RankingKey, string> = {
  viewed: "No listing here had a first-time viewer in this window.",
  saved: "No listing here was saved in this window.",
  liked: "No listing here was liked in this window.",
  contacted: "No buyer contacted a listing here in this window.",
  negotiated: "No conversation here went both ways, and no price offer was made, in this window.",
  converted: "No deal was agreed or completed on a listing here in this window.",
  trending: "No listing here scored at least 3 and more than in the window before.",
  growing: "No listing here grew from a score of at least 5 in the window before.",
};

const selectClass = "focus-ring rounded-lg border border-white/10 bg-[#080a14] px-2.5 py-1.5 text-xs font-semibold text-slate-200 [&>option]:bg-[#0b0e1a]";
const dateClass = "focus-ring rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-200";

function Unavailable({ error, retry, what }: { error: unknown; retry: () => void; what: string }) {
  return isEndpointMissing(error)
    ? <ResourceState state="unavailable" message={`${what} needs the upgraded BROKA API.`} />
    : <ResourceState state="error" message={error instanceof Error ? error.message : `${what} could not be loaded.`} action={<button type="button" onClick={retry} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200"><RefreshCw size={12} aria-hidden="true" />Retry</button>} />;
}

function Th({ children, right = false, active = false }: { children: ReactNode; right?: boolean; active?: boolean }) {
  return <th scope="col" aria-sort={active ? "descending" : undefined} className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${active ? "text-[#ded8ff]" : "text-slate-500"} ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Num({ value, active = false }: { value: number | null | undefined; active?: boolean }) {
  return <td className={`px-2 py-2 text-right tabular-nums ${active ? "font-semibold text-white" : "text-slate-300"}`}>{formatCount(value)}</td>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{children}</p>;
}

function ListingName({ row, onOpen }: { row: MarketListingRow; onOpen: (id: string) => void }) {
  return (
    <>
      <button type="button" onClick={() => onOpen(row.listing_id)} className="focus-ring text-left font-semibold text-slate-100 hover:text-[#ded8ff]">{row.name}</button>
      <p className="text-[10px] text-slate-500">{row.category ?? "Uncategorised"}{row.county ? ` · ${row.county}` : ""}</p>
    </>
  );
}

function ListingTable({ rows, ranking, onOpen }: { rows: MarketListingRow[]; ranking: RankingKey; onOpen: (id: string) => void }) {
  if (!rows.length) return <p className="text-sm text-slate-500">{EMPTY_RANKING[ranking]}</p>;
  const sorted = SORT_COLUMN[ranking];
  const scored = isScoreRanking(ranking);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-xs">
        <caption className="sr-only">{`${RANKING_LABEL[ranking]}: listings ranked by distinct users`}</caption>
        <thead>
          <tr>
            <Th>Listing</Th>
            <Th right active={sorted === "viewers"}>Viewers</Th>
            <Th right active={sorted === "savers"}>Savers</Th>
            <Th right active={sorted === "likers"}>Likers</Th>
            <Th right active={sorted === "contacters"}>Contacted</Th>
            <Th right active={sorted === "negotiators"}>Negotiated</Th>
            <Th right active={sorted === "deal_buyers"}>Deals</Th>
            <Th right>Completed</Th>
            <Th right>View → contact</Th>
            <Th right>Contact → deal</Th>
            <Th right active={sorted === "score"}>{scored ? "Score (before)" : "Score"}</Th>
            {scored ? <Th right>Change</Th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.listing_id} className="border-t border-white/[0.06]">
              <td className="px-2 py-2"><ListingName row={row} onOpen={onOpen} /></td>
              <Num value={row.viewers} active={sorted === "viewers"} />
              <Num value={row.savers} active={sorted === "savers"} />
              <Num value={row.likers} active={sorted === "likers"} />
              <Num value={row.contacters} active={sorted === "contacters"} />
              <Num value={row.negotiators} active={sorted === "negotiators"} />
              <Num value={row.deal_buyers} active={sorted === "deal_buyers"} />
              <Num value={row.completed_buyers} />
              <td className="px-2 py-2 text-right tabular-nums text-slate-300">{formatPctValue(row.view_to_contact_pct)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-300">{formatPctValue(row.contact_to_deal_pct)}</td>
              <td className={`px-2 py-2 text-right tabular-nums ${sorted === "score" ? "font-semibold text-white" : "text-slate-300"}`} title={scoreBreakdown(row.breakdown) || undefined}>
                {formatScore(row.score)}{scored ? ` (${formatScore(row.previous_score)})` : ""}
              </td>
              {scored ? <td className="px-2 py-2 text-right"><DeltaChip change={row.growth_pct} label="score against the window before" /></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Listings with the API's own explanation; `undefined` means the API did not send the list. */
function ListingNotes({ title, rows, onOpen, empty, extra }: {
  title: string; rows: MarketListingRow[] | undefined; onOpen: (id: string) => void; empty: string;
  extra?: (row: MarketListingRow) => ReactNode;
}) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      {rows === undefined ? <p className="mt-2 text-sm text-slate-500">{UPGRADE}</p> : rows.length ? (
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li key={row.listing_id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <button type="button" onClick={() => onOpen(row.listing_id)} className="focus-ring text-left text-sm font-semibold text-slate-100 hover:text-[#ded8ff]">{row.name}</button>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">{row.note}</p>
              {extra ? extra(row) : null}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-slate-500">{empty}</p>}
    </div>
  );
}

function ListingDrawer({ listingId, days, onClose }: { listingId: string | null; days: number; onClose: () => void }) {
  const detail = useMarketListing(listingId, days);
  const data = detail.data;
  return (
    <DetailDrawer
      open={listingId !== null}
      onClose={onClose}
      title={data?.listing.name ?? "Listing analytics"}
      subtitle={data ? `${data.listing.category ?? "Uncategorised"} · ${data.listing.county ?? "Unknown county"} · ${data.window.days}-day window` : undefined}
      footer={listingId ? <Link href={`/listings/${encodeURIComponent(listingId)}`} className="focus-ring inline-flex items-center gap-1.5 text-xs font-semibold text-[#c9beff] hover:text-white"><ExternalLink size={13} aria-hidden="true" />Open the listing record and its full analytics</Link> : undefined}
    >
      {detail.isLoading ? <ResourceState state="loading" message="Loading listing analytics…" /> : detail.isError ? <Unavailable error={detail.error} retry={() => void detail.refetch()} what="Listing analytics" /> : data ? (
        <div className="space-y-5">
          <ListingFunnelTiles data={data} />
          <p className="text-xs leading-5 text-slate-400">
            Seller: <Link href={`/users/${encodeURIComponent(data.listing.seller_id)}`} className="focus-ring font-semibold text-[#c9beff] hover:text-white">{data.listing.seller_name ?? `${data.listing.seller_id.slice(0, 8)}…`}</Link>.
            {data.category_position.listings_compared ? ` Ranks #${data.category_position.viewers_rank} by viewers among ${formatCount(data.category_position.listings_compared)} engaged listings in its category; category median contact rate ${formatPctValue(data.category_position.median_contact_rate_pct)}.` : ""}
          </p>
          <div>
            <Eyebrow>New distinct users per day</Eyebrow>
            <div className="mt-2 max-h-56 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead><tr><Th>Day</Th><Th right>Views</Th><Th right>Saves</Th><Th right>Contacts</Th><Th right>Negotiated</Th></tr></thead>
                <tbody>{data.daily.map((day) => <tr key={day.date} className="border-t border-white/[0.05]"><td className="px-2 py-1 text-slate-300">{day.date}</td><td className="px-2 py-1 text-right tabular-nums">{day.views}</td><td className="px-2 py-1 text-right tabular-nums">{day.saves}</td><td className="px-2 py-1 text-right tabular-nums">{day.contacts}</td><td className="px-2 py-1 text-right tabular-nums">{formatCount(day.negotiations)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          {data.snapshots.length ? <p className="text-[11px] text-slate-500">{data.snapshots.length} nightly snapshots recorded; latest sell score {formatPctValue(data.snapshots.at(-1)?.sell_probability, 0)} (rule-based, not a trained model).</p> : null}
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

/**
 * Demand and supply by category and county. An API from before
 * /market/demand still serves the category and county reads, which have no
 * window before them: the fallback shows no growth rather than inventing it.
 */
function useDemand(days: number) {
  const query = useMemo(() => new URLSearchParams({ window_days: String(days) }), [days]);
  const demand = useAdminResource("marketDemand", query);
  const missing = demand.isError && isEndpointMissing(demand.error);
  const categories = useAdminResource("intelligenceCategories", query, missing);
  const geography = useAdminResource("intelligenceGeography", query, missing);
  const categoryLabels = demand.data ? demand.data.categories.map((row) => row.label) : (categories.data?.categories ?? []).map((row) => row.label);
  const countyLabels = demand.data ? demand.data.counties.map((row) => row.label) : (geography.data?.counties ?? []).map((row) => row.label);
  return { demand, missing, categories, geography, categoryLabels, countyLabels };
}

function DemandPanels({ state, days, custom }: { state: ReturnType<typeof useDemand>; days: number; custom: boolean }) {
  const { demand, missing, categories, geography } = state;
  const scope = `Last ${days} days ending now, against the ${days} days before.${custom ? " Demand is measured over rolling windows, so the custom dates set only its length." : ""}`;

  if (missing) {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Demand" title="By category" description="Demand = buyer threads + interests + Buying Agent requests. This API has no comparison with the window before.">
          {categories.isError ? <Unavailable error={categories.error} retry={() => void categories.refetch()} what="Category demand" /> : (
            <table className="w-full text-xs"><caption className="sr-only">Demand by category</caption><thead><tr><Th>Category</Th><Th right>Demand</Th><Th right>Live listings</Th><Th>Signal</Th></tr></thead>
              <tbody>{(categories.data?.categories ?? []).slice(0, 10).map((row) => <tr key={row.key} className="border-t border-white/[0.06]"><td className="px-2 py-2 text-slate-100">{row.label}</td><td className="px-2 py-2 text-right tabular-nums">{formatCount(row.demand)}</td><td className="px-2 py-2 text-right tabular-nums">{formatCount(row.supply_live)}</td><td className="px-2 py-2 text-slate-400">{signalMeta(row.signal).label}</td></tr>)}</tbody></table>
          )}
        </Panel>
        <Panel eyebrow="Demand" title="By county" description="Buyer threads against live listings.">
          {geography.isError ? <Unavailable error={geography.error} retry={() => void geography.refetch()} what="Geographic demand" /> : (
            <table className="w-full text-xs"><caption className="sr-only">Demand by county</caption><thead><tr><Th>County</Th><Th right>Buyer threads</Th><Th right>Live listings</Th></tr></thead>
              <tbody>{(geography.data?.counties ?? []).slice(0, 10).map((row) => <tr key={row.key} className="border-t border-white/[0.06]"><td className="px-2 py-2 text-slate-100">{row.label}</td><td className="px-2 py-2 text-right tabular-nums">{formatCount(row.buyer_threads)}</td><td className="px-2 py-2 text-right tabular-nums">{formatCount(row.supply_live)}</td></tr>)}</tbody></table>
          )}
        </Panel>
      </div>
    );
  }

  const data = demand.data;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel eyebrow="Demand" title="By category" description={`${data?.definitions.demand ?? "Buyer threads + interests + Buying Agent requests."} ${scope}`}>
        {demand.isLoading ? <ResourceState state="loading" message="Measuring demand…" /> : demand.isError ? <Unavailable error={demand.error} retry={() => void demand.refetch()} what="Demand" /> : data ? (
          <>
            {data.growth.rising.length || data.growth.falling.length ? (
              <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
                {data.growth.rising.map((label) => <Chip key={`up-${label}`} tone="success">Rising · {label}</Chip>)}
                {data.growth.falling.map((label) => <Chip key={`down-${label}`} tone="warning">Falling · {label}</Chip>)}
              </div>
            ) : <p className="mb-3 text-[11px] text-slate-500">No category with enough demand before moved enough to call rising or falling.</p>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-xs">
                <caption className="sr-only">Demand by category against the window before</caption>
                <thead><tr><Th>Category</Th><Th right>Demand</Th><Th right>Change</Th><Th right>Live listings</Th><Th right>Per listing</Th><Th right>New listings (before)</Th><Th right>Deals (before)</Th><Th>Signal</Th></tr></thead>
                <tbody>
                  {data.categories.slice(0, 12).map((row) => (
                    <tr key={row.key} className="border-t border-white/[0.06]">
                      <td className="px-2 py-2 text-slate-100" title={row.recommendation ?? undefined}>{row.label}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.demand)} <span className="text-slate-500">({formatCount(row.demand_previous)})</span></td>
                      <td className="px-2 py-2 text-right"><DeltaChip change={row.demand_change_pct} label="demand against the window before" /></td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.supply_live)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.demand_per_listing ?? "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.new_listings)} <span className="text-slate-500">({formatCount(row.new_listings_previous)})</span></td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.deals_agreed)} <span className="text-slate-500">({formatCount(row.deals_agreed_previous)})</span></td>
                      <td className="px-2 py-2 text-slate-400">{signalMeta(row.signal).label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.categories.length ? <p className="mt-2 text-sm text-slate-500">No category had supply or demand in this window.</p> : null}
          </>
        ) : null}
      </Panel>
      <Panel eyebrow="Demand" title="By county" description={data?.definitions.county ?? "The listing's county. Buyers' own locations are not used."}>
        {demand.isLoading ? <ResourceState state="loading" message="Measuring demand…" /> : demand.isError ? <Unavailable error={demand.error} retry={() => void demand.refetch()} what="Geographic demand" /> : data ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <caption className="sr-only">Buyer conversations and supply by county against the window before</caption>
              <thead><tr><Th>County</Th><Th right>Buyer threads</Th><Th right>Change</Th><Th right>Live listings</Th><Th right>Threads per listing</Th><Th right>New listings (before)</Th><Th right>Stores</Th></tr></thead>
              <tbody>
                {data.counties.slice(0, 12).map((row) => (
                  <tr key={row.key} className="border-t border-white/[0.06]">
                    <td className="px-2 py-2 text-slate-100">{row.label}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.buyer_threads)} <span className="text-slate-500">({formatCount(row.buyer_threads_previous)})</span></td>
                    <td className="px-2 py-2 text-right"><DeltaChip change={row.buyer_threads_change_pct} label="buyer threads against the window before" /></td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.supply_live)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.threads_per_listing ?? "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.new_listings)} <span className="text-slate-500">({formatCount(row.new_listings_previous)})</span></td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCount(row.stores)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.counties.length ? <p className="mt-2 text-sm text-slate-500">No county had listings or buyer conversations in this window.</p> : null}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function PerformancePanel({ query }: { query: URLSearchParams | null }) {
  const performance = useAdminResource("marketPerformance", query ?? undefined, query !== null);
  const data = performance.data;
  return (
    <Panel eyebrow="Performance" title="Sellers and buyers" description={data?.definitions.seller_contact_rate}>
      {query === null ? <p className="text-sm text-slate-500">Choose a valid date range.</p> : performance.isLoading ? <ResourceState state="loading" message="Measuring performance…" /> : performance.isError ? <Unavailable error={performance.error} retry={() => void performance.refetch()} what="Performance" /> : data ? (
        <div className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <caption className="sr-only">Top sellers by buyers who contacted them</caption>
              <thead><tr><Th>Seller</Th><Th right>Live listings</Th><Th right>Viewers</Th><Th right active>Contacted</Th><Th right>Change</Th><Th right>Rate</Th><Th right>Negotiated</Th><Th right>Deals</Th><Th right>Completed</Th><Th right>First reply</Th></tr></thead>
              <tbody>
                {data.sellers.top.map((row) => (
                  <tr key={row.seller_id} className="border-t border-white/[0.06]">
                    <td className="px-2 py-2"><Link href={`/users/${encodeURIComponent(row.seller_id)}`} className="focus-ring font-semibold text-slate-100 hover:text-[#ded8ff]">{row.name ?? `${row.seller_id.slice(0, 8)}…`}</Link><p className="text-[10px] text-slate-500">{formatCount(row.listings_engaged)} listings engaged</p></td>
                    <Num value={row.live_listings} />
                    <Num value={row.viewers} />
                    <Num value={row.contacters} active />
                    <td className="px-2 py-2 text-right"><DeltaChip change={row.contacters_change_pct} label={`contacters against the window before (${formatCount(row.contacters_previous)})`} /></td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-300">{formatPctValue(row.contact_rate_pct)}</td>
                    <Num value={row.negotiators} />
                    <Num value={row.deals_agreed} />
                    <Num value={row.deals_completed} />
                    <td className="px-2 py-2 text-right tabular-nums text-slate-300" title={data.definitions.avg_first_reply_minutes}>{formatMinutes(row.avg_first_reply_minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.sellers.top.length ? <p className="mt-2 text-sm text-slate-500">No seller&apos;s listings were engaged in this window.</p> : null}
            {data.response_time_truncated ? <p className="mt-2 text-[11px] text-amber-200">Too many messages to time replies in one read: first-reply times are left out rather than averaged over part of them.</p> : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <Eyebrow>Buyer journey</Eyebrow>
              <p className="mt-1 text-[11px] text-slate-500">{data.definitions.buyer_funnel ?? "Distinct buyers at each stage in the window."}</p>
              {data.buyer_funnel === undefined ? <p className="mt-2 text-sm text-slate-500">{UPGRADE}</p> : (
                <ol className="mt-3 space-y-2">
                  {data.buyer_funnel.map((step) => (
                    <li key={step.key}>
                      <div className="flex items-baseline justify-between gap-2 text-xs"><span className="text-slate-300">{step.label}</span><span className="tabular-nums text-slate-100">{formatCount(step.buyers)} <span className="text-slate-500">{step.key === "viewed" ? "" : `· ${formatPctValue(step.pct_of_viewed)} of viewers`}</span></span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-white/[0.05]" aria-hidden="true"><div className="h-1.5 rounded-full bg-[#8b75ff]" style={{ width: `${Math.min(100, step.key === "viewed" ? (step.buyers ? 100 : 0) : step.pct_of_viewed ?? 0)}%` }} /></div>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-[11px] text-slate-500">{formatCount(data.buyers.browsers_without_contact)} of {formatCount(data.buyers.total)} buyers browsed without contacting anyone.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <caption className="sr-only">Top buyers by listings contacted</caption>
                <thead><tr><Th>Buyer</Th><Th right>Viewed</Th><Th right>Saved</Th><Th right active>Contacted</Th><Th right>Negotiated</Th><Th right>Deals</Th><Th right>Completed</Th></tr></thead>
                <tbody>
                  {data.buyers.top.map((row) => (
                    <tr key={row.buyer_id} className="border-t border-white/[0.06]">
                      <td className="px-2 py-2"><Link href={`/users/${encodeURIComponent(row.buyer_id)}`} className="focus-ring font-semibold text-slate-100 hover:text-[#ded8ff]">{row.name ?? `${row.buyer_id.slice(0, 8)}…`}</Link></td>
                      <Num value={row.listings_viewed} />
                      <Num value={row.listings_saved} />
                      <Num value={row.listings_contacted} active />
                      <Num value={row.listings_negotiated} />
                      <Num value={row.deals_agreed} />
                      <Num value={row.deals_completed} />
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.buyers.top.length ? <p className="mt-2 text-sm text-slate-500">No buyer activity in this window.</p> : null}
            </div>
          </div>
          {data.not_instrumented?.length ? <ul className="space-y-1 text-[11px] text-slate-500">{data.not_instrumented.map((entry) => <li key={entry.metric}><span className="font-semibold text-slate-400">{entry.metric}:</span> not measured. {entry.reason}</li>)}</ul> : null}
          {data.truncated ? <p className="text-[11px] text-amber-200">Reads hit the row cap; counts may be understated.</p> : null}
        </div>
      ) : null}
    </Panel>
  );
}

export function MarketView() {
  const [windowValue, setWindowValue] = useState<MarketWindow>("7");
  const [custom, setCustom] = useState<CustomRange>(() => defaultCustomRange());
  const [ranking, setRanking] = useState<RankingKey>("viewed");
  const [category, setCategory] = useState("");
  const [county, setCounty] = useState("");
  const [openListing, setOpenListing] = useState<string | null>(null);

  const isCustom = windowValue === "custom";
  const rangeError = isCustom ? customRangeError(custom) : null;
  const rankingsQuery = useMemo(() => buildMarketQuery(windowValue, custom, { category, county }), [windowValue, custom, category, county]);
  const performanceQuery = useMemo(() => buildMarketQuery(windowValue, custom), [windowValue, custom]);
  const demandDays = demandWindowDays(windowValue, custom);
  // The drawer's listing detail takes a rolling window of 1 to 90 days.
  const drawerDays = isCustom ? Math.min(90, Math.max(7, rangeDays(custom) ?? 30)) : Math.max(7, Number(windowValue));

  const rankings = useAdminResource("marketRankings", rankingsQuery ?? undefined, rankingsQuery !== null);
  const anomalies = useAdminResource("marketAnomalies");
  const models = useAdminResource("marketModels");
  const demandState = useDemand(demandDays);
  const scan = useAnomalyScan();

  const categoryOptions = filterOptions([...demandState.categoryLabels, category], "Uncategorised");
  const countyOptions = filterOptions([...demandState.countyLabels, county], "Unknown");
  const data = rankings.data;
  const rows = data ? data.rankings[ranking] : undefined;
  const label = windowLabel(windowValue, custom);

  function exportRanking() {
    if (!rows?.length) return;
    downloadCSV(rankingCsvFilename(ranking, windowValue, custom), rankingCsvRows(rows, ranking));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace intelligence"
        title="What buyers want, and what converts"
        description="Rankings count distinct users per listing, never repeat actions, and leave out staff and the listing's own seller. Each stage counts a buyer once: viewed, saved or liked, contacted, negotiated, deal agreed, deal completed."
        meta={<DataFreshness state={rankingsQuery === null ? "unavailable" : rankings.isLoading ? "loading" : rankings.isError ? "error" : data ? "ready" : "unavailable"} generatedAt={data?.generated_at} windowLabel={label} source="GET /admin/intelligence/market/rankings, /performance, /demand, /anomalies and /models." />}
        actions={<Segmented label="Time window" value={windowValue} options={[...MARKET_WINDOWS]} onChange={setWindowValue} />}
      />

      {isCustom ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-xs text-slate-400" role="group" aria-label="Custom date range">
          <label className="flex items-center gap-1.5">From<input type="date" aria-label="From date" value={custom.from} max={custom.to} onChange={(event) => { if (event.target.value) setCustom({ ...custom, from: event.target.value }); }} className={dateClass} /></label>
          <label className="flex items-center gap-1.5">Through<input type="date" aria-label="Through date" value={custom.to} min={custom.from} onChange={(event) => { if (event.target.value) setCustom({ ...custom, to: event.target.value }); }} className={dateClass} /></label>
          <span className="text-[11px] text-slate-500">UTC days, both included; up to {MAX_CUSTOM_RANGE_DAYS} days. Trending compares with the same number of days just before.</span>
          {rangeError ? <p role="alert" className="w-full text-[11px] text-rose-200">{rangeError}</p> : null}
        </div>
      ) : null}

      <Panel
        eyebrow="Rankings"
        title="Listings by distinct users"
        description={data?.formula ?? data?.definitions.views}
        actions={(
          <>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">Rank by
              <select aria-label="Ranking" value={ranking} onChange={(event) => { const next = event.target.value; if (isRankingKey(next)) setRanking(next); }} className={selectClass}>
                {RANKING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={exportRanking} disabled={!rows?.length} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"><Download size={13} aria-hidden="true" />Export CSV</button>
          </>
        )}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <label className="flex items-center gap-1.5">Category
            <select aria-label="Category filter" value={category} onChange={(event) => setCategory(event.target.value)} className={selectClass}>
              <option value="">All categories</option>
              {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">County
            <select aria-label="County filter" value={county} onChange={(event) => setCounty(event.target.value)} className={selectClass}>
              <option value="">All counties</option>
              {countyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          {category || county ? <button type="button" onClick={() => { setCategory(""); setCounty(""); }} className="focus-ring rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">Clear filters</button> : null}
          {data?.weights ? <span className="text-[11px] text-slate-500">Weights: {Object.entries(data.weights).map(([stage, weight]) => `${stage} ${weight}`).join(" · ")}</span> : null}
        </div>
        {rankingsQuery === null ? <p className="text-sm text-slate-500">Choose a valid date range.</p> : rankings.isLoading ? <ResourceState state="loading" message="Ranking listings…" /> : rankings.isError ? <Unavailable error={rankings.error} retry={() => void rankings.refetch()} what="Rankings" /> : data ? (
          <>
            {rows === undefined ? <p className="text-sm text-slate-500">This ranking needs the upgraded BROKA API.</p> : <ListingTable rows={rows} ranking={ranking} onOpen={setOpenListing} />}
            <p className="mt-3 text-[11px] text-slate-500">{formatCount(data.listings_engaged)} listings engaged in the window{data.category || data.county ? ` for ${[data.category, data.county].filter(Boolean).join(" in ")}` : ""}. {isScoreRanking(ranking) ? data.definitions[ranking] ?? "" : ""}</p>
            {data.truncated ? <p className="mt-2 text-[11px] text-amber-200">Reads hit the row cap; counts may be understated.</p> : null}
          </>
        ) : null}
      </Panel>

      <Panel
        eyebrow="Conversion vs popularity"
        title="Seen is not the same as wanted"
        description={data?.conversion.benchmark ? `Median contact rate ${formatPctValue(data.conversion.benchmark.median_contact_rate_pct)} across ${data.conversion.benchmark.listings_compared} listings with enough viewers. ${data.definitions.deal_rate ?? ""}` : data?.conversion.note ?? undefined}
      >
        {data ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <ListingNotes title="Popular, not converting" rows={data.conversion.popular_not_converting} onOpen={setOpenListing} empty={data.conversion.benchmark ? "No widely seen listing converts at under half the median." : "Not enough listings with viewers to compare yet."} />
            <ListingNotes title="Hidden gems" rows={data.conversion.hidden_gems} onOpen={setOpenListing} empty={data.conversion.benchmark ? "No less-seen listing converts at twice the median." : "Not enough listings with viewers to compare yet."} />
            <ListingNotes title="Contacted, no deal" rows={data.conversion.engaged_not_converting} onOpen={setOpenListing} empty="No listing with 3 or more buyers in contact went without a deal." />
            <ListingNotes title="Unusual interest" rows={data.conversion.unusual_interest} onOpen={setOpenListing} empty="No listing drew three times the median number of contacts." />
          </div>
        ) : rankings.isError || rankingsQuery === null ? <p className="text-sm text-slate-500">Shown with the rankings.</p> : <ResourceState state="loading" message="Comparing conversion…" />}
      </Panel>

      <Panel eyebrow="Attention" title="What needs a nudge" description={data ? `${data.definitions.losing_attention ?? ""} ${data.definitions.needs_seller ?? ""}`.trim() || undefined : undefined}>
        {data ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <ListingNotes title="Losing attention" rows={data.attention?.losing_attention} onOpen={setOpenListing} empty="No listing that scored 10 or more in the window before has fallen to half of that." />
            <ListingNotes
              title="Buyers waiting for the seller"
              rows={data.attention?.needs_seller}
              onOpen={setOpenListing}
              empty="No buyer who opened a conversation in this window has waited over 24 hours for the seller."
              extra={(row) => (
                <p className="mt-1 text-[11px] text-slate-500">
                  {formatCount(row.waiting_buyers)} waiting, the longest {formatDuration(row.oldest_wait_hours)} ·{" "}
                  <Link href={`/users/${encodeURIComponent(row.seller_id)}`} className="focus-ring font-semibold text-[#c9beff] hover:text-white">Open the seller</Link>
                </p>
              )}
            />
          </div>
        ) : rankings.isError || rankingsQuery === null ? <p className="text-sm text-slate-500">Shown with the rankings.</p> : <ResourceState state="loading" message="Checking attention…" />}
      </Panel>

      <DemandPanels state={demandState} days={demandDays} custom={isCustom} />

      <PerformancePanel query={performanceQuery} />

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
              <Eyebrow>Recommendations</Eyebrow>
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

      <ListingDrawer listingId={openListing} days={drawerDays} onClose={() => setOpenListing(null)} />
    </div>
  );
}
