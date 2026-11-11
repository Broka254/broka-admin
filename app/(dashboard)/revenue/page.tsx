"use client";

import { useMemo, useState } from "react";
import { Download, Info, Landmark } from "lucide-react";

import { DateRangePicker, type DateRangeSelection } from "@/components/dashboard/date-range-picker";
import { ProfitChart } from "@/components/dashboard/revenue/profit-chart";
import { RevenueInsights } from "@/components/dashboard/revenue/revenue-insights";
import { RevenueOverview } from "@/components/dashboard/revenue/revenue-overview";
import { StreamBreakdown } from "@/components/dashboard/revenue/stream-breakdown";
import { PageHeader } from "@/components/intelligence/visuals";
import { ResourceState, UnavailablePanel } from "@/components/ui/primitives";
import { AdminRequestError, isEndpointMissing } from "@/hooks/use-admin-resource";
import { useRevenue } from "@/hooks/use-revenue";
import { buildRevenueCsvRows } from "@/lib/revenue-export";
import { previousRevenuePeriod } from "@/lib/api/revenue";
import { downloadCSV } from "@/lib/csv";

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function defaultSelection(): DateRangeSelection {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: toISODate(from), to: toISODate(to), bucket: "day" };
}

function isUnavailable(error: unknown): boolean {
  if (isEndpointMissing(error)) return true;
  return error instanceof AdminRequestError && (error.code === "endpoint_unavailable" || error.code === "path_not_allowlisted" || error.code === "contract_not_registered");
}

const HEADER = { eyebrow: "Money / Performance", title: "Platform revenue", description: "Income, recorded platform costs and reported contribution over time. Platform income is not GMV; external escrow is not BROKA cash." };

export default function RevenuePage() {
  const [selection, setSelection] = useState<DateRangeSelection>(defaultSelection);
  const revenue = useRevenue(selection);
  const previousSelection = useMemo(() => previousRevenuePeriod(selection), [selection.from, selection.to, selection.bucket]);
  const previousRevenue = useRevenue(previousSelection ?? selection, Boolean(revenue.data && previousSelection));
  const comparisonStatus = !previousSelection ? "unavailable" : previousRevenue.isLoading ? "loading" : previousRevenue.isError || !previousRevenue.data ? "unavailable" : "ready";
  const csvRows = useMemo(() => revenue.data ? buildRevenueCsvRows(revenue.data, selection) : [], [revenue.data, selection]);

  if (revenue.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} icon={<Landmark size={14} />} />
        <DateRangePicker {...selection} onChange={setSelection} />
        <ResourceState state="loading" message="Loading platform revenue data." />
      </div>
    );
  }

  if (revenue.isError) {
    if (isUnavailable(revenue.error)) {
      return (
        <div className="space-y-6">
          <PageHeader {...HEADER} icon={<Landmark size={14} />} actions={<span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">Awaiting backend</span>} />
          <DateRangePicker {...selection} onChange={setSelection} />
          <UnavailablePanel title="Revenue endpoint not deployed" detail="The backend does not serve GET /admin/revenue yet. This view will activate automatically once the endpoint is deployed." />
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} icon={<Landmark size={14} />} />
        <DateRangePicker {...selection} onChange={setSelection} />
        <ResourceState state="error" message={revenue.error instanceof Error ? revenue.error.message : "Unable to load revenue data."} action={<button type="button" onClick={() => revenue.refetch()} className="focus-ring rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-[#8b75ff]/40">Retry</button>} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        {...HEADER}
        icon={<Landmark size={14} />}
        actions={<button type="button" disabled={!revenue.data || csvRows.length === 0} onClick={() => downloadCSV("broka-revenue-" + selection.from + "-through-" + selection.to + ".csv", csvRows)} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#8b75ff]/50 bg-[#8b75ff]/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#8b75ff]/25 disabled:cursor-not-allowed disabled:opacity-40"><Download size={14} aria-hidden="true" /> Export full report (CSV)</button>}
      />

      <DateRangePicker {...selection} onChange={setSelection} />

      {revenue.data ? (
        <>
          <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
            <div className="flex items-start gap-2.5">
              <Info size={16} className="mt-0.5 shrink-0 text-cyan-200" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-cyan-100">What this report measures</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">This is BROKA platform income, not marketplace GMV or buyer/seller escrow principal. Reported profit is income less costs recorded or derived by the backend; it is an operating indicator, not an audited net-profit or tax/VAT statement. Costs with assumed rates are included and clearly marked.</p>
              </div>
            </div>
          </div>

          <RevenueOverview data={revenue.data} previousData={previousRevenue.data} comparisonStatus={comparisonStatus} />
          <ProfitChart data={revenue.data} />
          <RevenueInsights data={revenue.data} />
          <StreamBreakdown data={revenue.data} />
        </>
      ) : <ResourceState state="empty" message="No revenue data in this range." />}
    </div>
  );
}
