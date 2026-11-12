"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DateRangePicker, type DateRangeSelection } from "@/components/dashboard/date-range-picker";
import { DataFreshness } from "@/components/intelligence/visuals";
import { ResourceState, UnavailablePanel } from "@/components/ui/primitives";
import { AdminRequestError, isEndpointMissing } from "@/hooks/use-admin-resource";
import { useTimeseries } from "@/hooks/use-timeseries";
import { useUrlDateRange } from "@/hooks/use-url-date-range";
import { formatCompact, formatShortDate } from "@/lib/format";
import type { TimeseriesPoint } from "@/lib/api/revenue";

function defaultRange(): DateRangeSelection {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), bucket: "day" };
}

export function AnalyticsWindowNote({ selection }: { selection: DateRangeSelection }) {
  return (
    <p className="text-[10px] leading-4 text-slate-600">
      Window {formatShortDate(selection.from)} → {formatShortDate(selection.to)} · {selection.bucket} buckets · stored in the URL so a reload or a shared link reopens it.
    </p>
  );
}

export function MarketplaceAnalytics() {
  const fallback = useMemo(defaultRange, []);
  const [selection, setSelection] = useUrlDateRange(fallback);
  const query = useTimeseries(selection);
  return (
    <section aria-label="Marketplace analytics" className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <DateRangePicker {...selection} onChange={setSelection} />
        <DataFreshness
          label="Server-computed series"
          state={query.isLoading ? "loading" : query.isError ? "error" : "ready"}
          windowLabel={`${selection.from} → ${selection.to} · ${selection.bucket}`}
          source="GET /admin/analytics/timeseries. Buckets with no recorded activity are absent; this view never fills them with zeros."
        />
      </div>
      <AnalyticsWindowNote selection={selection} />
      <TimeseriesBody
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        series={query.data?.series}
        charts={MARKETPLACE_CHARTS}
        emptyMessage="No marketplace series returned for this range."
      />
    </section>
  );
}

export interface AnalyticsChartDef {
  key: string;
  title: string;
  subtitle: string;
  money?: boolean;
  /** Verified workspace where the same records can be inspected. */
  href?: string;
  linkLabel?: string;
}

export const MARKETPLACE_CHARTS: AnalyticsChartDef[] = [
  { key: "gmv_minor", title: "GMV", subtitle: "Gross merchandise value agreed per bucket", money: true, href: "/deals", linkLabel: "Open deals" },
  { key: "deals_agreed", title: "Deals agreed", subtitle: "Agreed deals per bucket", href: "/deals", linkLabel: "Open deals" },
  { key: "listings_created", title: "Listings created", subtitle: "New listings per bucket", href: "/listings", linkLabel: "Open listings" },
  { key: "disputes_opened", title: "Disputes opened", subtitle: "New disputes per bucket", href: "/disputes", linkLabel: "Open disputes" },
];

export function TimeseriesBody({
  isLoading,
  isError,
  error,
  series,
  charts,
  emptyMessage,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  series: Record<string, TimeseriesPoint[]> | undefined;
  charts: AnalyticsChartDef[];
  emptyMessage: string;
}) {
  const missing =
    error instanceof AdminRequestError &&
    (isEndpointMissing(error) ||
      error.code === "endpoint_unavailable" ||
      error.code === "path_not_allowlisted" ||
      error.code === "contract_not_registered");
  if (isLoading) return <ResourceState state="loading" message="Loading analytics series." />;
  if (isError && missing) {
    return (
      <UnavailablePanel
        title="Analytics endpoint not deployed"
        detail="The backend does not serve GET /admin/analytics/timeseries yet. These charts will activate automatically once the endpoint is deployed."
        compact
      />
    );
  }
  if (isError) {
    return (
      <ResourceState
        state="error"
        message={error instanceof Error ? error.message : "Unable to load analytics data."}
      />
    );
  }
  const available = charts.filter((chart) => (series?.[chart.key]?.length ?? 0) > 0);
  if (available.length === 0) return <ResourceState state="empty" message={emptyMessage} />;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-2">
        {available.map((chart) => (
          <SeriesChart
            key={chart.key}
            def={chart}
            points={series?.[chart.key] ?? []}
          />
        ))}
      </div>
      <p className="text-[10px] leading-4 text-slate-600">
        {available.length} of {charts.length} series returned data. A missing series is shown as unavailable, never as a flat zero line.
      </p>
    </div>
  );
}

export function SeriesChart({ def, points }: { def: AnalyticsChartDef; points: TimeseriesPoint[] }) {
  const rows = useMemo(
    () => points.map((point) => ({ t: point.t, v: point.v })),
    [points],
  );
  const formatValue = (value: number) =>
    def.money ? formatCompact(value) : new Intl.NumberFormat("en", { notation: "compact" }).format(value);
  const first = points[0];
  const last = points[points.length - 1];
  const total = points.reduce((sum, point) => sum + point.v, 0);
  const summary = `${def.title}: ${points.length} ${points.length === 1 ? "bucket" : "buckets"} from ${formatShortDate(first.t)} to ${formatShortDate(last.t)}. Total ${formatValue(total)}. Highest ${formatValue(Math.max(...points.map((point) => point.v)))}.`;
  return (
    <figure className="data-panel flex flex-col p-4 transition-colors hover:border-[#8b75ff]/30">
      <figcaption className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a895ff]">{def.title}</p>
          <h3 className="mt-1 font-display text-[15px] font-bold tracking-[-0.02em] text-white">{def.subtitle}</h3>
        </div>
        <span className="shrink-0 rounded-full border border-white/[0.08] bg-black/25 px-2 py-0.5 text-[10px] tabular-nums text-slate-500">{points.length} pts</span>
      </figcaption>
      <div
        className="mt-3 h-52"
        data-testid={`timeseries-chart-${def.key}`}
        role="img"
        aria-label={summary}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`fill-${def.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#54d7e9" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#54d7e9" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(195,202,226,0.1)" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={(value: string) => formatShortDate(value)}
              tick={{ fill: "#9ba4bc", fontSize: 11 }}
              axisLine={{ stroke: "rgba(195,202,226,0.2)" }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={formatValue}
              tick={{ fill: "#9ba4bc", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip
              labelFormatter={(value: string) => formatShortDate(String(value))}
              formatter={(value) => [
                def.money ? formatCompact(Number(value)) : Number(value).toLocaleString("en-KE"),
                def.title,
              ]}
              contentStyle={{
                background: "#13182b",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
                color: "#f7f7fc",
              }}
            />
            <Area
              type="monotone"
              dataKey="v"
              name={def.title}
              stroke="#54d7e9"
              fill={`url(#fill-${def.key})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "#54d7e9" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.055] pt-2">
        <span className="text-[10px] tabular-nums text-slate-600">Total {formatValue(total)} · units from the backend series</span>
        {def.href ? (
          <Link href={def.href} className="focus-ring inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 transition hover:text-[#ded8ff]">
            {def.linkLabel ?? "Open workspace"}
            <ArrowUpRight size={10} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </figure>
  );
}
