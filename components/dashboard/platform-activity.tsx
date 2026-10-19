"use client";

import { Activity, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AdminResourcePayloads } from "@/lib/api/schemas";
import { ResourceState } from "@/components/ui/primitives";

type Snapshot = AdminResourcePayloads["opsSnapshot"];

export function PlatformActivity({ snapshot, state }: { snapshot?: Snapshot; state?: "loading" | "error" | "not-deployed" | "unavailable" }) {
  if (!snapshot) {
    const message = state === "loading" ? "Loading live window comparisons from /admin/ops-snapshot…" : state === "not-deployed" ? "The deployed backend does not expose /admin/ops-snapshot yet (HTTP 404). Window comparisons appear after the backend upgrade." : state === "error" ? "Unable to load the operations snapshot" : "Window comparisons require the ops snapshot contract";
    return <section className="data-panel" aria-labelledby="activity-heading"><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5"><div><p id="activity-heading" className="text-base font-semibold text-slate-100">Platform activity</p><p className="mt-1 text-xs text-slate-500">Two real windows, not a backfilled time series.</p></div><span className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-slate-500"><Activity size={16} aria-hidden="true" /></span></div><div className="p-5"><ResourceState state={state === "not-deployed" ? "unavailable" : state ?? "unavailable"} message={message} /></div></section>;
  }

  const rows = [
    { label: "New users", current: snapshot.users.new_current, previous: snapshot.users.new_previous, href: "/users" },
    { label: "New listings", current: snapshot.listings.created_current, previous: snapshot.listings.created_previous, href: "/listings" },
    { label: "Deals created", current: snapshot.deals.created_current, previous: snapshot.deals.created_previous, href: "/deals" },
    { label: "Deals released", current: snapshot.deals.released_current, previous: snapshot.deals.released_previous, href: "/deals?status=released" },
  ];
  const max = Math.max(1, ...rows.flatMap((row) => [row.current, row.previous]));

  return <section className="data-panel overflow-hidden" aria-labelledby="activity-heading">
    <div className="flex flex-col gap-3 border-b border-white/[0.07] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg border border-[#8b75ff]/20 bg-[#8b75ff]/10 text-[#a895ff]"><Activity size={15} aria-hidden="true" /></span><div><p className="font-display text-base font-semibold text-slate-100" id="activity-heading">Platform activity</p><p className="mt-1 text-xs text-slate-500">Current {snapshot.window_hours}h window against the previous {snapshot.window_hours}h. Durable counts only.</p></div></div>
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Generated {snapshot.generated_at ? new Date(snapshot.generated_at).toLocaleTimeString("en-KE") : "—"} UTC</span>
    </div>
    <div className="space-y-4 p-5">
      {rows.map((row) => {
        const delta = row.current - row.previous;
        return <a key={row.label} href={row.href} className="focus-ring group block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-[#8b75ff]/30">
          <div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-200">{row.label}</span><span className="inline-flex items-center gap-1 text-slate-500"><strong className={cn("font-display text-sm", delta >= 0 ? "text-emerald-300" : "text-amber-300")}>{delta >= 0 ? "+" : ""}{delta}</strong> vs previous <ArrowUpRight size={12} className="opacity-0 transition group-hover:opacity-100" aria-hidden="true" /></span></div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2"><span className="w-16 shrink-0 text-[10px] uppercase tracking-[0.1em] text-slate-600">Now</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]"><div className="h-full rounded-full bg-[#8b75ff]/70" style={{ width: `${(row.current / max) * 100}%` }} /></div><span className="w-10 text-right text-xs font-semibold text-slate-200">{row.current}</span></div>
            <div className="flex items-center gap-2"><span className="w-16 shrink-0 text-[10px] uppercase tracking-[0.1em] text-slate-600">Previous</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]"><div className="h-full rounded-full bg-slate-500/50" style={{ width: `${(row.previous / max) * 100}%` }} /></div><span className="w-10 text-right text-xs font-semibold text-slate-400">{row.previous}</span></div>
          </div>
        </a>;
      })}
    </div>
  </section>;
}
