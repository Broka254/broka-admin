"use client";

import { useState } from "react";
import { Activity, BarChart3 } from "lucide-react";

import { cn } from "@/lib/utils";
import { UnavailablePanel } from "@/components/ui/primitives";

const metrics = ["Users", "Listings", "Deals", "Transactions", "GMV"] as const;
const ranges = ["24H", "7D", "30D", "90D", "1Y"] as const;

export function PlatformActivity() {
  const [metric, setMetric] = useState<(typeof metrics)[number]>("Users");
  const [range, setRange] = useState<(typeof ranges)[number]>("30D");

  return <section className="data-panel overflow-hidden" aria-labelledby="activity-heading"><div className="flex flex-col gap-5 border-b border-white/[0.07] px-5 py-5 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg border border-[#8b75ff]/20 bg-[#8b75ff]/10 text-[#a895ff]"><Activity size={15} aria-hidden="true" /></span><div><p className="font-display text-base font-semibold text-slate-100" id="activity-heading">Platform activity</p><p className="mt-1 text-xs text-slate-500">Historical trends are shown only when the backend provides them.</p></div></div></div><div className="flex flex-col gap-2 sm:items-end"><div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.07] bg-black/10 p-1" role="tablist" aria-label="Activity metric">{metrics.map((item) => <button key={item} onClick={() => setMetric(item)} className={cn("rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition focus-ring", metric === item ? "bg-[#8b75ff]/20 text-[#ded8ff]" : "text-slate-500 hover:text-slate-200")} role="tab" aria-selected={metric === item}>{item}</button>)}</div><div className="flex gap-1" role="tablist" aria-label="Activity time range">{ranges.map((item) => <button key={item} onClick={() => setRange(item)} className={cn("rounded-md px-2 py-1 text-[10px] font-bold tracking-[0.08em] focus-ring", range === item ? "bg-cyan-300/10 text-cyan-200" : "text-slate-600 hover:text-slate-300")} role="tab" aria-selected={range === item}>{item}</button>)}</div></div></div><div className="grid min-h-[330px] place-items-center p-5"><div className="w-full max-w-xl"><div className="mb-5 flex items-center justify-between text-xs text-slate-500"><span className="inline-flex items-center gap-2"><BarChart3 size={15} className="text-[#54d7e9]" aria-hidden="true" />Selected signal: <strong className="text-slate-300">{metric}</strong></span><span>{range} window</span></div><UnavailablePanel compact title="Historical data unavailable" detail={`${metric} for the selected ${range} period has no documented admin time-series response yet. The dashboard will render the real series as soon as the API contract is published.`} /></div></div></section>;
}
