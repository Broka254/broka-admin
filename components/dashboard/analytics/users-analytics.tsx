"use client";

import { useMemo } from "react";

import { DateRangePicker, type DateRangeSelection } from "@/components/dashboard/date-range-picker";
import { AnalyticsWindowNote, TimeseriesBody, type AnalyticsChartDef } from "@/components/dashboard/analytics/marketplace-analytics";
import { DataFreshness } from "@/components/intelligence/visuals";
import { useTimeseries } from "@/hooks/use-timeseries";
import { useUrlDateRange } from "@/hooks/use-url-date-range";

const USER_CHARTS: AnalyticsChartDef[] = [
  { key: "signups", title: "Signups", subtitle: "New user signups per bucket", href: "/users", linkLabel: "Open users" },
  { key: "active_users", title: "Active users", subtitle: "Active users per bucket", href: "/users", linkLabel: "Open users" },
];

function defaultRange(): DateRangeSelection {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), bucket: "day" };
}

// Self-fetching user analytics. The selected window lives in the URL so it
// survives a reload; missing series keys are skipped rather than zero-filled.
export function UsersAnalytics() {
  const fallback = useMemo(defaultRange, []);
  const [selection, setSelection] = useUrlDateRange(fallback);
  const query = useTimeseries(selection);
  return (
    <section aria-label="User analytics" className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <DateRangePicker {...selection} onChange={setSelection} />
        <DataFreshness
          label="Server-computed series"
          state={query.isLoading ? "loading" : query.isError ? "error" : "ready"}
          windowLabel={`${selection.from} → ${selection.to} · ${selection.bucket}`}
          source="GET /admin/analytics/timeseries. Missing buckets stay missing; no activity is inferred."
        />
      </div>
      <AnalyticsWindowNote selection={selection} />
      <TimeseriesBody
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        series={query.data?.series}
        charts={USER_CHARTS}
        emptyMessage="No user series returned for this range."
      />
    </section>
  );
}
