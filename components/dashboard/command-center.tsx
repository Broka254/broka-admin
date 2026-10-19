"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, BadgeCheck, Banknote, CircleAlert, Landmark, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { AdminResourcePayloads } from "@/lib/api/schemas";
import { StatusBadge, UnavailablePanel } from "@/components/ui/primitives";

type Snapshot = AdminResourcePayloads["opsSnapshot"];
type Health = AdminResourcePayloads["serviceHealth"];

type Alert = { id: string; tone: "danger" | "warning"; title: string; detail: string; href: string; cta: string };

export function buildAlerts(snapshot: Snapshot, health?: Health): Alert[] {
  const alerts: Alert[] = [];
  const push = (alert: Alert) => alerts.push(alert);

  if (snapshot.escrow.payout_failed > 0) push({ id: "payout-failed", tone: "danger", title: `${snapshot.escrow.payout_failed} escrow payout failure(s)`, detail: "E-Confirm reported a failed payout. Funds have not reached the seller; reconciliation is required.", href: "/finance-integrity", cta: "Open finance integrity" });
  if (snapshot.escrow.awaiting_manual_refund > 0) push({ id: "refund-waiting", tone: "danger", title: `${snapshot.escrow.awaiting_manual_refund} refund(s) awaiting manual settlement`, detail: "Refund outcome recorded but refunded_at is still empty. No automated transfer is exposed here.", href: "/finance-integrity", cta: "Review refund queue" });
  if (snapshot.ledger.negative_escrow_deals > 0) push({ id: "negative-escrow", tone: "danger", title: `${snapshot.ledger.negative_escrow_deals} deal(s) with negative escrow balance`, detail: "Ledger debits exceed credits for these deals. Investigate the release path before further payouts.", href: "/finance-integrity", cta: "Open ledger checks" });
  if (!snapshot.ledger.balanced && snapshot.ledger.discrepancy_kes > 0) push({ id: "ledger-discrepancy", tone: "danger", title: `Ledger out of balance by KES ${snapshot.ledger.discrepancy_kes.toLocaleString()}`, detail: "Total credits and debits disagree. This is a hard financial control failure.", href: "/finance-integrity", cta: "Open ledger checks" });
  if (snapshot.disputes.cases_active > 0) push({ id: "disputes-active", tone: "warning", title: `${snapshot.disputes.cases_active} active dispute case(s)`, detail: "Non-terminal dispute cases currently in the engine, including escalated cases.", href: "/disputes", cta: "Open disputes" });
  if (snapshot.fraud.events_open > 0) push({ id: "fraud-open", tone: "warning", title: `${snapshot.fraud.events_open} open fraud event(s)`, detail: "Flag events recorded by the engine that no admin has reviewed yet.", href: "/fraud", cta: "Open fraud queue" });
  if (snapshot.payments.zetupay_unfinished > 0) push({ id: "zetupay-unfinished", tone: "warning", title: `${snapshot.payments.zetupay_unfinished} unfinished ZetuPay payment(s)`, detail: "Initiated or processing payments that have not reached a terminal state.", href: "/payments?source=zetupay", cta: "Open payments" });
  if (snapshot.payments.mpesa_pending > 0) push({ id: "mpesa-pending", tone: "warning", title: `${snapshot.payments.mpesa_pending} M-Pesa payment(s) pending`, detail: "STK requests awaiting callback confirmation.", href: "/payments?source=mpesa&status=pending", cta: "Open payments" });
  if (snapshot.escrow.release_pending > 0) push({ id: "release-pending", tone: "warning", title: `${snapshot.escrow.release_pending} escrow release(s) in flight`, detail: "Payout initiated with E-Confirm but not yet completed.", href: "/finance-integrity", cta: "Monitor releases" });
  if (snapshot.media.pending_total > 0) push({ id: "media-backlog", tone: "warning", title: `${snapshot.media.pending_total} media asset(s) awaiting conversion`, detail: "Images or logos pending optimization/backfill.", href: "/diagnostics", cta: "Open diagnostics" });

  if (health) {
    for (const check of health.checks) {
      if (check.status === "error" || check.status === "degraded") {
        push({ id: `health-${check.name}`, tone: "danger", title: `Service check failed: ${check.name}`, detail: check.detail, href: "/service-health", cta: "Open service health" });
      }
    }
  }

  return alerts;
}

function Delta({ current, previous, label }: { current: number; previous: number; label: string }) {
  const delta = current - previous;
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><Icon size={12} className={delta >= 0 ? "text-emerald-300" : "text-amber-300"} aria-hidden="true" />{delta >= 0 ? "+" : ""}{delta} {label} vs previous window</span>;
}

export function CommandCenter({ snapshot, health, snapshotState, healthState }: {
  snapshot?: Snapshot;
  health?: Health;
  snapshotState: "loading" | "error" | "unavailable";
  healthState: "loading" | "error" | "unavailable";
}) {
  if (!snapshot) {
    return <UnavailablePanel title="Operations snapshot" detail={snapshotState === "loading" ? "Loading live queue data from /admin/ops-snapshot…" : "The ops snapshot is unavailable. Queue alerting is disabled until the backend responds."} />;
  }

  const alerts = buildAlerts(snapshot, health);
  const critical = alerts.filter((alert) => alert.tone === "danger");
  const warnings = alerts.filter((alert) => alert.tone === "warning");

  return <div className="space-y-5">
    <section className="data-panel p-5" aria-labelledby="alerts-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p id="alerts-heading" className="font-display text-base font-semibold text-slate-100">Needs attention now</p>
          <p className="mt-1 text-xs text-slate-500">Every item below is derived from live backend counts, not estimates. Window: {snapshot.window_hours}h.</p>
        </div>
        <div className="flex items-center gap-2">
          {critical.length ? <StatusBadge tone="danger">{critical.length} critical</StatusBadge> : <StatusBadge tone="success">No critical queues</StatusBadge>}
          {warnings.length ? <StatusBadge tone="warning">{warnings.length} warning{warnings.length === 1 ? "" : "s"}</StatusBadge> : null}
        </div>
      </div>
      {alerts.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{alerts.map((alert) => <article key={alert.id} className={cn("flex flex-col gap-3 rounded-xl border p-4", alert.tone === "danger" ? "border-rose-400/25 bg-rose-400/[0.05]" : "border-amber-300/20 bg-amber-300/[0.04]")}><div className="flex items-start gap-3"><span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border", alert.tone === "danger" ? "border-rose-300/25 bg-rose-400/10 text-rose-200" : "border-amber-300/25 bg-amber-300/10 text-amber-200")}>{alert.tone === "danger" ? <AlertTriangle size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}</span><div className="min-w-0"><p className="text-sm font-semibold text-slate-100">{alert.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{alert.detail}</p></div></div><Link href={alert.href} className="focus-ring mt-auto inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.025] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-[#8b75ff]/40 hover:text-[#ded8ff]">{alert.cta}<ArrowUpRight size={13} aria-hidden="true" /></Link></article>)}</div> : <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4"><span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-300/25 bg-emerald-400/10 text-emerald-200"><BadgeCheck size={16} aria-hidden="true" /></span><div><p className="text-sm font-semibold text-slate-100">No alert queues are active</p><p className="mt-1 text-xs text-slate-400">Escrow, refunds, disputes, fraud, payments and media backlogs all report zero unresolved items right now.</p></div></div>}
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="data-panel p-5">
        <div className="flex items-center justify-between"><p className="font-display text-sm font-semibold text-slate-100">Money position</p><StatusBadge tone={snapshot.ledger.balanced && snapshot.ledger.negative_escrow_deals === 0 ? "success" : "danger"}>{snapshot.ledger.balanced && snapshot.ledger.negative_escrow_deals === 0 ? "Ledger checks pass" : "Ledger needs review"}</StatusBadge></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-emerald-300"><BadgeCheck size={14} aria-hidden="true" /><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Commission recognised</p></div><p className="mt-2 font-display text-xl font-bold text-slate-100">KES {snapshot.commission.released_total_kes.toLocaleString()}</p><p className="mt-1 text-[11px] text-slate-500">Released deals only · not reconciled bank cash</p></div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-[#54d7e9]"><Landmark size={14} aria-hidden="true" /><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Escrow held</p></div><p className="mt-2 font-display text-xl font-bold text-slate-100">KES {snapshot.ledger.escrow_held_kes.toLocaleString()}</p><p className="mt-1 text-[11px] text-slate-500">Buyer funds held for open deals</p></div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-amber-200"><Wallet size={14} aria-hidden="true" /><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Awaiting manual refund</p></div><p className="mt-2 font-display text-xl font-bold text-slate-100">{snapshot.escrow.awaiting_manual_refund}</p><p className="mt-1 text-[11px] text-slate-500">refund_outcome recorded, not refunded</p></div>
        </div>
      </div>
      <div className="data-panel p-5">
        <p className="font-display text-sm font-semibold text-slate-100">Flow vs previous {snapshot.window_hours}h</p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">New users</p><p className="mt-1 font-display text-lg font-bold text-slate-100">{snapshot.users.new_current}</p></div><Delta current={snapshot.users.new_current} previous={snapshot.users.new_previous} label="users" /></div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">New listings</p><p className="mt-1 font-display text-lg font-bold text-slate-100">{snapshot.listings.created_current}</p></div><Delta current={snapshot.listings.created_current} previous={snapshot.listings.created_previous} label="listings" /></div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Deals released</p><p className="mt-1 font-display text-lg font-bold text-slate-100">{snapshot.deals.released_current}</p></div><Delta current={snapshot.deals.released_current} previous={snapshot.deals.released_previous} label="releases" /></div>
        </div>
      </div>
    </section>

    {healthState === "error" ? <UnavailablePanel compact title="Service health unavailable" detail="The dependency probe endpoint did not respond; alerting above still reflects durable queue counts." /> : null}
    {health ? <section className="data-panel p-5"><div className="flex items-center justify-between"><p className="font-display text-sm font-semibold text-slate-100">Dependency probes</p><div className="flex items-center gap-2"><Banknote size={14} className="text-slate-500" aria-hidden="true" /><Link href="/service-health" className="text-xs font-semibold text-amber-200 hover:text-amber-100">Full health report →</Link></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{health.checks.filter((check) => check.kind === "internal").map((check) => <div key={check.name} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div><p className="text-xs font-semibold text-slate-200">{check.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{check.latency_ms !== null ? `${check.latency_ms} ms` : check.detail}</p></div><StatusBadge tone={check.status === "ok" ? "success" : check.status === "warning" || check.status === "degraded" ? "warning" : check.status === "not_configured" ? "neutral" : "danger"}>{check.status}</StatusBadge></div>)}</div><p className="mt-4 text-[11px] text-slate-600"><ShieldCheck size={12} className="mr-1 inline" aria-hidden="true" />{health.note}</p></section> : null}
  </div>;
}
