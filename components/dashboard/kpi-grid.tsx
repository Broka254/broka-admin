import { BadgeDollarSign, Flag, Handshake, ListChecks, Scale, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AdminResourcePayloads } from "@/lib/api/schemas";

type KpiState = "loading" | "error" | "schema-unavailable";

type Summary = AdminResourcePayloads["summary"];
const metrics: Array<{ label: string; icon: typeof Users; href: string; value: (summary: Summary) => string }> = [
  { label: "Total Users", icon: Users, href: "/users", value: (s) => s.users.toLocaleString() },
  { label: "Listings total", icon: ListChecks, href: "/listings", value: (s) => s.listings.toLocaleString() },
  { label: "Deals total", icon: Handshake, href: "/deals", value: (s) => s.deals.toLocaleString() },
  { label: "Commission Revenue", icon: BadgeDollarSign, href: "/commissions", value: (s) => `KES ${s.commission_earned_kes.toLocaleString()}` },
  { label: "Disputes total", icon: Scale, href: "/disputes", value: (s) => s.disputes.toLocaleString() },
  { label: "Flagged Users", icon: Flag, href: "/fraud", value: (s) => s.flagged_users.toLocaleString() },
];

const stateText: Record<KpiState, string> = { loading: "Loading backend summary", error: "Unable to load summary", "schema-unavailable": "Response contract unavailable" };

export function KpiGrid({ state, summary }: { state: KpiState; summary?: Summary }) {
  return <section aria-labelledby="kpi-heading"><div className="mb-3 flex items-end justify-between"><div><p id="kpi-heading" className="text-sm font-semibold text-slate-100">Platform signal</p><p className="mt-1 text-xs text-slate-500">Measured state from the BROKA backend</p></div><span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">No inferred values</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric, index) => { const Icon = metric.icon; return <a key={metric.label} href={metric.href} className={cn("metric-card group", index > 3 ? "hidden sm:block" : "")}><div className="flex items-start justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p><span className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.035] text-slate-500 transition group-hover:border-amber-300/20 group-hover:text-amber-200"><Icon size={15} aria-hidden="true" /></span></div><div className="mt-5 flex items-end justify-between gap-3"><p className="text-2xl font-semibold tracking-[-0.04em] text-slate-300">{summary ? metric.value(summary) : "—"}</p><span className="pb-1 text-[10px] text-slate-600">View section →</span></div><p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] text-slate-500">{summary ? "Verified FastAPI admin summary" : stateText[state]}</p></a>; })}</div></section>;
}
