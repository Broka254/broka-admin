"use client";

import { AlertTriangle, ArrowUpRight, Banknote, Receipt, Scale } from "lucide-react";
import Link from "next/link";

import { Panel } from "@/components/intelligence/visuals";
import { InfoTip } from "@/components/ui/tooltip";
import type { Pulse } from "@/lib/api/intelligence-schemas";
import { formatKES } from "@/lib/format";
import { formatPctValue } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

function MoneyCell({ label, value, detail, tone = "text-white", hint }: { label: string; value: string; detail?: string; tone?: string; hint?: string }) {
  return (
    <div className="inset-panel p-3.5">
      <div className="flex items-center gap-1.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        {hint ? <InfoTip label={`${label} definition`}>{hint}</InfoTip> : null}
      </div>
      <p className={cn("mt-2 font-display text-lg font-bold tracking-[-0.03em] tabular-nums", tone)}>{value}</p>
      {detail ? <p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p> : null}
    </div>
  );
}

/**
 * Platform economics from the pulse contract. GMV is never used here and
 * external escrow is never described as BROKA cash. Estimated and recorded
 * cost components stay visibly separate.
 */
export function FinancialIntelligence({ pulse }: { pulse: Pulse }) {
  const current = pulse.revenue.current;
  const previous = pulse.revenue.previous;
  const margin = current.income_minor > 0 ? (current.profit_minor / current.income_minor) * 100 : null;
  const previousMargin = previous.income_minor > 0 ? (previous.profit_minor / previous.income_minor) * 100 : null;
  const estimated = Math.max(0, Math.min(current.costs_minor, current.estimated_costs_minor));
  const recorded = Math.max(0, current.costs_minor - estimated);
  const estimatedShare = current.costs_minor > 0 ? (estimated / current.costs_minor) * 100 : 0;
  const streams = [...current.streams].sort((a, b) => b.amount_minor - a.amount_minor);
  const top = streams.slice(0, 3);
  const previousProfit = previous.profit_minor;
  const profitDelta = current.profit_minor - previousProfit;

  return (
    <Panel
      eyebrow="Financial intelligence"
      title="Platform economics"
      description="Income, recorded platform costs and reported contribution. Platform income is not marketplace GMV, and external escrow is not BROKA cash."
      actions={<Link href="/revenue" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">Open revenue <ArrowUpRight size={12} aria-hidden="true" /></Link>}
    >
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MoneyCell label="Platform income" value={formatKES(current.income_minor)} detail={`previous ${formatKES(previous.income_minor)}`} hint="Recognised platform income from the revenue endpoint. This excludes buyer/seller escrow principal and is not GMV." />
        <MoneyCell label="Platform costs" value={formatKES(current.costs_minor)} detail={`${formatKES(estimated)} estimated`} tone="text-amber-100" hint="Recorded platform cost ledger. Estimated rows are included and split out below." />
        <MoneyCell label="Reported profit" value={formatKES(current.profit_minor)} tone={current.profit_minor >= 0 ? "text-emerald-300" : "text-rose-300"} detail={`${profitDelta >= 0 ? "+" : ""}${formatKES(profitDelta)} vs previous`} hint="Income less costs recorded or derived by the backend. An operating indicator, not an audited net-profit statement." />
        <MoneyCell label="Reported margin" value={margin === null ? "—" : formatPctValue(margin)} detail={previousMargin === null ? "no previous income" : `previous ${formatPctValue(previousMargin)}`} hint="Reported profit divided by platform income." />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="inset-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Cost confidence</p>
            <span className="text-[10px] tabular-nums text-slate-500">{formatPctValue(estimatedShare)} estimated</span>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label={`${formatKES(recorded)} not flagged estimated and ${formatKES(estimated)} estimated costs`}>
            <div className="h-full bg-cyan-300/80" style={{ width: `${100 - estimatedShare}%` }} />
            <div className="h-full bg-amber-300/90" style={{ width: `${estimatedShare}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-300/80" />Recorded, not flagged estimated: {formatKES(recorded)}</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-300/90" />Estimated: {formatKES(estimated)}</span>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-600">Estimated rows are included in reported profit. A zero-value estimated row can mean usage without a verified rate.</p>
          {estimated > 0 ? <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1 text-[10px] text-amber-100"><AlertTriangle size={11} aria-hidden="true" />Contains estimated expenses</p> : null}
        </div>
        <div className="inset-panel p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Income streams</p>
          {top.length ? (
            <ul className="mt-2.5 space-y-2">
              {top.map((stream) => (
                <li key={stream.key}>
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="truncate text-slate-300">{stream.label}</span>
                    <span className="font-semibold tabular-nums text-white">{formatKES(stream.amount_minor)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#8b75ff] to-[#54d7e9]" style={{ width: `${current.income_minor > 0 ? Math.min(100, (stream.amount_minor / current.income_minor) * 100) : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-[11px] text-slate-500">No income stream was recognised in this window.</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
        <Link href="/revenue" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/30 bg-[#8b75ff]/10 px-3 py-1.5 text-[11px] font-semibold text-[#ded8ff] hover:bg-[#8b75ff]/20"><Banknote size={12} aria-hidden="true" />Revenue</Link>
        <Link href="/production-costs" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"><Receipt size={12} aria-hidden="true" />Production costs</Link>
        <Link href="/finance-integrity" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"><Scale size={12} aria-hidden="true" />Finance integrity</Link>
        <span className="ml-auto text-[10px] text-slate-600">Trailing 30-day context: {formatKES(pulse.revenue.trailing_30d.income_minor)} income</span>
      </div>
    </Panel>
  );
}
