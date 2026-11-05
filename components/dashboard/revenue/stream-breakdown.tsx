"use client";

import { StatusBadge } from "@/components/ui/primitives";
import { formatKES, formatPct } from "@/lib/format";
import type { RevenueResponse } from "@/lib/api/revenue";

function ShareBar({ share }: { share: number }) {
  const clamped = Math.max(0, Math.min(1, share));
  return (
    <div
      className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10"
      role="img"
      aria-label={"Share " + (clamped * 100).toFixed(1) + " percent"}
    >
      <div className="h-full rounded-full bg-[#8b75ff]" style={{ width: (clamped * 100) + "%" }} />
    </div>
  );
}

function ShareCell({ amount, total }: { amount: number; total: number }) {
  const share = total > 0 ? amount / total : 0;
  return (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
      <ShareBar share={share} />
      <span className="w-12 text-right text-xs tabular-nums text-slate-400">{formatPct(share * 100)}</span>
    </div>
  );
}

function averagePerRow(amount: number, count: number): number | null {
  return count > 0 ? Math.round(amount / count) : null;
}

export function StreamBreakdown({ data }: { data: RevenueResponse }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-xl border border-white/10 bg-[#0c1020] p-4" aria-labelledby="income-stream-heading">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Income streams</p>
        <h3 id="income-stream-heading" className="mt-1 font-display text-lg font-bold text-white">Where platform income comes from</h3>
        {data.income.streams.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No income streams recorded in this range.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 font-semibold">Stream</th>
                  <th className="pb-2 text-right font-semibold">Events</th>
                  <th className="pb-2 text-right font-semibold">Avg / event</th>
                  <th className="pb-2 text-right font-semibold">Amount</th>
                  <th className="pb-2 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.income.streams.map((stream) => (
                  <tr key={stream.key} className="border-t border-white/[0.06]">
                    <td className="py-3 pr-3 font-medium text-slate-200">{stream.label}</td>
                    <td className="py-3 text-right tabular-nums text-slate-300">{stream.count.toLocaleString("en-KE")}</td>
                    <td className="py-3 text-right tabular-nums text-slate-400">
                      {averagePerRow(stream.amount_minor, stream.count) === null ? "—" : formatKES(averagePerRow(stream.amount_minor, stream.count) as number, data.currency)}
                    </td>
                    <td className="py-3 text-right font-semibold tabular-nums text-white">{formatKES(stream.amount_minor, data.currency)}</td>
                    <td className="py-3 pl-3"><ShareCell amount={stream.amount_minor} total={data.income.total_minor} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-[#0c1020] p-4" aria-labelledby="cost-kind-heading">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Cost kinds</p>
        <h3 id="cost-kind-heading" className="mt-1 font-display text-lg font-bold text-white">Where platform costs go</h3>
        {data.costs.kinds.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No cost kinds recorded in this range.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[580px] text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 font-semibold">Cost type</th>
                  <th className="pb-2 text-right font-semibold">Rows</th>
                  <th className="pb-2 text-right font-semibold">Avg / row</th>
                  <th className="pb-2 text-right font-semibold">Amount</th>
                  <th className="pb-2 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.costs.kinds.map((kind) => {
                  const average = averagePerRow(kind.amount_minor, kind.count);
                  return (
                    <tr key={kind.key} className="border-t border-white/[0.06]">
                      <td className="py-3 pr-3 font-medium text-slate-200">
                        <span className="flex flex-wrap items-center gap-2">
                          {kind.label}
                          {kind.estimated ? <StatusBadge tone="warning">Contains estimates</StatusBadge> : null}
                        </span>
                      </td>
                      <td className="py-3 text-right tabular-nums text-slate-300">{kind.count.toLocaleString("en-KE")}</td>
                      <td className="py-3 text-right tabular-nums text-slate-400">{average === null ? "—" : formatKES(average, data.currency)}</td>
                      <td className="py-3 text-right font-semibold tabular-nums text-white">{formatKES(kind.amount_minor, data.currency)}</td>
                      <td className="py-3 pl-3"><ShareCell amount={kind.amount_minor} total={data.costs.total_minor} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
