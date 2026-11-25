"use client";

import { RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Chip, Panel, Segmented, StatTile } from "@/components/intelligence/visuals";
import { ResourceState } from "@/components/ui/primitives";
import { isEndpointMissing } from "@/hooks/use-admin-resource";
import { useMarketListing } from "@/hooks/use-market";
import type { MarketListingDetail } from "@/lib/api/market-schemas";
import { formatShortDate } from "@/lib/format";
import { formatCount, formatPctValue } from "@/lib/intelligence";

// One listing's journey from first view to completed deal
// (GET /admin/intelligence/market/listings/{id}). Shared by the listing
// record page and the drawer on the marketplace intelligence page.

const WINDOWS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;
type WindowValue = (typeof WINDOWS)[number]["value"];

const SERIES = [
  { key: "views", label: "Viewers", color: "#8b75ff" },
  { key: "saves", label: "Savers", color: "#54d7e9" },
  { key: "contacts", label: "Contacted", color: "#dbb75d" },
  { key: "negotiations", label: "Negotiated", color: "#34d399" },
] as const;

function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

/** The stages this listing's buyers reached, each buyer counted once per stage. */
export function ListingFunnelTiles({ data }: { data: MarketListingDetail }) {
  const { funnel, totals } = data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="listing-funnel">
      <StatTile label="Viewers" value={formatCount(funnel.viewers)} caption="First views in the window" />
      <StatTile label="Saved or liked" value={formatCount(funnel.savers_or_likers)} caption={`${formatPctValue(totals.view_to_save_pct)} of viewers saved`} />
      <StatTile label="Contacted" value={formatCount(funnel.contacters)} caption={`${formatPctValue(totals.view_to_contact_pct)} of viewers`} />
      <StatTile label="Negotiated" value={formatCount(funnel.negotiators)} caption="Seller replied, or an offer" />
      <StatTile label="Deals agreed" value={formatCount(funnel.deals_agreed)} caption={totals.contact_to_deal_pct === undefined ? undefined : `${formatPctValue(totals.contact_to_deal_pct)} of contacters`} />
      <StatTile label="Deals completed" value={formatCount(funnel.deals_completed)} caption="Escrow released" />
    </div>
  );
}

/** New distinct users per UTC day at each stage. */
export function ListingDailyChart({ data }: { data: MarketListingDetail }) {
  const series = SERIES.filter((entry) => entry.key !== "negotiations" || data.daily.some((day) => day.negotiations !== undefined));
  const total = data.daily.reduce((sum, day) => sum + day.views, 0);
  return (
    <figure className="space-y-2" data-testid="listing-daily-chart">
      <figcaption className="text-[11px] leading-5 text-slate-500">
        New distinct users per UTC day: a person is counted on the first day they reached a stage in the window. {formatCount(total)} first views over {data.daily.length} days.
      </figcaption>
      <div className="h-56" role="img" aria-label={`Viewers, savers, contacts and negotiations per day over ${data.daily.length} days`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(195,202,226,0.1)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => formatShortDate(value)}
              tick={{ fill: "#9ba4bc", fontSize: 11 }}
              axisLine={{ stroke: "rgba(195,202,226,0.2)" }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis allowDecimals={false} tick={{ fill: "#9ba4bc", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              labelFormatter={(value: string) => formatShortDate(String(value))}
              contentStyle={{ background: "#13182b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#f7f7fc" }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ba4bc" }} />
            {series.map((entry) => (
              <Line key={entry.key} type="monotone" dataKey={entry.key} name={entry.label} stroke={entry.color} strokeWidth={2} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** The nightly job's cumulative counts; a night it did not run has no row. */
export function ListingSnapshots({ data }: { data: MarketListingDetail }) {
  const note = data.definitions.snapshots;
  if (!data.snapshots.length) return <p className="text-[11px] leading-5 text-slate-500">No nightly snapshot in this window.{note ? ` ${note}` : ""}</p>;
  const recent = data.snapshots.slice(-10).reverse();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] text-[11px]">
        <caption className="sr-only">Nightly listing snapshots, latest first</caption>
        <thead><tr><Th>Night</Th><Th right>View counter</Th><Th right>Likes</Th><Th right>Interested buyers</Th><Th right>Sell score</Th></tr></thead>
        <tbody>
          {recent.map((snapshot) => (
            <tr key={snapshot.date} className="border-t border-white/[0.05]">
              <td className="px-2 py-1 text-slate-300">{snapshot.date}</td>
              <td className="px-2 py-1 text-right tabular-nums">{formatCount(snapshot.views)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{formatCount(snapshot.likes)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{formatCount(snapshot.interested_buyers)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{formatPctValue(snapshot.sell_probability, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">
        {data.snapshots.length > recent.length ? `Latest ${recent.length} of ${data.snapshots.length} nights. ` : ""}
        The sell score is the app&apos;s rule-based estimate (0 to 100), not a trained model.{note ? ` ${note}` : ""}
      </p>
    </div>
  );
}

function categoryPosition(data: MarketListingDetail): string {
  const position = data.category_position;
  if (!position.listings_compared) return "No listing in its category had viewers or contacts in this window.";
  return `Ranks #${position.viewers_rank} by viewers among ${formatCount(position.listings_compared)} engaged listings in its category. Category median contact rate: ${formatPctValue(position.median_contact_rate_pct)}.`;
}

/** Listing analytics on the listing record page. */
export function ListingAnalyticsPanel({ listingId }: { listingId: string }) {
  const [windowValue, setWindowValue] = useState<WindowValue>("30");
  const detail = useMarketListing(listingId, Number(windowValue));
  const data = detail.data;
  const deals = data ? Object.entries(data.deals_by_status).filter(([, count]) => count > 0) : [];

  return (
    <Panel
      id="listing-analytics"
      eyebrow="Listing analytics"
      title="From first view to completed deal"
      description="Distinct users at each stage in the window. Staff and the listing's own seller are never counted, and a negotiation is not a sale."
      actions={<Segmented label="Analytics window" value={windowValue} options={[...WINDOWS]} onChange={setWindowValue} />}
    >
      {detail.isLoading ? <ResourceState state="loading" message="Loading listing analytics…" /> : detail.isError ? (
        isEndpointMissing(detail.error)
          ? <ResourceState state="unavailable" message="Listing analytics needs the upgraded BROKA API." />
          : <ResourceState state="error" message={detail.error instanceof Error ? detail.error.message : "Listing analytics could not be loaded."} action={<button type="button" onClick={() => void detail.refetch()} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200"><RefreshCw size={12} aria-hidden="true" />Retry</button>} />
      ) : data ? (
        <div className="space-y-6">
          <ListingFunnelTiles data={data} />
          <div className="space-y-1 text-xs leading-5 text-slate-400">
            <p>{categoryPosition(data)}</p>
            <p>
              Lifetime view counter: {formatCount(data.listing.lifetime_views_counter)}
              {data.listing.age_days !== null ? ` over ${formatCount(data.listing.age_days)} days listed` : ""}.
              {data.definitions.lifetime_views_counter ? ` ${data.definitions.lifetime_views_counter}` : ""}
            </p>
          </div>
          <ListingDailyChart data={data} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Deals created in the window</p>
            {deals.length ? (
              <div className="mt-2 flex flex-wrap gap-2">{deals.map(([status, count]) => <Chip key={status} tone={status === "released" ? "success" : status === "cancelled" ? "danger" : "neutral"}>{status.replaceAll("_", " ")} · {count}</Chip>)}</div>
            ) : <p className="mt-2 text-sm text-slate-500">No deal was created on this listing in the window.</p>}
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Nightly snapshots</p>
            <ListingSnapshots data={data} />
          </div>
          {data.truncated ? <p className="text-[11px] text-amber-200">Reads hit the row cap; counts may be understated.</p> : null}
        </div>
      ) : null}
    </Panel>
  );
}
