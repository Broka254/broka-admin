"use client";

import { ArrowDownRight, ArrowUpRight, Lightbulb } from "lucide-react";

import { formatKES, formatPct, formatShortDate } from "@/lib/format";
import type { RevenueResponse } from "@/lib/api/revenue";

function Insight({ title, value, detail, icon: Icon }: { title: string; value: string; detail: string; icon: typeof ArrowUpRight }) {
  return (
    <article className="inset-panel p-4 transition hover:border-[#8b75ff]/25">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={14} aria-hidden="true" />
        <p className="text-[10px] font-bold uppercase tracking-[0.15em]">{title}</p>
      </div>
      <p className="mt-2.5 font-display text-lg font-bold tracking-[-0.02em] text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </article>
  );
}

export function RevenueInsights({ data }: { data: RevenueResponse }) {
  const topStream = [...data.income.streams].sort((a, b) => b.amount_minor - a.amount_minor)[0];
  const topCost = [...data.costs.kinds].sort((a, b) => b.amount_minor - a.amount_minor)[0];
  const costRatio = data.income.total_minor > 0 ? (data.costs.total_minor / data.income.total_minor) * 100 : null;
  const peak = data.series.reduce<(typeof data.series)[number] | null>((best, point) => !best || point.profit_minor > best.profit_minor ? point : best, null);
  const low = data.series.reduce<(typeof data.series)[number] | null>((worst, point) => !worst || point.profit_minor < worst.profit_minor ? point : worst, null);

  return (
    <section aria-labelledby="revenue-insights-heading">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-amber-300/25 bg-amber-300/10 text-amber-200" aria-hidden="true"><Lightbulb size={14} /></span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a895ff]">Decision support</p>
          <h2 id="revenue-insights-heading" className="font-display text-lg font-bold text-white">Revenue insights</h2>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Insight title="Leading income stream" value={topStream ? topStream.label : "No income yet"} detail={topStream ? formatKES(topStream.amount_minor, data.currency) + " across " + topStream.count.toLocaleString("en-KE") + " recorded events" : "No income stream was recorded in this date range."} icon={ArrowUpRight} />
        <Insight title="Largest cost category" value={topCost ? topCost.label : "No costs recorded"} detail={topCost ? formatKES(topCost.amount_minor, data.currency) + (topCost.estimated ? " · includes estimated rows" : " · no estimated rows flagged") : "No platform cost rows were recorded in this date range."} icon={ArrowDownRight} />
        <Insight title="Cost-to-income ratio" value={costRatio === null ? "—" : formatPct(costRatio)} detail={costRatio === null ? "Cannot calculate without platform income." : costRatio > 100 ? "Recorded costs exceed platform income in this period." : "Recorded platform costs as a share of platform income."} icon={ArrowDownRight} />
        <Insight title="Best reported bucket" value={peak ? formatKES(peak.profit_minor, data.currency) : "No trend data"} detail={peak ? "Highest reported contribution · " + formatShortDate(peak.bucket_start) : "No revenue buckets were returned for this period."} icon={ArrowUpRight} />
      </div>
      {low && peak && low.bucket_start !== peak.bucket_start ? <p className="mt-2 text-xs text-slate-500">Lowest reported bucket: {formatKES(low.profit_minor, data.currency)} on {formatShortDate(low.bucket_start)}.</p> : null}
    </section>
  );
}
