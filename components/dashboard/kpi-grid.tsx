"use client";

import { BadgeDollarSign, Flag, Handshake, Layers, ListChecks, Users } from "lucide-react";

import { MetricCard } from "@/components/intelligence/visuals";
import type { AdminResourcePayloads } from "@/lib/api/schemas";
import { formatKesAmount } from "@/lib/format";

export type KpiState = "loading" | "ready" | "error" | "schema-unavailable";
type Summary = AdminResourcePayloads["summary"];

type Spec = {
  label: string;
  hint: string;
  icon: typeof Users;
  href: string;
  accent: string;
  value?: (summary: Summary) => string | undefined;
  caption?: string;
};

// `undefined` means the count exists only on upgraded backends: the card shows
// "—" plus an upgrade note instead of a guessed number.
const metrics: Spec[] = [
  { label: "Total users", hint: "Every user row, including sellers and administrators.", icon: Users, href: "/users", accent: "text-[#a895ff]", value: (s) => s.users.toLocaleString("en-KE") },
  { label: "Listings", hint: "All listing rows regardless of status.", icon: Layers, href: "/listings", accent: "text-slate-300", value: (s) => s.listings.toLocaleString("en-KE") },
  { label: "Active listings", hint: "status = active", icon: ListChecks, href: "/listings?status=active", accent: "text-[#54d7e9]", value: (s) => s.listings_active?.toLocaleString("en-KE"), caption: "Current live supply" },
  { label: "Deals", hint: "Every deal row across the lifecycle.", icon: Handshake, href: "/deals", accent: "text-slate-300", value: (s) => s.deals.toLocaleString("en-KE") },
  { label: "Deals released", hint: "status = released. Released deals only; not bank cash.", icon: Handshake, href: "/deals?status=released", accent: "text-[#dbb75d]", value: (s) => s.deals_released?.toLocaleString("en-KE"), caption: "Completed release events" },
  { label: "Commission recognised", hint: "Recognised from released deals only. This is not reconciled bank cash.", icon: BadgeDollarSign, href: "/finance-integrity", accent: "text-emerald-300", value: (s) => formatKesAmount(s.commission_earned_kes), caption: "Not reconciled bank cash" },
  { label: "Open disputes", hint: "Active dispute cases in the dispute engine.", icon: ListChecks, href: "/disputes", accent: "text-amber-200", value: (s) => (s.dispute_cases_active ?? s.disputes)?.toLocaleString("en-KE"), caption: "Dispute-engine cases" },
  { label: "Flagged users", hint: "Accounts currently carrying a trust flag.", icon: Flag, href: "/fraud", accent: "text-rose-300", value: (s) => s.flagged_users.toLocaleString("en-KE") },
];

const stateText: Record<KpiState, string> = {
  loading: "Loading verified summary",
  ready: "Live backend data",
  error: "Unable to load summary",
  "schema-unavailable": "Response contract unavailable",
};

export function KpiGrid({ state, summary }: { state: KpiState; summary?: Summary }) {
  return (
    <section aria-labelledby="kpi-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a895ff]">Verified totals</p>
          <h2 id="kpi-heading" className="mt-1 font-display text-lg font-bold tracking-[-0.03em] text-slate-100">Platform signal</h2>
          <p className="mt-1 text-xs text-slate-500">Documented fields from the BROKA admin summary. No number is inferred from page length.</p>
        </div>
        <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/70">Source-derived only</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const value = summary && metric.value ? metric.value(summary) : undefined;
          return (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={value ?? "—"}
              caption={value === undefined ? (summary ? "Backend upgrade required for this count" : stateText[state]) : metric.caption ?? metric.hint}
              icon={<Icon size={14} />}
              href={metric.href}
              accent={metric.accent}
            />
          );
        })}
      </div>
    </section>
  );
}
