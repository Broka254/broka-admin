"use client";

import { ArrowUpRight, Clock, ExternalLink, Eye, Hourglass, MapPin, Phone, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Chip, ProgressBar, Segmented } from "@/components/intelligence/visuals";
import { InfoTip } from "@/components/ui/tooltip";
import type { GeographyResponse, SellersResponse } from "@/lib/api/intelligence-schemas";
import { formatCount, formatDuration, formatPctValue } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{9,15}$/.test(digits) ? `tel:${digits}` : null;
}

/** Sellers whose buyers have waited over a day, longest wait first: today's call list. */
export function WaitingSellers({ data }: { data: SellersResponse }) {
  if (!data.waiting.length) {
    return <p className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-5 text-sm text-emerald-100">No buyer has waited more than a day for a seller in the last {data.lookback_days} days.</p>;
  }
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {data.waiting.map((seller) => {
        const tel = telHref(seller.phone);
        return (
          <li key={seller.seller_id} className="group rounded-2xl border border-white/[0.07] bg-black/20 p-4 transition hover:border-[#8b75ff]/25">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/users/${encodeURIComponent(seller.seller_id)}`} className="focus-ring truncate text-sm font-semibold text-white hover:text-[#ded8ff]">{seller.name || "Unnamed seller"}</Link>
                <p className="mt-0.5 text-[11px] text-slate-500">{formatCount(seller.threads)} buyer chats · answered {formatPctValue(seller.answered_pct)}{seller.trust_score !== null && seller.trust_score !== undefined ? ` · trust ${seller.trust_score}` : ""}</p>
              </div>
              <Chip tone={(seller.oldest_wait_hours ?? 0) >= 72 ? "danger" : "warning"}><Hourglass size={10} aria-hidden="true" />{formatCount(seller.waiting)} waiting</Chip>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-300"><Clock size={12} className="text-amber-200" aria-hidden="true" />Oldest buyer waiting {formatDuration(seller.oldest_wait_hours)}</p>
            {seller.items.length ? <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-slate-500">For: {seller.items.slice(0, 4).join(", ")}{seller.items.length > 4 ? ` +${seller.items.length - 4}` : ""}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {tel ? <a href={tel} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100"><Phone size={12} aria-hidden="true" />Call {seller.phone}</a> : null}
              <Link href={`/users/${encodeURIComponent(seller.seller_id)}`} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"><ExternalLink size={12} aria-hidden="true" />Seller profile</Link>
              <Link href={`/complaints?about=${encodeURIComponent(seller.seller_id)}&queue=all`} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-amber-200">Complaint history</Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function BusiestSellers({ data }: { data: SellersResponse }) {
  if (!data.busiest.length) return <p className="text-sm text-slate-500">No seller had buyer conversations in the last {data.lookback_days} days.</p>;
  return (
    <ol className="space-y-3">
      {data.busiest.map((seller, index) => (
        <li key={seller.seller_id} className="flex items-center gap-3">
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold tabular-nums", index < 3 ? "border-[#8b75ff]/30 bg-[#8b75ff]/10 text-[#ded8ff]" : "border-white/[0.08] bg-white/[0.03] text-slate-400")}>{index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`/users/${encodeURIComponent(seller.seller_id)}`} className="focus-ring truncate text-xs font-semibold text-slate-100 hover:text-[#ded8ff]">{seller.name || "Unnamed seller"}</Link>
              <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{formatCount(seller.threads)} chats · {formatPctValue(seller.answered_pct)} answered</span>
            </div>
            <div className="mt-1.5"><ProgressBar value={seller.answered_pct} tone={(seller.answered_pct ?? 0) >= 50 ? "success" : "warning"} label={`${seller.name ?? "Seller"} answer rate`} /></div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Live listings no buyer has touched in two weeks: re-price, re-photo or retire. */
export function StaleListings({ data }: { data: SellersResponse }) {
  if (!data.stale_listings.length) return <p className="text-sm text-slate-500">No live listing has gone two weeks without buyer contact.</p>;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-white/[0.07] md:block">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.12em] text-slate-500">
            <tr><th scope="col" className="px-3 py-3">Listing</th><th scope="col" className="px-3 py-3">Category</th><th scope="col" className="px-3 py-3 text-right">Age</th><th scope="col" className="px-3 py-3 text-right">Views</th><th scope="col" className="px-3 py-3 text-right">Price</th><th scope="col" className="px-3 py-3"><span className="sr-only">Open</span></th></tr>
          </thead>
          <tbody>
            {data.stale_listings.map((listing) => (
              <tr key={listing.id} className="border-t border-white/[0.05] transition hover:bg-white/[0.02]">
                <th scope="row" className="max-w-72 truncate px-3 py-2.5 font-semibold text-slate-100"><Link href={`/listings/${encodeURIComponent(listing.id)}`} className="focus-ring hover:text-[#ded8ff]">{listing.name}</Link></th>
                <td className="px-3 py-2.5 text-slate-400">{listing.category ?? "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{listing.age_days === null ? "—" : `${Math.round(listing.age_days)}d`}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300"><span className="inline-flex items-center gap-1"><Eye size={11} aria-hidden="true" />{formatCount(listing.views)}</span></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{listing.price === null ? "—" : `KES ${formatCount(listing.price)}`}</td>
                <td className="px-3 py-2.5 text-right"><Link href={`/listings/${encodeURIComponent(listing.id)}`} className="focus-ring text-[11px] font-semibold text-[#a895ff] hover:text-[#ded8ff]">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {data.stale_listings.map((listing) => (
          <li key={listing.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-start justify-between gap-2"><Link href={`/listings/${encodeURIComponent(listing.id)}`} className="focus-ring text-sm font-semibold text-slate-100">{listing.name}</Link><span className="text-[10px] text-amber-200">{listing.age_days === null ? "—" : `${Math.round(listing.age_days)}d old`}</span></div>
            <p className="mt-1 text-[11px] text-slate-500">{listing.category ?? "Uncategorised"} · {formatCount(listing.views)} views · {listing.price === null ? "no price" : `KES ${formatCount(listing.price)}`}</p>
          </li>
        ))}
      </ul>
      {data.stale_total > data.stale_listings.length ? <p className="mt-2 text-[11px] text-slate-500">Showing {data.stale_listings.length} of {formatCount(data.stale_total)} stale listings.</p> : null}
    </>
  );
}

type GeoSort = "demand" | "supply" | "liquidity";

/** Where BROKA has supply, where buyers talk, and how fast listings find them. */
export function GeographyTable({ data }: { data: GeographyResponse }) {
  const [sort, setSort] = useState<GeoSort>("demand");
  const rows = useMemo(() => {
    const score = (row: GeographyResponse["counties"][number]) => sort === "supply" ? row.supply_live : sort === "liquidity" ? row.liquidity.rate_pct ?? -1 : row.buyer_threads;
    return [...data.counties].sort((a, b) => score(b) - score(a));
  }, [data.counties, sort]);
  if (!rows.length) return <p className="text-sm text-slate-500">No county has listings or buyer conversations in this window.</p>;
  const maxSupply = Math.max(1, ...rows.map((row) => row.supply_live));
  const maxThreads = Math.max(1, ...rows.map((row) => row.buyer_threads));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5"><Segmented label="Sort counties" value={sort} options={[{ value: "demand", label: "Demand" }, { value: "supply", label: "Supply" }, { value: "liquidity", label: "Liquidity" }]} onChange={setSort} />
          <InfoTip label="How county liquidity is calculated">{data.definitions.liquidity ?? "The share of eligible new listings in the county that received a buyer contact within seven days."}</InfoTip>
        </div>
        <p className="inline-flex items-center gap-1.5 text-[10px] text-slate-600"><MapPin size={11} className="text-[#a895ff]" aria-hidden="true" />Bars compare counties within this window only.</p>
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-white/[0.07] md:block">
        <table className="w-full min-w-[780px] text-left text-xs">
          <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.12em] text-slate-500">
            <tr><th scope="col" className="px-3 py-3">County</th><th scope="col" className="px-3 py-3">Live listings</th><th scope="col" className="px-3 py-3">Buyer chats</th><th scope="col" className="px-3 py-3 text-right">New</th><th scope="col" className="px-3 py-3 text-right">Stores</th><th scope="col" className="px-3 py-3 text-right">Chats / listing</th><th scope="col" className="px-3 py-3 text-right" title={data.definitions.liquidity}>Liquidity</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-white/[0.05] transition hover:bg-white/[0.02]">
                <th scope="row" className="px-3 py-2.5 font-semibold text-slate-100"><span className="inline-flex items-center gap-1.5"><MapPin size={12} className="text-[#a895ff]" aria-hidden="true" />{row.label}</span></th>
                <td className="w-48 px-3 py-2.5"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-gradient-to-r from-[#8b75ff] to-[#8b75ff]/60" style={{ width: `${(row.supply_live / maxSupply) * 100}%` }} /></div><span className="w-8 text-right tabular-nums text-slate-300">{formatCount(row.supply_live)}</span></div></td>
                <td className="w-48 px-3 py-2.5"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-gradient-to-r from-[#54d7e9] to-[#54d7e9]/60" style={{ width: `${(row.buyer_threads / maxThreads) * 100}%` }} /></div><span className="w-8 text-right tabular-nums text-slate-300">{formatCount(row.buyer_threads)}</span></div></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{formatCount(row.new_listings)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{formatCount(row.stores)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{row.threads_per_listing === null ? "—" : row.threads_per_listing.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300"><span className={cn(row.liquidity.rate_pct !== null && row.liquidity.rate_pct >= 50 ? "text-emerald-300" : "text-amber-200")}>{formatPctValue(row.liquidity.rate_pct)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.key} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-100"><MapPin size={12} className="text-[#a895ff]" aria-hidden="true" />{row.label}</span><span className={cn("text-[11px] font-semibold", row.liquidity.rate_pct !== null && row.liquidity.rate_pct >= 50 ? "text-emerald-300" : "text-amber-200")}>{formatPctValue(row.liquidity.rate_pct)} liquidity</span></div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]"><span><span className="block text-slate-600">Supply</span><span className="font-semibold text-slate-200">{formatCount(row.supply_live)}</span></span><span><span className="block text-slate-600">Buyer chats</span><span className="font-semibold text-slate-200">{formatCount(row.buyer_threads)}</span></span><span><span className="block text-slate-600">Chats / listing</span><span className="font-semibold text-slate-200">{row.threads_per_listing === null ? "—" : row.threads_per_listing.toFixed(2)}</span></span></div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500"><TrendingUp size={10} aria-hidden="true" />{row.new_listings} new · {row.stores} stores · <Link href={`/listings?search=${encodeURIComponent(row.label)}`} className="focus-ring inline-flex items-center gap-0.5 font-semibold text-[#a895ff]">listings <ArrowUpRight size={9} aria-hidden="true" /></Link></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
