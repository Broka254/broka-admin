"use client";

import { useEffect, useMemo, useRef } from "react";
import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

import { Chip } from "@/components/intelligence/visuals";
import type { CategoriesResponse, CategoryRow } from "@/lib/api/intelligence-schemas";
import { formatCount, formatPctValue, signalMeta, SIGNAL_META } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

type Point = { key: string; label: string; x: number; y: number; z: number; signal: string; recommendation: string };

function PointTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Point }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const meta = signalMeta(point.signal);
  return (
    <div className="max-w-64 rounded-xl border border-white/10 bg-[#13182b]/95 px-3 py-2 text-xs shadow-2xl backdrop-blur">
      <p className="font-semibold text-white">{point.label}</p>
      <p className="mt-1 text-slate-300">{formatCount(point.y)} demand signals · {formatCount(point.x)} live listings</p>
      <p className="mt-1 font-semibold" style={{ color: meta.color }}>{meta.label}</p>
      <p className="mt-1 leading-4 text-slate-400">{point.recommendation}</p>
    </div>
  );
}

/** Demand against live supply per category: above the diagonal, buyers outnumber listings. */
export function CategoryScatter({ rows }: { rows: CategoryRow[] }) {
  const points = useMemo<Point[]>(() => rows.filter((row) => row.demand > 0 || row.supply_live > 0).map((row) => ({
    key: row.key, label: row.label, x: row.supply_live, y: row.demand, z: Math.max(1, row.buyer_threads), signal: row.signal, recommendation: row.recommendation,
  })), [rows]);
  const max = Math.max(1, ...points.flatMap((point) => [point.x, point.y]));
  if (!points.length) return <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No category has listings or buyer demand in this window yet.</p>;
  return (
    <div className="h-80 w-full" role="img" aria-label="Scatter chart of buyer demand against live listings by category">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, bottom: 18, left: 0 }}>
          <CartesianGrid stroke="rgba(195,202,226,0.08)" />
          <XAxis type="number" dataKey="x" name="Live listings" domain={[0, Math.ceil(max * 1.1)]} tick={{ fill: "#9ba4bc", fontSize: 11 }} axisLine={{ stroke: "rgba(195,202,226,0.2)" }} tickLine={false} label={{ value: "Live listings (supply)", position: "insideBottom", offset: -10, fill: "#6b7490", fontSize: 11 }} allowDecimals={false} />
          <YAxis type="number" dataKey="y" name="Demand" domain={[0, Math.ceil(max * 1.1)]} tick={{ fill: "#9ba4bc", fontSize: 11 }} axisLine={false} tickLine={false} width={44} allowDecimals={false} label={{ value: "Demand", angle: -90, position: "insideLeft", fill: "#6b7490", fontSize: 11 }} />
          <ZAxis type="number" dataKey="z" range={[60, 520]} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: Math.ceil(max * 1.1), y: Math.ceil(max * 1.1) }]} stroke="rgba(219,183,93,0.45)" strokeDasharray="5 5" ifOverflow="extendDomain" />
          <Tooltip content={<PointTooltip />} cursor={{ stroke: "rgba(139,117,255,0.35)" }} />
          <Scatter data={points} isAnimationActive={false}>
            {points.map((point) => <Cell key={point.key} fill={signalMeta(point.signal).color} fillOpacity={0.78} stroke={signalMeta(point.signal).color} strokeOpacity={0.9} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
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

/** Every category, worst-served first, with the backend's recommendation. */
export function CategoryTable({ data, highlight }: { data: CategoriesResponse; highlight?: string | null }) {
  const rows = useMemo(() => [...data.categories].sort((a, b) => signalMeta(a.signal).rank - signalMeta(b.signal).rank || b.demand - a.demand), [data.categories]);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    highlightRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [highlight]);
  if (!rows.length) return <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No categories yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
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
              <tr key={row.key} ref={isHighlighted ? highlightRef : undefined} className={cn("border-t border-white/[0.05] align-top transition", isHighlighted ? "bg-[#8b75ff]/[0.12]" : "hover:bg-white/[0.02]")} aria-current={isHighlighted ? "true" : undefined}>
                <th scope="row" className="px-3 py-3 font-semibold text-slate-100">{row.label}</th>
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
  );
}
