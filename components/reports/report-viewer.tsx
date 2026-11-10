"use client";

import { Check, Copy, Download, FileText, Printer, Store, Target } from "lucide-react";
import { useState } from "react";

import { InsightCard } from "@/components/intelligence/insight-feed";
import { Chip, DeltaChip, ProgressBar } from "@/components/intelligence/visuals";
import type { CategoryBrief, ReportDetail } from "@/lib/api/intelligence-schemas";
import { formatDateTime, formatKES } from "@/lib/format";
import { formatCount, formatDuration, formatPctValue, formatUnitValue, signalMeta, type GoodDirection } from "@/lib/intelligence";
import { downloadReportCsv, downloadReportMarkdown, reportDigest } from "@/lib/report-export";

function asGood(direction: string): GoodDirection {
  return direction === "down" ? "down" : direction === "neutral" ? "neutral" : "up";
}

function CategoryList({ title, rows, empty }: { title: string; rows: CategoryBrief[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</h4>
      {rows.length ? (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-slate-200">{row.label}</span>
              <span className="flex shrink-0 items-center gap-2 tabular-nums text-slate-400">
                {formatCount(row.demand)} wanted · {formatCount(row.supply_live)} live
                <span className="h-2 w-2 rounded-full" style={{ background: signalMeta(row.signal).color }} title={signalMeta(row.signal).label} aria-hidden="true" />
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-xs text-slate-500">{empty}</p>}
    </div>
  );
}

export function ReportViewer({ report }: { report: ReportDetail }) {
  const [copied, setCopied] = useState(false);
  const payload = report.payload;

  async function copyDigest() {
    try {
      await navigator.clipboard.writeText(reportDigest(report));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="report-sheet holo-panel overflow-hidden" data-print-root aria-labelledby="report-title">
      <header className="relative border-b border-white/[0.07] p-5 sm:p-6">
        <div className="cockpit-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="info">{report.kind}</Chip>
              {payload.period.in_progress || !report.stored ? <Chip tone="warning">Period to date · not stored</Chip> : <Chip tone="success">Stored</Chip>}
              <span className="text-[11px] text-slate-500">{payload.period.timezone}</span>
            </div>
            <h2 id="report-title" className="mt-3 font-display text-2xl font-bold tracking-[-0.04em] text-white">{report.title}</h2>
            <p className="mt-1 text-xs text-slate-500">Generated {formatDateTime(report.generated_at)} by {report.generated_by === "system" ? "the scheduler" : "an administrator"}</p>
          </div>
          <div className="print-hidden flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadReportMarkdown(report)} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"><FileText size={13} aria-hidden="true" />Markdown</button>
            <button type="button" onClick={() => downloadReportCsv(report)} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"><Download size={13} aria-hidden="true" />CSV</button>
            <button type="button" onClick={() => window.print()} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"><Printer size={13} aria-hidden="true" />Print / PDF</button>
            <button type="button" onClick={() => void copyDigest()} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/35 bg-[#8b75ff]/10 px-3 py-1.5 text-xs font-semibold text-[#ded8ff]">{copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{copied ? "Copied" : "Copy digest"}</button>
          </div>
        </div>
        <p className="relative mt-5 text-[15px] font-medium leading-7 text-slate-100">{payload.headline}</p>
      </header>

      <div className="space-y-6 p-5 sm:p-6">
        {payload.summary.length ? (
          <section aria-label="Summary">
            <ul className="space-y-2">
              {payload.summary.map((line) => <li key={line} className="flex gap-2 text-sm leading-6 text-slate-300"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8b75ff]" aria-hidden="true" />{line}</li>)}
            </ul>
          </section>
        ) : null}

        {payload.kpis.length ? (
          <section aria-label="Key figures">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Key figures</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
              {payload.kpis.map((kpi) => (
                <div key={kpi.key} className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{kpi.label}</p>
                  <p className="mt-2 font-display text-xl font-bold tracking-[-0.03em] text-white tabular-nums">{formatUnitValue(kpi.value, kpi.unit)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                    {kpi.change_pct !== null ? <DeltaChip change={kpi.change_pct} good={asGood(kpi.good_direction)} /> : null}
                    <span>prev {formatUnitValue(kpi.previous, kpi.unit)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {payload.insights.length ? (
          <section aria-label="Insights">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">What the numbers say</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">{payload.insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)}</div>
          </section>
        ) : null}

        {payload.categories ? (
          <section aria-label="Categories" className="grid gap-3 lg:grid-cols-3">
            <CategoryList title="Most wanted" rows={payload.categories.top_demand} empty="No buyer demand recorded." />
            <CategoryList title="Recruit sellers" rows={payload.categories.undersupplied} empty="No category is short of listings." />
            <CategoryList title="Too many listings" rows={payload.categories.oversupplied} empty="No category is oversupplied." />
          </section>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          {payload.targets.length ? (
            <section className="rounded-2xl border border-white/[0.07] bg-black/20 p-4" aria-label="Targets">
              <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500"><Target size={12} aria-hidden="true" />Day-30 targets</h3>
              <ul className="mt-3 space-y-3">
                {payload.targets.map((target) => (
                  <li key={target.key}>
                    <div className="flex items-baseline justify-between text-xs"><span className="text-slate-300">{target.label}</span><span className="tabular-nums text-slate-400"><span className="font-semibold text-white">{formatUnitValue(target.actual, target.unit)}</span> / {formatUnitValue(target.target, target.unit)}</span></div>
                    <div className="mt-1.5"><ProgressBar value={target.progress_pct} tone={target.met ? "success" : "info"} label={`${target.label} progress`} /></div>
                  </li>
                ))}
              </ul>
              {payload.break_even ? <p className="mt-4 text-xs text-slate-400">Break-even: {formatPctValue(payload.break_even.coverage_pct, 0)} of the {formatKES(payload.break_even.fixed_monthly_cost_minor)} monthly running cost covered{payload.break_even.gap_minor > 0 ? `, ${formatKES(payload.break_even.gap_minor)} to go` : ""}.</p> : null}
            </section>
          ) : null}
          <section className="rounded-2xl border border-white/[0.07] bg-black/20 p-4" aria-label="Trust and money">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Trust and money</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              {payload.complaints ? (
                <>
                  <div><dt className="text-slate-500">Complaints open</dt><dd className="mt-0.5 font-semibold text-white tabular-nums">{formatCount(payload.complaints.open)}</dd></div>
                  <div><dt className="text-slate-500">Past deadline</dt><dd className="mt-0.5 font-semibold text-white tabular-nums">{formatCount(payload.complaints.sla_breached)}</dd></div>
                  <div><dt className="text-slate-500">Median first reply</dt><dd className="mt-0.5 font-semibold text-white tabular-nums">{formatDuration(payload.complaints.median_response_hours_90d)}</dd></div>
                </>
              ) : null}
              {payload.revenue ? (
                <>
                  <div><dt className="text-slate-500">Income</dt><dd className="mt-0.5 font-semibold text-white tabular-nums">{formatKES(payload.revenue.income_minor)}</dd></div>
                  <div><dt className="text-slate-500">Costs</dt><dd className="mt-0.5 font-semibold text-white tabular-nums">{formatKES(payload.revenue.costs_minor)}</dd></div>
                  <div><dt className="text-slate-500">Profit</dt><dd className={payload.revenue.profit_minor >= 0 ? "mt-0.5 font-semibold text-emerald-300 tabular-nums" : "mt-0.5 font-semibold text-rose-300 tabular-nums"}>{formatKES(payload.revenue.profit_minor)}</dd></div>
                </>
              ) : null}
            </dl>
            {payload.sellers?.top_waiting.length ? (
              <div className="mt-4 border-t border-white/[0.06] pt-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200"><Store size={12} aria-hidden="true" />{formatCount(payload.sellers.waiting_total)} buyers waiting on {formatCount(payload.sellers.sellers_with_waiting_buyers)} sellers</p>
                <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
                  {payload.sellers.top_waiting.map((seller) => <li key={seller.seller_id}>{seller.name || `${seller.seller_id.slice(0, 8)}…`}: {formatCount(seller.waiting)} waiting, oldest {formatDuration(seller.oldest_wait_hours)}</li>)}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </article>
  );
}
