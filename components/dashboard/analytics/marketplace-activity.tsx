"use client";

import { RefreshCw } from "lucide-react";
import { useMemo } from "react";

import { MARKETPLACE_CHARTS, TimeseriesBody } from "@/components/dashboard/analytics/marketplace-analytics";
import { DataFreshness, Panel } from "@/components/intelligence/visuals";
import { StatusBadge } from "@/components/ui/primitives";
import { useAlertsStream } from "@/hooks/use-alerts-stream";
import { useTimeseries } from "@/hooks/use-timeseries";

// Command Center marketplace activity: GMV, deals, listings and disputes over
// the same window as the pulse selector. Reuses the server-computed
// timeseries endpoint; no new backend surface and no zero-filling of gaps.
export function MarketplaceActivity({ windowDays }: { windowDays: number }) {
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - windowDays);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), bucket: "day" as const };
  }, [windowDays]);
  const query = useTimeseries(range);
  const stream = useAlertsStream();
  return (
    <Panel
      eyebrow="Marketplace activity"
      title={`Last ${windowDays} days`}
      description="GMV, agreed deals, new listings and disputes per day. Charts refresh when a live alert arrives. Missing days stay missing."
      actions={<>
        <StatusBadge tone={stream.status === "connected" ? "success" : "neutral"}>{stream.status === "connected" ? "Live alerts" : "Alerts offline"}</StatusBadge>
        <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-50"><RefreshCw size={12} className={query.isFetching ? "animate-spin" : ""} aria-hidden="true" />Refresh</button>
      </>}
    >
      <div className="space-y-3">
        <DataFreshness
          label="Server-computed series"
          state={query.isLoading ? "loading" : query.isError ? "error" : "ready"}
          windowLabel={`${range.from} → ${range.to} · ${range.bucket}`}
          source="GET /admin/analytics/timeseries."
        />
        <TimeseriesBody
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          series={query.data?.series}
          charts={MARKETPLACE_CHARTS}
          emptyMessage="No marketplace series returned for this window."
        />
      </div>
    </Panel>
  );
}
