"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ResourceState } from "@/components/ui/primitives";
import { formatCompact, formatKES, formatShortDate } from "@/lib/format";
import type { RevenueResponse } from "@/lib/api/revenue";

const INK = { violet: "#8b75ff", cyan: "#54d7e9", amber: "#dbb75d" };

function ChartTooltip({ active, payload, label, currency }: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#13182b] px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-200">{formatShortDate(String(label ?? ""))}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="mt-1 text-slate-300">
          {entry.name}:{" "}
          <span className="font-semibold text-white">
            {formatKES(Number(entry.value ?? 0), currency)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ProfitChart({ data }: { data: RevenueResponse | undefined }) {
  if (!data) return <ResourceState state="loading" message="Loading profit series." />;
  if (data.series.length === 0) {
    return <ResourceState state="empty" message="No revenue buckets in this range yet." />;
  }
  const rows = data.series.map((bucket) => ({
    ...bucket,
    label: bucket.bucket_start,
  }));
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1020] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Profit per bucket
          </p>
          <h3 className="mt-1 font-display text-lg font-bold text-white">
            Income vs costs, with profit line
          </h3>
        </div>
      </div>
      <div className="h-72" data-testid="profit-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(195,202,226,0.12)" vertical={false} />
            <XAxis
              dataKey="label"
              tickFormatter={(value: string) => formatShortDate(value)}
              tick={{ fill: "#9ba4bc", fontSize: 11 }}
              axisLine={{ stroke: "rgba(195,202,226,0.2)" }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(value: number) => formatCompact(value, data.currency)}
              tick={{ fill: "#9ba4bc", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={84}
            />
            <Tooltip content={<ChartTooltip currency={data.currency} />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#c5cada" }} />
            <Bar name="Income" dataKey="income_minor" fill={INK.violet} radius={[4, 4, 0, 0]} barSize={18} />
            <Bar name="Costs" dataKey="costs_minor" fill={INK.amber} radius={[4, 4, 0, 0]} barSize={18} />
            <Line
              name="Profit"
              type="monotone"
              dataKey="profit_minor"
              stroke={INK.cyan}
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
