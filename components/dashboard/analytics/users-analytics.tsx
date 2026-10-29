"use client";

import { useState } from "react";

import { DateRangePicker, type DateRangeSelection } from "@/components/dashboard/date-range-picker";
import { TimeseriesBody, type AnalyticsChartDef } from "@/components/dashboard/analytics/marketplace-analytics";
import { useTimeseries } from "@/hooks/use-timeseries";

const USER_CHARTS: AnalyticsChartDef[] = [
  { key: "signups", title: "Signups", subtitle: "New user signups per bucket" },
  { key: "active_users", title: "Active users", subtitle: "Active users per bucket" },
];

// Self-fetching user analytics. No required props so the parent workspace
// registry can mount it later. Missing series keys are skipped gracefully.
export function UsersAnalytics() {
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
    <section aria-label="User analytics" className="space-y-4">
      <DateRangePicker {...selection} onChange={setSelection} />
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
