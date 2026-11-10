"use client";

import { Clock, ExternalLink, Eye, Hourglass, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { Chip, ProgressBar } from "@/components/intelligence/visuals";
import type { GeographyResponse, SellersResponse } from "@/lib/api/intelligence-schemas";
import { formatCount, formatDuration, formatPctValue } from "@/lib/intelligence";

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
          <li key={seller.seller_id} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{seller.name || "Unnamed seller"}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{formatCount(seller.threads)} buyer chats · answered {formatPctValue(seller.answered_pct)}{seller.trust_score !== null && seller.trust_score !== undefined ? ` · trust ${seller.trust_score}` : ""}</p>
              </div>
              <Chip tone={(seller.oldest_wait_hours ?? 0) >= 72 ? "danger" : "warning"}><Hourglass size={10} aria-hidden="true" />{formatCount(seller.waiting)} waiting</Chip>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-300"><Clock size={12} className="text-amber-200" aria-hidden="true" />Oldest buyer waiting {formatDuration(seller.oldest_wait_hours)}</p>
            {seller.items.length ? <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-slate-500">For: {seller.items.slice(0, 4).join(", ")}{seller.items.length > 4 ? ` +${seller.items.length - 4}` : ""}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {tel ? <a href={tel} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100"><Phone size={12} aria-hidden="true" />Call {seller.phone}</a> : null}
              <Link href={`/users/${encodeURIComponent(seller.seller_id)}`} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"><ExternalLink size={12} aria-hidden="true" />Seller profile</Link>
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
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] font-bold text-slate-400 tabular-nums">{index + 1}</span>
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
    <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.12em] text-slate-500">
          <tr><th scope="col" className="px-3 py-3">Listing</th><th scope="col" className="px-3 py-3">Category</th><th scope="col" className="px-3 py-3 text-right">Age</th><th scope="col" className="px-3 py-3 text-right">Views</th><th scope="col" className="px-3 py-3 text-right">Price</th><th scope="col" className="px-3 py-3"><span className="sr-only">Open</span></th></tr>
        </thead>
        <tbody>
          {data.stale_listings.map((listing) => (
            <tr key={listing.id} className="border-t border-white/[0.05]">
              <th scope="row" className="max-w-72 truncate px-3 py-2.5 font-semibold text-slate-100">{listing.name}</th>
              <td className="px-3 py-2.5 text-slate-400">{listing.category ?? "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{listing.age_days === null ? "—" : `${Math.round(listing.age_days)}d`}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300"><span className="inline-flex items-center gap-1"><Eye size={11} aria-hidden="true" />{formatCount(listing.views)}</span></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{listing.price === null ? "—" : `KES ${formatCount(listing.price)}`}</td>
              <td className="px-3 py-2.5 text-right"><Link href={`/listings/${encodeURIComponent(listing.id)}`} className="focus-ring text-[11px] font-semibold text-[#a895ff] hover:text-[#ded8ff]">Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.stale_total > data.stale_listings.length ? <p className="border-t border-white/[0.05] px-3 py-2 text-[11px] text-slate-500">Showing {data.stale_listings.length} of {formatCount(data.stale_total)} stale listings.</p> : null}
    </div>
  );
}

/** Where BROKA has supply, where buyers talk, and how fast listings find them. */
export function GeographyTable({ data }: { data: GeographyResponse }) {
  const rows = data.counties;
  if (!rows.length) return <p className="text-sm text-slate-500">No county has listings or buyer conversations in this window.</p>;
  const maxSupply = Math.max(1, ...rows.map((row) => row.supply_live));
  const maxThreads = Math.max(1, ...rows.map((row) => row.buyer_threads));
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.12em] text-slate-500">
          <tr><th scope="col" className="px-3 py-3">County</th><th scope="col" className="px-3 py-3">Live listings</th><th scope="col" className="px-3 py-3">Buyer chats</th><th scope="col" className="px-3 py-3 text-right">New</th><th scope="col" className="px-3 py-3 text-right">Stores</th><th scope="col" className="px-3 py-3 text-right">Chats / listing</th><th scope="col" className="px-3 py-3 text-right" title={data.definitions.liquidity}>Liquidity</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-white/[0.05]">
              <th scope="row" className="px-3 py-2.5 font-semibold text-slate-100"><span className="inline-flex items-center gap-1.5"><MapPin size={12} className="text-[#a895ff]" aria-hidden="true" />{row.label}</span></th>
              <td className="w-48 px-3 py-2.5"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-[#8b75ff]" style={{ width: `${(row.supply_live / maxSupply) * 100}%` }} /></div><span className="w-8 text-right tabular-nums text-slate-300">{formatCount(row.supply_live)}</span></div></td>
              <td className="w-48 px-3 py-2.5"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-[#54d7e9]" style={{ width: `${(row.buyer_threads / maxThreads) * 100}%` }} /></div><span className="w-8 text-right tabular-nums text-slate-300">{formatCount(row.buyer_threads)}</span></div></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{formatCount(row.new_listings)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{formatCount(row.stores)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{row.threads_per_listing === null ? "—" : row.threads_per_listing.toFixed(2)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{formatPctValue(row.liquidity.rate_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
