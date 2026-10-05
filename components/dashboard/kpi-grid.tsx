import { BadgeDollarSign, Flag, Handshake, ListChecks, Scale, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AdminResourcePayloads } from "@/lib/api/schemas";

 type KpiState = "loading" | "error" | "schema-unavailable";
type Summary = AdminResourcePayloads["summary"];
const metrics: Array<{ label: string; icon: typeof Users; href: string; accent: string; value: (summary: Summary) => string }> = [
  { label: "Total users", icon: Users, href: "/users", accent: "text-[#a895ff]", value: (s) => s.users.toLocaleString() },
  { label: "Active listings", icon: ListChecks, href: "/listings", accent: "text-[#54d7e9]", value: (s) => s.listings.toLocaleString() },
  { label: "Deals recorded", icon: Handshake, href: "/deals", accent: "text-[#dbb75d]", value: (s) => s.deals.toLocaleString() },
  { label: "Commission earned", icon: BadgeDollarSign, href: "/commissions", accent: "text-emerald-300", value: (s) => `KES ${s.commission_earned_kes.toLocaleString()}` },
  { label: "Disputes", icon: Scale, href: "/disputes", accent: "text-amber-200", value: (s) => s.disputes.toLocaleString() },
  { label: "Flagged users", icon: Flag, href: "/fraud", accent: "text-rose-300", value: (s) => s.flagged_users.toLocaleString() },
];

const stateText: Record<KpiState, string> = { loading: "Loading verified summary", error: "Unable to load summary", "schema-unavailable": "Response contract unavailable" };

export function KpiGrid({ state, summary }: { state: KpiState; summary?: Summary }) {
  return <section aria-labelledby="kpi-heading"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><p id="kpi-heading" className="font-display text-base font-semibold text-slate-100">Platform signal</p><p className="mt-1 text-xs text-slate-500">Verified operational totals from the Broka API</p></div><span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/70">Source-derived only</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{metrics.map((metric) => { const Icon = metric.icon; return <a key={metric.label} href={metric.href} className="metric-card group focus-ring"><div className="flex items-start justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p><span className={cn("grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.035] transition group-hover:border-[#8b75ff]/40", metric.accent)}><Icon size={15} aria-hidden="true" /></span></div><div className="mt-5 flex items-end justify-between gap-3"><p className={cn("font-display text-2xl font-bold tracking-[-0.04em]", summary ? "text-slate-100" : "text-slate-500")}>{summary ? metric.value(summary) : "—"}</p><span className="pb-1 text-[10px] text-slate-600 transition group-hover:text-[#a895ff]">Open →</span></div><p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] text-slate-500">{summary ? "Validated admin summary" : stateText[state]}</p></a>; })}</div></section>;
}
