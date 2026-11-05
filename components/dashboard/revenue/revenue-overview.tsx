"use client";

import { Info, TrendingDown, TrendingUp } from "lucide-react";

import { StatusBadge } from "@/components/ui/primitives";
import { formatKES, formatPct } from "@/lib/format";
import type { RevenueResponse } from "@/lib/api/revenue";

type ComparisonStatus = "loading" | "ready" | "unavailable";

function PeriodDelta({
  current,
  previous,
  currency,
  status,
  higherIsBetter = true,
  percentagePoints = false,
}: {
  current: number;
  previous?: number;
  currency: string;
  status: ComparisonStatus;
  higherIsBetter?: boolean;
  percentagePoints?: boolean;
}) {
  if (status === "loading") {
    return <span className="text-slate-500">Comparing with previous period…</span>;
  }
  if (status !== "ready" || previous === undefined) {
    return <span className="text-slate-500">Previous-period comparison unavailable</span>;
  }

  const delta = current - previous;
  if (delta === 0) {
    return <span className="text-slate-400">Unchanged vs previous period</span>;
  }

  if (previous === 0 && !percentagePoints) {
    const tone = higherIsBetter ? "text-emerald-300" : "text-rose-300";
    return <span className={tone}>New this period · prior period was zero</span>;
  }

  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const tone = improved ? "text-emerald-300" : "text-rose-300";
  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  const deltaLabel = percentagePoints
    ? (delta > 0 ? "+" : "") + delta.toFixed(1) + " pp"
    : (delta > 0 ? "+" : "") + formatKES(delta, currency);
  const percentLabel = percentagePoints
    ? ""
    : " (" + formatPct(Math.abs((delta / Math.abs(previous)) * 100)) + ")";

  return (
    <span className={"inline-flex items-center gap-1 " + tone}>
      <Icon size={12} aria-hidden="true" />
      {deltaLabel}{percentLabel} vs previous period
    </span>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sublabel?: React.ReactNode;
  tone?: "neutral" | "positive" | "negative";
}) {
  const valueClass =
    tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-rose-300" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1020] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={"mt-2 font-display text-2xl font-bold tracking-tight " + valueClass}>{value}</p>
      {sublabel ? <div className="mt-2 min-h-4 text-xs text-slate-400">{sublabel}</div> : null}
    </div>
  );
}

function CostConfidence({ data }: { data: RevenueResponse }) {
  const estimated = Math.max(0, Math.min(data.costs.total_minor, data.costs.estimated_minor));
  const recorded = Math.max(0, data.costs.total_minor - estimated);
  const hasEstimatedRows = data.costs.kinds.some((kind) => kind.estimated) || estimated > 0;
  const hasUnpricedRows = data.costs.kinds.some((kind) => kind.estimated && kind.amount_minor === 0);
  const estimatedShare = data.costs.total_minor > 0 ? (estimated / data.costs.total_minor) * 100 : 0;
  const recordedShare = data.costs.total_minor > 0 ? 100 - estimatedShare : 0;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-[#0c1020] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Cost confidence</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {hasEstimatedRows ? "Some cost rows are estimated or unpriced" : "No estimated cost rows reported"}
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {formatKES(estimated, data.currency)} estimated of {formatKES(data.costs.total_minor, data.currency)}
        </span>
      </div>
      <div
        className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10"
        role="img"
        aria-label={
          formatKES(recorded, data.currency) + " recorded/configured costs and " +
          formatKES(estimated, data.currency) + " estimated costs"
        }
      >
        <div className="h-full bg-cyan-300" style={{ width: recordedShare + "%" }} />
        <div className="h-full bg-amber-300" style={{ width: estimatedShare + "%" }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-300" />Recorded/configured: {formatKES(recorded, data.currency)}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-300" />Estimated: {formatKES(estimated, data.currency)}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Reported profit includes estimated costs. Provider usage without a verified rate can be recorded as an estimated zero-value row, so zero does not always mean no usage.
        {hasUnpricedRows ? " Unpriced rows are present in this period." : ""}
      </p>
    </div>
  );
}

export function RevenueOverview({
  data,
  previousData,
  comparisonStatus,
}: {
  data: RevenueResponse;
  previousData?: RevenueResponse;
  comparisonStatus: ComparisonStatus;
}) {
  const profitable = data.profit_minor >= 0;
  const hasEstimated = data.costs.kinds.some((kind) => kind.estimated) || data.costs.estimated_minor > 0;

  return (
    <section aria-label="Revenue overview">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Platform income"
          value={formatKES(data.income.total_minor, data.currency)}
          sublabel={
            <PeriodDelta current={data.income.total_minor} previous={previousData?.income.total_minor} currency={data.currency} status={comparisonStatus} />
          }
        />
        <KpiCard
          label="Platform costs"
          value={formatKES(data.costs.total_minor, data.currency)}
          sublabel={
            <PeriodDelta current={data.costs.total_minor} previous={previousData?.costs.total_minor} currency={data.currency} status={comparisonStatus} higherIsBetter={false} />
          }
        />
        <KpiCard
          label="Reported profit"
          value={formatKES(data.profit_minor, data.currency)}
          tone={profitable ? "positive" : "negative"}
          sublabel={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={profitable ? "success" : "danger"}>{profitable ? "Positive" : "Negative"}</StatusBadge>
              <PeriodDelta current={data.profit_minor} previous={previousData?.profit_minor} currency={data.currency} status={comparisonStatus} />
            </div>
          }
        />
        <KpiCard
          label="Reported margin"
          value={formatPct(data.margin_pct)}
          sublabel={
            <PeriodDelta current={data.margin_pct} previous={previousData?.margin_pct} currency={data.currency} status={comparisonStatus} percentagePoints />
          }
        />
      </div>

      <CostConfidence data={data} />

      {hasEstimated ? (
        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/90">
          Estimates are included in reported costs and profit. Treat the result as an operating indicator, not an audited net-profit figure.
        </div>
      ) : null}

      {data.notes.length > 0 ? (
        <div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4">
          <div className="flex items-start gap-2.5">
            <Info size={15} className="mt-0.5 shrink-0 text-cyan-200" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                Notes from finance
              </p>
              <ul className="mt-1.5 space-y-1">
                {data.notes.map((note) => (
                  <li key={note} className="text-sm leading-6 text-slate-300">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
