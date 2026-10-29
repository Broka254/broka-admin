"use client";

import { Info } from "lucide-react";

import { StatusBadge } from "@/components/ui/primitives";
import { formatKES, formatPct } from "@/lib/format";
import type { RevenueResponse } from "@/lib/api/revenue";

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
      <p className={`mt-2 font-display text-2xl font-bold tracking-tight ${valueClass}`}>{value}</p>
      {sublabel ? <div className="mt-2 text-xs text-slate-400">{sublabel}</div> : null}
    </div>
  );
}

export function RevenueOverview({ data }: { data: RevenueResponse }) {
  const profitable = data.profit_minor >= 0;
  const hasEstimated = data.costs.estimated_minor > 0;
  return (
    <section aria-label="Revenue overview">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Income" value={formatKES(data.income.total_minor, data.currency)} />
        <KpiCard
          label="Costs"
          value={formatKES(data.costs.total_minor, data.currency)}
          sublabel={
            hasEstimated ? (
              <span>
                Includes {formatKES(data.costs.estimated_minor, data.currency)} estimated
              </span>
            ) : (
              <span>All costs verified</span>
            )
          }
        />
        <KpiCard
          label="Profit"
          value={formatKES(data.profit_minor, data.currency)}
          tone={profitable ? "positive" : "negative"}
          sublabel={
            <StatusBadge tone={profitable ? "success" : "danger"}>
              {profitable ? "Profit" : "Loss"}
            </StatusBadge>
          }
        />
        <KpiCard label="Margin" value={formatPct(data.margin_pct)} />
      </div>
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
