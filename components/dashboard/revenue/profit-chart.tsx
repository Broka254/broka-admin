"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ResourceState } from "@/components/ui/primitives";
import { formatCompact, formatKES, formatShortDate } from "@/lib/format";
import type { RevenueResponse } from "@/lib/api/revenue";

const INK = { violet: "#8b75ff", cyan: "#54d7e9", amber: "#dbb75d" };

function ChartTooltip({ active, payload, label, currency }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string }>; label?: string; currency: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#13182b]/98 px-3 py-2 text-xs shadow-2xl backdrop-blur">
      <p className="font-semibold text-slate-200">{formatShortDate(String(label ?? ""))}</p>
      {payload.map((entry) => <p key={entry.name} className="mt-1 text-slate-300">{entry.name}: <span className="font-semibold text-white">{formatKES(Number(entry.value ?? 0), currency)}</span></p>)}
    </div>
  );
}

export function ProfitChart({ data }: { data: RevenueResponse | undefined }) {
  if (!data) return <ResourceState state="loading" message="Loading profit series." />;
  if (data.series.length === 0) return <ResourceState state="empty" message="No revenue buckets in this range yet." />;
  const rows = data.series.map((bucket) => ({ ...bucket, label: bucket.bucket_start }));
  const totalProfit = data.series.reduce((sum, bucket) => sum + bucket.profit_minor, 0);
  return (
    <div className="data-panel p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Performance by period</p>
          <h3 className="mt-1 font-display text-lg font-bold text-white">Platform income vs platform costs</h3>
          <p className="mt-1 text-xs text-slate-500">The reported profit line includes estimated cost rows where present. Hover a bucket for exact figures.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{data.bucket} buckets</span>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-2.5 py-1 text-[10px] font-semibold tabular-nums text-cyan-100">Range profit {formatKES(totalProfit, data.currency)}</span>
        </div>
      </div>
      <div className="h-72" data-testid="profit-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
            <defs>
              <linearGradient id="incomeBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={INK.violet} stopOpacity={0.95} /><stop offset="100%" stopColor={INK.violet} stopOpacity={0.45} /></linearGradient>
              <linearGradient id="costBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={INK.amber} stopOpacity={0.9} /><stop offset="100%" stopColor={INK.amber} stopOpacity={0.35} /></linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(195,202,226,0.1)" vertical={false} />
            <XAxis dataKey="label" tickFormatter={(value: string) => formatShortDate(value)} tick={{ fill: "#98a2ba", fontSize: 11 }} axisLine={{ stroke: "rgba(195,202,226,0.2)" }} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={(value: number) => formatCompact(value, data.currency)} tick={{ fill: "#98a2ba", fontSize: 11 }} axisLine={false} tickLine={false} width={84} />
            <Tooltip content={<ChartTooltip currency={data.currency} />} cursor={{ fill: "rgba(139,117,255,0.05)" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#c5cada" }} />
            <Bar name="Income" dataKey="income_minor" fill="url(#incomeBar)" radius={[4, 4, 0, 0]} barSize={18} />
            <Bar name="Costs" dataKey="costs_minor" fill="url(#costBar)" radius={[4, 4, 0, 0]} barSize={18} />
            <Line name="Reported profit" type="monotone" dataKey="profit_minor" stroke={INK.cyan} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: INK.cyan, stroke: "#05060d" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Revenue by period</caption>
        <thead><tr><th>Period</th><th>Income</th><th>Costs</th><th>Reported profit</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.bucket_start}><td>{formatShortDate(row.bucket_start)}</td><td>{formatKES(row.income_minor, data.currency)}</td><td>{formatKES(row.costs_minor, data.currency)}</td><td>{formatKES(row.profit_minor, data.currency)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
