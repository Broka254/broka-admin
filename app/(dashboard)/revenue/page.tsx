"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { DateRangePicker, type DateRangeSelection } from "@/components/dashboard/date-range-picker";
import { ProfitChart } from "@/components/dashboard/revenue/profit-chart";
import { RevenueOverview } from "@/components/dashboard/revenue/revenue-overview";
import { StreamBreakdown } from "@/components/dashboard/revenue/stream-breakdown";
import { ResourceState, SectionEyebrow, UnavailablePanel } from "@/components/ui/primitives";
import { AdminRequestError, isEndpointMissing } from "@/hooks/use-admin-resource";
import { useRevenue } from "@/hooks/use-revenue";
import { downloadCSV, type CsvRow } from "@/lib/csv";

function defaultSelection(): DateRangeSelection {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    bucket: "day",
  };
}

function isUnavailable(error: unknown): boolean {
  if (isEndpointMissing(error)) return true;
  return (
    error instanceof AdminRequestError &&
    (error.code === "endpoint_unavailable" ||
      error.code === "path_not_allowlisted" ||
      error.code === "contract_not_registered")
  );
}

export default function RevenuePage() {
  const [selection, setSelection] = useState<DateRangeSelection>(defaultSelection);
  const revenue = useRevenue(selection);

  const csvRows = useMemo<CsvRow[]>(() => {
    const data = revenue.data;
    if (!data) return [];
    const rows: CsvRow[] = data.series.map((bucket) => ({
      section: "series",
      bucket_start: bucket.bucket_start,
      income_minor: bucket.income_minor,
      costs_minor: bucket.costs_minor,
      profit_minor: bucket.profit_minor,
      label: "",
      amount_minor: "",
      count: "",
    }));
    for (const stream of data.income.streams) {
      rows.push({
        section: "income_stream",
        bucket_start: "",
        income_minor: "",
        costs_minor: "",
        profit_minor: "",
        label: stream.label,
        amount_minor: stream.amount_minor,
        count: stream.count,
      });
    }
    return rows;
  }, [revenue.data]);

  if (revenue.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <SectionEyebrow>Money</SectionEyebrow>
          <h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Revenue</h1>
        </div>
        <DateRangePicker {...selection} onChange={setSelection} />
        <ResourceState state="loading" message="Loading revenue data." />
      </div>
    );
  }

  if (revenue.isError) {
    if (isUnavailable(revenue.error)) {
      return (
        <div className="space-y-6">
          <div>
            <SectionEyebrow>Money</SectionEyebrow>
            <h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Revenue</h1>
          </div>
          <DateRangePicker {...selection} onChange={setSelection} />
          <UnavailablePanel
            title="Revenue endpoint not deployed"
            detail="The backend does not serve GET /admin/revenue yet. This view will activate automatically once the endpoint is deployed."
          />
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div>
          <SectionEyebrow>Money</SectionEyebrow>
          <h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Revenue</h1>
        </div>
        <DateRangePicker {...selection} onChange={setSelection} />
        <ResourceState
          state="error"
          message={revenue.error instanceof Error ? revenue.error.message : "Unable to load revenue data."}
          action={
            <button
              type="button"
              onClick={() => revenue.refetch()}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-[#8b75ff]/40"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionEyebrow>Money</SectionEyebrow>
          <h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Revenue</h1>
          <p className="mt-1 text-sm text-slate-400">
            Platform income, costs, and profit per bucket. All money shown from minor units.
          </p>
        </div>
        <button
          type="button"
          disabled={!revenue.data || csvRows.length === 0}
          onClick={() =>
            downloadCSV(`revenue-${selection.from}-to-${selection.to}.csv`, csvRows)
          }
          className="inline-flex items-center gap-2 rounded-lg border border-[#8b75ff]/50 bg-[#8b75ff]/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#8b75ff]/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={14} aria-hidden="true" /> Export CSV
        </button>
      </div>
      <DateRangePicker {...selection} onChange={setSelection} />
      {revenue.data ? (
        <>
          <RevenueOverview data={revenue.data} />
          <ProfitChart data={revenue.data} />
          <StreamBreakdown data={revenue.data} />
        </>
      ) : (
        <ResourceState state="empty" message="No revenue data in this range." />
      )}
    </div>
  );
}
