"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { cn } from "@/lib/utils";
import { UnavailablePanel } from "@/components/ui/primitives";

const metrics = ["Users", "Listings", "Deals", "Transactions", "GMV"] as const;
const ranges = ["24H", "7D", "30D", "90D", "1Y"] as const;

export function PlatformActivity() {
  const [metric, setMetric] = useState<(typeof metrics)[number]>("Users");
  const [range, setRange] = useState<(typeof ranges)[number]>("30D");

  return (
    <section className="data-panel overflow-hidden" aria-labelledby="activity-heading">
      <div className="flex flex-col gap-5 border-b border-white/[0.07] px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-base font-semibold text-slate-100" id="activity-heading">Platform Activity</p>
          <p className="mt-1 text-xs text-slate-500">Backend time-series only. Missing periods remain unfilled.</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.07] bg-black/10 p-1" role="tablist" aria-label="Activity metric">
            {metrics.map((item) => <button key={item} onClick={() => setMetric(item)} className={cn("rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition", metric === item ? "bg-white/[0.11] text-amber-100" : "text-slate-500 hover:text-slate-200")} role="tab" aria-selected={metric === item}>{item}</button>)}
          </div>
          <div className="flex gap-1" role="tablist" aria-label="Activity time range">
            {ranges.map((item) => <button key={item} onClick={() => setRange(item)} className={cn("rounded-md px-2 py-1 text-[10px] font-bold tracking-[0.08em]", range === item ? "bg-amber-300/15 text-amber-200" : "text-slate-600 hover:text-slate-300")} role="tab" aria-selected={range === item}>{item}</button>)}
          </div>
        </div>
      </div>
      <div className="relative h-[330px] px-2 py-4" aria-label={`${metric} activity for ${range}. Historical data unavailable.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[]} margin={{ top: 12, right: 18, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#ffffff10" vertical={false} strokeDasharray="3 5" />
            <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} width={36} />
            <Line type="monotone" dataKey="value" stroke="#f2b965" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center bg-[#0f1219]/30 p-5">
          <UnavailablePanel compact title="Historical data unavailable" detail={`${metric} for the selected ${range} period has no documented admin time-series response yet. No values have been inferred.`} />
        </div>
      </div>
    </section>
  );
}
