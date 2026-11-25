"use client";

import { useMemo } from "react";

import { TimeseriesBody, type AnalyticsChartDef } from "@/components/dashboard/analytics/marketplace-analytics";
import { DataFreshness, Panel } from "@/components/intelligence/visuals";
import { useTimeseries } from "@/hooks/use-timeseries";
import { coverageNote } from "@/lib/activity-format";

export const ENGAGEMENT_CHARTS: AnalyticsChartDef[] = [
  {
    key: "active_users",
    title: "Active accounts",
    subtitle: "Distinct accounts with foreground activity per UTC day",
    additive: false,
    href: "/analytics/users",
    linkLabel: "User intelligence",
  },
  { key: "signups", title: "Sign-ups", subtitle: "New accounts per day", href: "/users", linkLabel: "Open users" },
];

/** The same range MarketplaceActivity asks for, so the two share one request. */
export function trendRange(windowDays: number, now: Date = new Date()) {
  const from = new Date(now);
  from.setDate(now.getDate() - windowDays);
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), bucket: "day" as const };
}

export function EngagementTrends({ windowDays }: { windowDays: number }) {
  const range = useMemo(() => trendRange(windowDays), [windowDays]);
  const query = useTimeseries(range);
  const coverage = query.data?.coverage?.active_users_started_on ?? null;
  return (
    <Panel
      eyebrow="Growth and engagement"
      title={`Active accounts and sign-ups, last ${windowDays} days`}
      description={coverageNote(coverage)}
    >
      <div className="space-y-3">
        <DataFreshness
          label="Server-computed series"
          state={query.isLoading ? "loading" : query.isError ? "error" : "ready"}
          windowLabel={`${range.from} → ${range.to} · day`}
          source="GET /admin/analytics/timeseries: active_users and signups."
        />
        <TimeseriesBody
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          series={query.data?.series}
          charts={ENGAGEMENT_CHARTS}
          emptyMessage="No sign-ups or measured activity in this window."
        />
      </div>
    </Panel>
  );
}
