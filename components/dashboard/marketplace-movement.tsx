"use client";

import { ArrowDownRight, ArrowUpRight, Coins, Layers, UserPlus } from "lucide-react";
import Link from "next/link";

import { AbsoluteDelta, ComparisonBars, DeltaChip, Panel } from "@/components/intelligence/visuals";
import type { AdminResourcePayloads } from "@/lib/api/schemas";
import { formatKesAmount } from "@/lib/format";
import { formatCount } from "@/lib/intelligence";

type Snapshot = AdminResourcePayloads["opsSnapshot"];

function MovementCard({ label, href, current, previous, icon, tone }: {
  label: string;
  href: string;
  current: number;
  previous: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <article className="inset-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <span className={`grid h-7 w-7 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.035] ${tone}`} aria-hidden="true">{icon}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-white tabular-nums">{formatCount(current)}</p>
      <div className="mt-3"><ComparisonBars current={current} previous={previous} format={(value) => formatCount(value)} label={label} /></div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <AbsoluteDelta current={current} previous={previous} format={(value) => formatCount(Math.abs(value))} />
        <Link href={href} className="focus-ring text-[10px] font-semibold text-slate-500 hover:text-[#a895ff]">Inspect →</Link>
      </div>
    </article>
  );
}

/**
 * Window-over-window movement the ops snapshot actually supplies. There is no
 * historical series here, so no sparkline or invented intermediate point.
 */
export function MarketplaceMovement({ snapshot, state }: { snapshot?: Snapshot; state: "loading" | "ready" | "error" | "not-deployed" | "unavailable" }) {
  return (
    <Panel
      eyebrow="Marketplace movement"
      title={`Verified flow · this ${snapshot?.window_hours ?? 24}h vs previous`}
      description="Three window-over-window movements the ops snapshot supplies directly. A single comparison is not a trend line, so none is drawn."
      actions={<Link href="/analytics/marketplace" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">Marketplace analytics <ArrowUpRight size={12} aria-hidden="true" /></Link>}
    >
      {!snapshot ? (
        <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
          {state === "loading" ? "Loading the ops window…" : state === "not-deployed" ? "Movement needs /admin/ops-snapshot, which this backend does not expose yet (HTTP 404)." : "The ops window is unavailable, so movement is not estimated."}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <MovementCard label="New users" href="/users" current={snapshot.users.new_current} previous={snapshot.users.new_previous} icon={<UserPlus size={14} aria-hidden="true" />} tone="text-[#a895ff]" />
          <MovementCard label="Listings created" href="/listings" current={snapshot.listings.created_current} previous={snapshot.listings.created_previous} icon={<Layers size={14} aria-hidden="true" />} tone="text-[#54d7e9]" />
          <MovementCard label="Deals released" href="/deals?status=released" current={snapshot.deals.released_current} previous={snapshot.deals.released_previous} icon={<ArrowUpRight size={14} aria-hidden="true" />} tone="text-emerald-300" />
        </div>
      )}
      {snapshot ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><Coins size={12} className="text-[#dbb75d]" aria-hidden="true" />Commission recognised this window: <strong className="font-semibold tabular-nums text-slate-200">{formatKesAmount(snapshot.commission.released_current_kes)}</strong></span>
          <span className="inline-flex items-center gap-1"><DeltaChip change={snapshot.commission.released_previous_kes > 0 ? ((snapshot.commission.released_current_kes - snapshot.commission.released_previous_kes) / snapshot.commission.released_previous_kes) * 100 : null} /> vs previous window</span>
          <span className="ml-auto inline-flex items-center gap-1 text-slate-600">{snapshot.commission.released_previous_kes >= 0 ? <ArrowDownRight size={11} aria-hidden="true" /> : null}Released deals only · not bank cash</span>
        </div>
      ) : null}
    </Panel>
  );
}
