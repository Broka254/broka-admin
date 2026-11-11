"use client";

import { AlertTriangle, ArrowUpRight, BadgeCheck, Landmark, RefreshCw, Scale, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

import { StatusBadge } from "@/components/ui/primitives";
import { InfoTip } from "@/components/ui/tooltip";
import type { AdminResourcePayloads } from "@/lib/api/schemas";
import { formatDateTime, formatKesAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

type FinanceIntegrity = AdminResourcePayloads["financeIntegrity"];

function ControlCard({ title, description, failed, count, children, href }: {
  title: string;
  description: string;
  failed: boolean;
  count?: number;
  children?: React.ReactNode;
  href?: string;
}) {
  return (
    <section className={cn("rounded-xl border p-4", failed ? "border-rose-400/25 bg-rose-400/[0.045]" : "border-emerald-400/15 bg-emerald-400/[0.025]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border", failed ? "border-rose-300/25 bg-rose-400/10 text-rose-200" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-200")}>
            {failed ? <ShieldAlert size={15} aria-hidden="true" /> : <BadgeCheck size={15} aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">{title}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">{description}</p>
          </div>
        </div>
        <StatusBadge tone={failed ? "danger" : "success"}>{failed ? `${count ?? 0} failing` : "Pass"}</StatusBadge>
      </div>
      {children ? <div className="mt-3 border-t border-white/[0.06] pt-3">{children}</div> : null}
      {href ? <Link href={href} className="focus-ring mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#a895ff] hover:text-[#ded8ff]">Inspect records <ArrowUpRight size={10} aria-hidden="true" /></Link> : null}
    </section>
  );
}

function RecordRow({ dealId, meta, href }: { dealId: string; meta: string; href: string }) {
  const short = dealId.slice(0, 8);
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.055] bg-black/20 px-2.5 py-2 text-[11px]">
      <Link href={href} className="focus-ring font-mono font-semibold text-slate-200 hover:text-[#ded8ff]">deal {short}…</Link>
      <span className="text-right tabular-nums text-slate-500">{meta}</span>
    </li>
  );
}

/**
 * Financial controls first, monetary context second. A failed control names
 * exactly what failed and links to the records that failed it; no decorative
 * chart is allowed to soften a reconciliation break.
 */
export function FinanceIntegrityView({ data }: { data: FinanceIntegrity }) {
  const queryClient = useQueryClient();
  const controls = [
    {
      key: "ledger",
      title: "Ledger credits equal debits",
      description: "A released deal must produce a ledger escrow debit and a BROKA revenue credit. A discrepancy here is a hard control failure.",
      failed: !data.ledger.balanced || data.ledger.discrepancy_kes > 0,
      count: data.ledger.discrepancy_kes > 0 ? 1 : 0,
      detail: data.ledger.balanced ? `Ledger balances exactly. Escrow integrity ${data.ledger.escrow_integrity_ok ? "passes" : "fails"}.` : `Credits and debits differ by ${formatKesAmount(data.ledger.discrepancy_kes)}.`,
    },
    {
      key: "release-entries",
      title: "Released deals have release entries",
      description: "Every released deal must have the escrow debit that moves the buyer's funds to the seller. Missing rows are listed below.",
      failed: data.released_deals_without_release_entries.count > 0,
      count: data.released_deals_without_release_entries.count,
      detail: `${data.released_deals_without_release_entries.count} released deal(s) have no release entry.`,
    },
    {
      key: "revenue-credit",
      title: "Released deals have revenue credits",
      description: "Recognised commission on a released deal must appear as a BROKA_REVENUE ledger credit.",
      failed: data.released_deals_without_revenue_credit.count > 0,
      count: data.released_deals_without_revenue_credit.count,
      detail: `${data.released_deals_without_revenue_credit.count} released deal(s) have no revenue credit.`,
    },
    {
      key: "refunds",
      title: "Refunds recorded are refunds returned",
      description: "A refund outcome is not proof that money left escrow. Rows with refund_outcome set but refunded_at empty require manual settlement.",
      failed: data.awaiting_manual_refund.count > 0,
      count: data.awaiting_manual_refund.count,
      detail: `${data.awaiting_manual_refund.count} refund(s) awaiting manual settlement.`,
    },
  ];
  const failed = controls.filter((control) => control.failed);

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a895ff]">Reconciliation controls</p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-[-0.03em] text-white">{failed.length ? `${failed.length} control${failed.length === 1 ? "" : "s"} need attention` : "All financial controls pass"}</h2>
          <p className="mt-1 text-xs text-slate-400">Generated {data.generated_at ? formatDateTime(data.generated_at) : "—"}. Correctness takes priority over presentation: a failed control is never hidden behind an average.</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={failed.length ? "danger" : "success"}>{failed.length ? "Action required" : "Controls clear"}</StatusBadge>
          <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["broka-admin", "financeIntegrity"] })} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"><RefreshCw size={11} aria-hidden="true" />Refresh</button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {controls.map((control) => (
          <ControlCard key={control.key} title={control.title} description={control.description} failed={control.failed} count={control.count} href={control.key === "refunds" ? "/deals?status=refunded" : "/deals?status=released"}>
            <p className={cn("text-[11px]", control.failed ? "text-rose-200" : "text-emerald-200/90")}>{control.detail}</p>
            {control.key === "ledger" && data.ledger.negative_escrow_deals.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {data.ledger.negative_escrow_deals.slice(0, 4).map((item) => <RecordRow key={item.deal_id} dealId={item.deal_id} meta={`${formatKesAmount(item.escrow_balance_kes)} escrow`} href={`/deals/${encodeURIComponent(item.deal_id)}`} />)}
              </ul>
            ) : null}
            {control.key === "release-entries" && data.released_deals_without_release_entries.sample.length ? (
              <ul className="mt-2 space-y-1">
                {data.released_deals_without_release_entries.sample.map((item) => <RecordRow key={item.deal_id} dealId={item.deal_id} meta={`${formatKesAmount(item.commission)} · ${item.released_at ? formatDateTime(item.released_at) : "no release time"}`} href={`/deals/${encodeURIComponent(item.deal_id)}`} />)}
              </ul>
            ) : null}
            {control.key === "revenue-credit" && data.released_deals_without_revenue_credit.sample.length ? (
              <ul className="mt-2 space-y-1">
                {data.released_deals_without_revenue_credit.sample.map((item) => <RecordRow key={item.deal_id} dealId={item.deal_id} meta={`${formatKesAmount(item.commission)} · ${item.released_at ? formatDateTime(item.released_at) : "no release time"}`} href={`/deals/${encodeURIComponent(item.deal_id)}`} />)}
              </ul>
            ) : null}
            {control.key === "refunds" && data.awaiting_manual_refund.sample.length ? (
              <ul className="mt-2 space-y-1">
                {data.awaiting_manual_refund.sample.map((item) => <RecordRow key={item.deal_id} dealId={item.deal_id} meta={`${formatKesAmount(item.agreed_price_kes)} · ${item.refund_outcome ?? "no outcome"}`} href={`/deals/${encodeURIComponent(item.deal_id)}`} />)}
              </ul>
            ) : null}
          </ControlCard>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="inset-panel p-3.5"><div className="flex items-center gap-1.5"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Commission recognised</p><InfoTip label="Commission definition">Recognised from released deals. Not necessarily posted to the ledger yet; compare with revenue credits.</InfoTip></div><p className="mt-2 font-display text-lg font-bold tabular-nums text-white">{formatKesAmount(data.commission.released_deals_kes)}</p><p className="mt-1 text-[10px] text-slate-500">Deal.status = released</p></div>
        <div className="inset-panel p-3.5"><div className="flex items-center gap-1.5"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Ledger revenue credits</p><InfoTip label="Revenue credits">BROKA_REVENUE credits actually posted to the ledger.</InfoTip></div><p className="mt-2 font-display text-lg font-bold tabular-nums text-white">{formatKesAmount(data.commission.ledger_revenue_credits_kes)}</p><p className={cn("mt-1 text-[10px]", data.commission.gap_kes !== 0 ? "text-rose-300" : "text-emerald-300")}>Gap {formatKesAmount(data.commission.gap_kes)}</p></div>
        <div className="inset-panel p-3.5"><div className="flex items-center gap-1.5"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Escrow held externally</p><InfoTip label="Escrow definition">Buyer funds held in external escrow. This is not BROKA cash and must never be reported as platform revenue.</InfoTip></div><p className="mt-2 font-display text-lg font-bold tabular-nums text-white">{formatKesAmount(data.escrow_held_kes)}</p><p className="mt-1 text-[10px] text-slate-500">Not BROKA cash</p></div>
        <div className="inset-panel p-3.5"><div className="flex items-center gap-1.5"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Refund payable</p><InfoTip label="Refund payable">Recorded refunds not yet returned to the buyer.</InfoTip></div><p className="mt-2 font-display text-lg font-bold tabular-nums text-amber-100">{formatKesAmount(data.refund_payable_kes)}</p><p className="mt-1 text-[10px] text-slate-500">Recorded, not necessarily returned</p></div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="inset-panel p-4">
          <div className="flex items-center gap-2"><Landmark size={14} className="text-cyan-200" aria-hidden="true" /><p className="text-xs font-semibold text-slate-200">Payment provider state</p></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            {Object.entries(data.payments).map(([provider, counts]) => (
              <div key={provider} className="rounded-lg border border-white/[0.055] bg-black/20 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{provider}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{Object.entries(counts).map(([status, count]) => <span key={status} className="text-slate-400">{status}: <strong className="font-semibold tabular-nums text-slate-200">{count}</strong></span>)}{!Object.keys(counts).length ? <span className="text-slate-600">No rows</span> : null}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="inset-panel p-4">
          <div className="flex items-center gap-2"><Scale size={14} className="text-[#dbb75d]" aria-hidden="true" /><p className="text-xs font-semibold text-slate-200">E-Confirm escrow status</p></div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">{Object.entries(data.econfirm.by_status).map(([status, count]) => <span key={status} className="rounded-full border border-white/[0.07] px-2.5 py-1 text-slate-300">{status} <strong className="font-semibold tabular-nums text-white">{count}</strong></span>)}{!Object.keys(data.econfirm.by_status).length ? <span className="text-slate-600">No escrow rows</span> : null}</div>
          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-600"><AlertTriangle size={10} aria-hidden="true" />Escrow balances are external; no transfer is initiated from this dashboard.</p>
        </section>
      </div>

      <details className="inset-panel p-4">
        <summary className="focus-ring cursor-pointer text-xs font-semibold text-slate-300">Control definitions</summary>
        <dl className="mt-3 grid gap-2 lg:grid-cols-2">{Object.entries(data.definitions).map(([key, definition]) => <div key={key}><dt className="font-mono text-[10px] text-[#a895ff]">{key}</dt><dd className="mt-0.5 text-[11px] leading-5 text-slate-500">{definition}</dd></div>)}</dl>
      </details>
    </div>
  );
}
