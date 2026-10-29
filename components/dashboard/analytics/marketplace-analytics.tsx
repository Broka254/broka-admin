"use client";

import { useMemo, useState } from "react";
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
import { ResourceState, UnavailablePanel } from "@/components/ui/primitives";
import { AdminRequestError, isEndpointMissing } from "@/hooks/use-admin-resource";
import { useTimeseries } from "@/hooks/use-timeseries";
import { formatCompact, formatShortDate } from "@/lib/format";
import type { TimeseriesPoint } from "@/lib/api/revenue";

// Self-fetching marketplace charts. The parent registry wires this in later,
// so this component takes no required props. It renders whatever series keys
// the backend returns and skips missing ones gracefully. GMV is labelled
// precisely as GMV and never as revenue.
export function MarketplaceAnalytics() {
  const [selection, setSelection] = useState<DateRangeSelection>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      bucket: "day",
    };
  });
  const query = useTimeseries(selection);
  return (
    <section aria-label="Marketplace analytics" className="space-y-4">
      <DateRangePicker {...selection} onChange={setSelection} />
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
}

export const MARKETPLACE_CHARTS: AnalyticsChartDef[] = [
  { key: "gmv_minor", title: "GMV", subtitle: "Gross merchandise value agreed per bucket", money: true },
  { key: "deals_agreed", title: "Deals agreed", subtitle: "Agreed deals per bucket" },
  { key: "listings_created", title: "Listings created", subtitle: "New listings per bucket" },
  { key: "disputes_opened", title: "Disputes opened", subtitle: "New disputes per bucket" },
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
    <div className="grid gap-3 xl:grid-cols-2">
      {available.map((chart) => (
        <SeriesChart
          key={chart.key}
          def={chart}
          points={series?.[chart.key] ?? []}
        />
      ))}
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
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1020] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{def.title}</p>
      <h3 className="mt-1 font-display text-base font-bold text-white">{def.subtitle}</h3>
      <div className="mt-3 h-52" data-testid={`timeseries-chart-${def.key}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(195,202,226,0.12)" vertical={false} />
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
              fill="rgba(84,215,233,0.18)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
