"use client";

import { ArrowUpRight, CircleHelp } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

import { Chip } from "@/components/intelligence/visuals";
import { InfoTip } from "@/components/ui/tooltip";
import type { CategoriesResponse, CategoryRow } from "@/lib/api/intelligence-schemas";
import { formatCount, formatPctValue, signalMeta, SIGNAL_META } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

type Point = { key: string; label: string; x: number; y: number; z: number; signal: string; recommendation: string; liquidity: number | null; median: number | null };

function PointTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Point }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const meta = signalMeta(point.signal);
  return (
    <div className="w-64 rounded-xl border border-[#8b75ff]/25 bg-[#0c1020]/98 px-3 py-2.5 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-white">{point.label}</p>
        <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
      </div>
      <dl className="mt-2 space-y-1 text-[11px]">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Demand signals</dt><dd className="font-semibold tabular-nums text-slate-100">{formatCount(point.y)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Live listings</dt><dd className="font-semibold tabular-nums text-slate-100">{formatCount(point.x)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Liquidity</dt><dd className="font-semibold tabular-nums text-slate-100">{formatPctValue(point.liquidity)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Median price</dt><dd className="font-semibold tabular-nums text-slate-100">{point.median === null ? "—" : `KES ${formatCount(point.median)}`}</dd></div>
      </dl>
      <p className="mt-2 font-semibold" style={{ color: meta.color }}>{meta.label}</p>
      <p className="mt-1 leading-4 text-slate-400">{point.recommendation}</p>
    </div>
  );
}

/**
 * Demand against live supply per category. Above the diagonal, buyers outnumber
 * listings. Points can be clicked; the adjacent category buttons provide the
 * same selection for keyboard and screen-reader users because SVG points are
 * not focusable.
 */
export function CategoryScatter({ rows, selected, onSelect }: { rows: CategoryRow[]; selected?: string | null; onSelect?: (key: string) => void }) {
  const points = useMemo<Point[]>(() => rows.filter((row) => row.demand > 0 || row.supply_live > 0).map((row) => ({
    key: row.key, label: row.label, x: row.supply_live, y: row.demand, z: Math.max(1, row.buyer_threads), signal: row.signal, recommendation: row.recommendation,
    liquidity: row.liquidity.rate_pct, median: row.median_price_kes,
  })), [rows]);
  const max = Math.max(1, ...points.flatMap((point) => [point.x, point.y]));
  if (!points.length) return <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No category has listings or buyer demand in this window yet.</p>;
  return (
    <div>
      <div className="h-80 w-full" role="img" aria-label="Scatter chart of buyer demand against live listings by category. Above the diagonal means demand exceeds live supply. Select a category to synchronise the chart and table.">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 26, left: 0 }}>
            <CartesianGrid stroke="rgba(195,202,226,0.08)" />
            <XAxis type="number" dataKey="x" name="Live listings" domain={[0, Math.ceil(max * 1.1)]} tick={{ fill: "#98a2ba", fontSize: 11 }} axisLine={{ stroke: "rgba(195,202,226,0.2)" }} tickLine={false} label={{ value: "Live listings (supply)", position: "insideBottom", offset: -14, fill: "#7d87a0", fontSize: 11 }} allowDecimals={false} />
            <YAxis type="number" dataKey="y" name="Demand" domain={[0, Math.ceil(max * 1.1)]} tick={{ fill: "#98a2ba", fontSize: 11 }} axisLine={false} tickLine={false} width={46} allowDecimals={false} label={{ value: "Demand", angle: -90, position: "insideLeft", fill: "#7d87a0", fontSize: 11 }} />
            <ZAxis type="number" dataKey="z" range={[70, 560]} />
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: Math.ceil(max * 1.1), y: Math.ceil(max * 1.1) }]} stroke="rgba(219,183,93,0.5)" strokeDasharray="5 5" ifOverflow="extendDomain" />
            <Tooltip content={<PointTooltip />} cursor={{ stroke: "rgba(139,117,255,0.35)" }} />
            <Scatter
              data={points}
              isAnimationActive={false}
              onClick={(entry) => {
                const point = (entry as { payload?: Point } | undefined)?.payload;
                if (point && onSelect) onSelect(point.key);
              }}
              cursor={onSelect ? "pointer" : undefined}
            >
              {points.map((point) => {
                const active = selected === point.key;
                return <Cell key={point.key} fill={signalMeta(point.signal).color} fillOpacity={active ? 1 : 0.7} stroke={active ? "#fff" : signalMeta(point.signal).color} strokeOpacity={active ? 0.95 : 0.85} strokeWidth={active ? 2 : 1} />;
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Select a category to inspect">
        <span className="mr-1 inline-flex items-center gap-1 text-[10px] text-slate-600"><CircleHelp size={11} aria-hidden="true" />Select:</span>
        {points.map((point) => (
          <button
            key={point.key}
            type="button"
            aria-pressed={selected === point.key}
            onClick={() => onSelect?.(point.key)}
            className={cn("focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition", selected === point.key ? "border-[#8b75ff]/55 bg-[#8b75ff]/15 text-[#ded8ff]" : "border-white/[0.08] text-slate-400 hover:border-[#8b75ff]/30 hover:text-slate-200")}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: signalMeta(point.signal).color }} aria-hidden="true" />
            {point.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SignalLegend({ counts }: { counts: Record<string, number> }) {
  return (
    <ul className="flex flex-wrap gap-2 text-[11px]" aria-label="Category signals">
      {Object.entries(SIGNAL_META).map(([key, meta]) => (
        <li key={key} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-black/20 px-2.5 py-1 text-slate-300">
          <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
          {meta.label}
          <span className="font-semibold text-white tabular-nums">{counts[key] ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}

function Recommendation({ row }: { row: CategoryRow }) {
  return <span className="line-clamp-2 text-[11px] leading-4 text-slate-400">{row.recommendation}</span>;
}

/** Every category, worst-served first, with the backend's recommendation. */
export function CategoryTable({ data, highlight, onSelect }: { data: CategoriesResponse; highlight?: string | null; onSelect?: (key: string) => void }) {
  const rows = useMemo(() => [...data.categories].sort((a, b) => signalMeta(a.signal).rank - signalMeta(b.signal).rank || b.demand - a.demand), [data.categories]);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    highlightRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [highlight]);
  if (!rows.length) return <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No categories yet.</p>;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-white/[0.07] md:block">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-3">Category</th>
              <th scope="col" className="px-3 py-3">Signal</th>
              <th scope="col" className="px-3 py-3 text-right" title="Buyer conversations, interests and Buying Agent requests">Demand</th>
              <th scope="col" className="px-3 py-3 text-right">Live</th>
              <th scope="col" className="px-3 py-3 text-right">New</th>
              <th scope="col" className="px-3 py-3 text-right">Buyer chats</th>
              <th scope="col" className="px-3 py-3 text-right">Unmatched asks</th>
              <th scope="col" className="px-3 py-3 text-right">Deals</th>
              <th scope="col" className="px-3 py-3 text-right" title={data.definitions.liquidity}>Liquidity</th>
              <th scope="col" className="px-3 py-3 text-right">Median price</th>
              <th scope="col" className="px-3 py-3">What to do</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = signalMeta(row.signal);
              const isHighlighted = highlight === row.key;
              return (
                <tr key={row.key} ref={isHighlighted ? highlightRef : undefined} className={cn("border-t border-white/[0.05] align-top transition", isHighlighted ? "bg-[#8b75ff]/[0.12]" : "hover:bg-white/[0.02]")} aria-selected={isHighlighted}>
                  <th scope="row" className="px-3 py-3 font-semibold text-slate-100">
                    <button type="button" onClick={() => onSelect?.(row.key)} className="focus-ring rounded text-left hover:text-[#ded8ff]" aria-label={`Inspect ${row.label}`}>{row.label}</button>
                  </th>
                  <td className="px-3 py-3"><Chip tone={meta.tone}>{meta.label}</Chip></td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-white">{formatCount(row.demand)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-300">{formatCount(row.supply_live)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-300">{formatCount(row.new_listings)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-300">{formatCount(row.buyer_threads)}</td>
                  <td className={cn("px-3 py-3 text-right tabular-nums", row.buy_agent_unmatched ? "text-amber-200" : "text-slate-500")}>{formatCount(row.buy_agent_unmatched)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-300">{formatCount(row.deals_agreed)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-300">{formatPctValue(row.liquidity.rate_pct)}<span className="block text-[10px] text-slate-600">{row.liquidity.eligible ? `${row.liquidity.with_buyer_contact}/${row.liquidity.eligible}` : "no cohort"}</span></td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-300">{row.median_price_kes === null ? "—" : `KES ${formatCount(row.median_price_kes)}`}</td>
                  <td className="max-w-72 px-3 py-3 leading-5 text-slate-400">{row.recommendation}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden" aria-label="Categories">
        {rows.map((row) => {
          const meta = signalMeta(row.signal);
          const isHighlighted = highlight === row.key;
          return (
            <li key={row.key}>
              <button type="button" onClick={() => onSelect?.(row.key)} aria-pressed={isHighlighted} className={cn("focus-ring w-full rounded-xl border p-3 text-left transition", isHighlighted ? "border-[#8b75ff]/45 bg-[#8b75ff]/[0.09]" : "border-white/[0.07] bg-white/[0.02]")}>
                <span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-100">{row.label}</span><Chip tone={meta.tone}>{meta.label}</Chip></span>
                <span className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <span><span className="block text-slate-600">Demand</span><span className="font-semibold tabular-nums text-white">{formatCount(row.demand)}</span></span>
                  <span><span className="block text-slate-600">Live</span><span className="font-semibold tabular-nums text-slate-200">{formatCount(row.supply_live)}</span></span>
                  <span><span className="block text-slate-600">Liquidity</span><span className="font-semibold tabular-nums text-slate-200">{formatPctValue(row.liquidity.rate_pct)}</span></span>
                </span>
                <span className="mt-2 block"><Recommendation row={row} /></span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Full definition block shown with the category selection. */
export function CategoryDetail({ row, definitions, onClose }: { row: CategoryRow; definitions: CategoriesResponse["definitions"]; onClose: () => void }) {
  const meta = signalMeta(row.signal);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={meta.tone}>{meta.label}</Chip>
        <InfoTip label="How category demand and supply are calculated">{definitions.demand ?? "Demand counts buyer conversations, interests and Buying Agent requests in the window. Supply is live listings right now."}</InfoTip>
        <button type="button" onClick={onClose} className="focus-ring ml-auto rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:text-white">Clear selection</button>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {[
          ["Demand signals", formatCount(row.demand)],
          ["Live supply", formatCount(row.supply_live)],
          ["New listings", formatCount(row.new_listings)],
          ["Buyer conversations", formatCount(row.buyer_threads)],
          ["Interests", formatCount(row.interests)],
          ["Views", formatCount(row.viewers)],
          ["Buying Agent asks", formatCount(row.buy_agent_requests)],
          ["Unmatched asks", formatCount(row.buy_agent_unmatched)],
          ["Sold-out reports", formatCount(row.sold_out_reports)],
          ["Deals agreed", formatCount(row.deals_agreed)],
          ["Demand / listing", row.demand_per_listing === null ? "—" : row.demand_per_listing.toFixed(2)],
          ["Median price", row.median_price_kes === null ? "—" : `KES ${formatCount(row.median_price_kes)}`],
        ].map(([label, value]) => (
          <div key={label} className="inset-panel p-2.5">
            <dt className="text-[9px] uppercase tracking-[0.1em] text-slate-600">{label}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="inset-panel p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Liquidity cohort</p>
        <p className="mt-1 text-sm font-semibold text-white">{formatPctValue(row.liquidity.rate_pct)} <span className="text-[11px] font-normal text-slate-500">{row.liquidity.eligible ? `${row.liquidity.with_buyer_contact} of ${row.liquidity.eligible} listings contacted` : "no eligible cohort"}</span></p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Recommendation</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">{row.recommendation}</p>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-white/[0.07] pt-3">
        <Link href={`/listings?search=${encodeURIComponent(row.label)}`} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/30 bg-[#8b75ff]/10 px-3 py-1.5 text-[11px] font-semibold text-[#ded8ff]">Find listings <ArrowUpRight size={11} aria-hidden="true" /></Link>
        <Link href="/growth" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white">Growth funnels</Link>
      </div>
    </div>
  );
}
