"use client";

import { StatusBadge } from "@/components/ui/primitives";
import { formatKES } from "@/lib/format";
import type { RevenueResponse } from "@/lib/api/revenue";

function ShareBar({ share }: { share: number }) {
  const clamped = Math.max(0, Math.min(1, share));
  return (
    <div
      className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10"
      role="img"
      aria-label={`Share ${(clamped * 100).toFixed(1)} percent`}
    >
      <div className="h-full rounded-full bg-[#8b75ff]" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

export function StreamBreakdown({ data }: { data: RevenueResponse }) {
  const incomeTotal = data.income.total_minor;
  const costTotal = data.costs.total_minor;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-[#0c1020] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Income streams
        </p>
        <h3 className="mt-1 font-display text-lg font-bold text-white">Where income comes from</h3>
        {data.income.streams.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No income streams recorded in this range.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 font-semibold">Stream</th>
                <th className="pb-2 text-right font-semibold">Count</th>
                <th className="pb-2 text-right font-semibold">Amount</th>
                <th className="pb-2 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.income.streams.map((stream) => (
                <tr key={stream.key} className="border-t border-white/[0.06]">
                  <td className="py-2.5 pr-2 font-medium text-slate-200">{stream.label}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-300">{stream.count.toLocaleString("en-KE")}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-white">
                    {formatKES(stream.amount_minor, data.currency)}
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="flex items-center justify-end">
                      <ShareBar share={incomeTotal === 0 ? 0 : stream.amount_minor / incomeTotal} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="rounded-xl border border-white/10 bg-[#0c1020] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Cost kinds
        </p>
        <h3 className="mt-1 font-display text-lg font-bold text-white">Where costs go</h3>
        {data.costs.kinds.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No cost kinds recorded in this range.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 font-semibold">Kind</th>
                <th className="pb-2 text-right font-semibold">Count</th>
                <th className="pb-2 text-right font-semibold">Amount</th>
                <th className="pb-2 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.costs.kinds.map((kind) => (
                <tr key={kind.key} className="border-t border-white/[0.06]">
                  <td className="py-2.5 pr-2 font-medium text-slate-200">
                    <span className="flex flex-wrap items-center gap-2">
                      {kind.label}
                      {kind.estimated ? <StatusBadge tone="warning">Estimated</StatusBadge> : null}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-slate-300">{kind.count.toLocaleString("en-KE")}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-white">
                    {formatKES(kind.amount_minor, data.currency)}
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="flex items-center justify-end">
                      <ShareBar share={costTotal === 0 ? 0 : kind.amount_minor / costTotal} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
