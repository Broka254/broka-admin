"use client";

import { useState } from "react";
import { ArrowUpRight, CheckCircle2, ExternalLink, ShieldQuestion } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AdminResourcePayloads } from "@/lib/api/schemas";
import type { ApiResource } from "@/types/broka";
import { StatusBadge } from "@/components/ui/primitives";

const value = (item: unknown) => item === null || item === undefined || item === "" ? "—" : String(item);
const date = (item: string | null) => item ? new Date(item).toLocaleString("en-KE") : "—";
const shortId = (id: string | null | undefined) => id ? id.slice(0, 8) : "—";
const kes = (amount: number | null | undefined) => amount === null || amount === undefined ? "—" : `KES ${amount.toLocaleString()}`;
function Metric({ label, value: item, hint }: { label: string; value: unknown; hint?: string }) { return <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">{label}</p><p className="mt-2 text-lg font-semibold text-slate-200">{value(item)}</p>{hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}</div>; }
function Row({ children, columns }: { children: React.ReactNode; columns: string }) { return <div className={cn("grid gap-3 px-4 py-4", columns)}>{children}</div>; }
function UserLink({ id }: { id: string | null | undefined }) { return id ? <a href={`/users/${encodeURIComponent(id)}`} className="text-sm font-semibold text-slate-100 hover:text-amber-200">{shortId(id)}</a> : <span className="text-sm text-slate-500">—</span>; }
function DealLink({ id }: { id: string | null | undefined }) { return id ? <a href={`/deals/${encodeURIComponent(id)}`} className="text-sm font-semibold text-slate-100 hover:text-amber-200">{shortId(id)}</a> : <span className="text-sm text-slate-500">—</span>; }
function StatusPill({ status }: { status: string | null | undefined }) { if (!status) return <span className="text-sm text-slate-500">—</span>; const tone = ["released", "success", "completed", "active", "ok"].includes(status) ? "success" : ["failed", "payout_failed", "error"].includes(status) ? "danger" : ["pending", "processing", "initiated", "disputed", "escalated", "release_pending", "warning"].includes(status) ? "warning" : "neutral"; return <StatusBadge tone={tone}>{status.replaceAll("_", " ")}</StatusBadge>; }

function ResolveFraudEvent({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  async function submit() {
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch(`/api/broka/fraud-events/${encodeURIComponent(eventId)}/resolve`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(note.trim() ? { reason: note.trim() } : {}),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; changed?: boolean };
      if (!response.ok) throw new Error(payload.message ?? "The BROKA API could not resolve this event.");
      setStatus("done");
      setMessage(payload.changed === false ? "Already resolved." : "Resolved and audited.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The BROKA API could not resolve this event.");
    }
  }
  if (status === "done") return <p className="mt-2 text-xs text-emerald-200">{message}</p>;
  return <div className="mt-3">
    {open ? <div className="space-y-2">
      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} placeholder="Optional review note (3-500 characters)" className="w-full rounded-lg border border-white/[0.08] bg-black/20 p-3 text-xs text-slate-200 placeholder:text-slate-600" />
      <div className="flex gap-2">
        <button onClick={submit} disabled={status === "sending" || (note.trim().length > 0 && note.trim().length < 3)} className="focus-ring rounded-lg bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/25 disabled:opacity-50">{status === "sending" ? "Resolving…" : "Resolve event"}</button>
        <button onClick={() => setOpen(false)} className="focus-ring rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:text-slate-200">Cancel</button>
      </div>
      {status === "error" ? <p className="text-xs text-rose-200">{message}</p> : null}
    </div> : <button onClick={() => setOpen(true)} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20"><CheckCircle2 size={13} aria-hidden="true" />Resolve</button>}
  </div>;
}

export function ValidatedResourceView({ resource, data }: { resource: ApiResource; data: unknown }) {
  if (resource === "fraudEvents") {
    const rows = data as AdminResourcePayloads["fraudEvents"];
    return <div className="divide-y divide-white/[0.06]">{rows.map((row) => <div key={row.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_1.5fr_100px_120px_170px_minmax(140px,auto)]"><div><UserLink id={row.user_id} /><p className="text-xs text-slate-500">{shortId(row.id)}</p></div><p className="text-sm text-slate-300">{row.reason}</p><p className="text-sm text-slate-300">{value(row.trust_score_at_flag)}</p><p className="text-sm text-slate-300">{row.triggered_by ? shortId(row.triggered_by) : "—"}</p><div><p className="text-xs text-slate-500">{date(row.created_at)}</p><StatusBadge tone={row.resolved ? "success" : "warning"} className="mt-1">{row.resolved ? "Resolved" : "Open"}</StatusBadge></div><div>{row.resolved ? null : <ResolveFraudEvent eventId={row.id} />}</div></div>)}</div>;
  }
  if (resource === "transactions") {
    const rows = data as AdminResourcePayloads["transactions"];
    return <div className="divide-y divide-white/[0.06]">{rows.map((row) => <div key={row.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_120px_120px_1.2fr]"><div className="flex items-center gap-2"><span className="text-sm font-semibold text-slate-100">{shortId(row.id)}</span><DealLink id={row.deal_id} /></div><p className="text-sm text-slate-300">{kes(row.amount)}</p><StatusPill status={row.status} /><p className="text-xs text-slate-500">Buyer {shortId(row.buyer_id)} · {row.mpesa_receipt ?? "no receipt"} · {date(row.created_at)}</p></div>)}</div>;
  }
  if (resource === "auditLogs") {
    const rows = data as AdminResourcePayloads["auditLogs"];
    return <div className="divide-y divide-white/[0.06]">{rows.map((row) => <div key={row.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[180px_1fr_1fr_1.5fr]"><p className="text-xs text-slate-500">{date(row.created_at)}</p><div><p className="text-sm font-semibold text-slate-200">{row.action}</p><p className="text-xs text-slate-500">Actor {row.actor_id}</p></div><p className="text-sm text-slate-300">{row.resource_type}/{shortId(row.resource_id)}</p><p className="text-xs leading-5 text-slate-400">{row.detail || "No detail"}</p></div>)}</div>;
  }
  if (resource === "deals") {
    const rows = data as AdminResourcePayloads["deals"];
    return <div className="divide-y divide-white/[0.06]">{rows.items.map((row) => <Row key={row.id} columns="sm:grid-cols-[1fr_1fr_110px_110px_140px_150px]"><div><DealLink id={row.id} /><p className="text-xs text-slate-500">listing {shortId(row.listing_id)}</p></div><div><UserLink id={row.buyer_id} /><p className="text-xs text-slate-500">seller <UserLink id={row.seller_id} /></p></div><p className="text-sm text-slate-300">{kes(row.agreed_price)}</p><p className="text-sm text-slate-300">{kes(row.commission)}</p><StatusPill status={row.status} /><div className="text-xs text-slate-500"><p>created {date(row.created_at)}</p>{row.released_at ? <p className="text-emerald-300/80">released {date(row.released_at)}</p> : null}{row.refunded_at ? <p className="text-amber-300/80">refunded {date(row.refunded_at)}</p> : null}{row.leak_flag ? <p className="text-rose-300">leak flag</p> : null}</div></Row>)}</div>;
  }
  if (resource === "listings") {
    const rows = data as AdminResourcePayloads["listings"];
    return <div className="divide-y divide-white/[0.06]">{rows.items.map((row) => <Row key={row.id} columns="sm:grid-cols-[1.4fr_1fr_120px_120px_100px_140px]"><div><p className="text-sm font-semibold text-slate-100">{row.name}</p><p className="text-xs text-slate-500">{shortId(row.id)}{row.is_featured ? " · featured" : ""}</p></div><div><p className="text-xs uppercase tracking-[0.1em] text-slate-600">Seller</p><UserLink id={row.seller_id} /></div><p className="text-sm text-slate-300">{row.category}</p><p className="text-sm text-slate-300">{kes(row.price)}</p><StatusPill status={row.status} /><div className="text-xs text-slate-500"><p>{value(row.location_name)}</p><p>{row.views} views · {date(row.created_at)}</p></div></Row>)}</div>;
  }
  if (resource === "stores") {
    const rows = data as AdminResourcePayloads["stores"];
    return <div className="divide-y divide-white/[0.06]">{rows.items.map((row) => <Row key={row.id} columns="sm:grid-cols-[1.4fr_1fr_120px_120px_140px]"><div><p className="text-sm font-semibold text-slate-100">{row.name}</p><p className="text-xs text-slate-500">/{row.slug}</p></div><div><p className="text-xs uppercase tracking-[0.1em] text-slate-600">Owner</p><UserLink id={row.owner_id} /></div><p className="text-sm text-slate-300">{value(row.category)}</p><p className="text-sm text-slate-300">{value(row.county)}</p><div className="text-xs text-slate-500"><StatusBadge tone={row.deleted_at ? "danger" : row.is_active ? "success" : "neutral"}>{row.deleted_at ? "soft-deleted" : row.is_active ? "active" : "inactive"}</StatusBadge><p className="mt-1">created {date(row.created_at)}</p></div></Row>)}</div>;
  }
  if (resource === "disputes") {
    const rows = data as AdminResourcePayloads["disputes"];
    return <div className="divide-y divide-white/[0.06]">{rows.items.map((row) => <Row key={row.id} columns="sm:grid-cols-[1fr_1fr_120px_120px_140px_1.4fr]"><div><p className="text-sm font-semibold text-slate-100">{shortId(row.id)}</p><DealLink id={row.deal_id} /></div><p className="text-sm text-slate-300">{value(row.dispute_type)}</p><p className="text-sm text-slate-300">{kes(row.deal_amount_kes)}</p><p className="text-sm text-slate-300">{row.fund_action ? `${row.fund_action} ${kes(row.fund_amount)}` : "—"}</p><div><StatusPill status={row.state} />{row.age_hours !== null ? <p className="mt-1 text-xs text-slate-500">{row.age_hours}h old</p> : null}</div><div className="text-xs text-slate-500"><p>{row.rule_decision ? `rule: ${row.rule_decision}` : row.ai_recommendation ? "AI recommendation only" : "no decision recorded"}</p><p className="mt-1 line-clamp-2">{row.rule_decision_reason ?? ""}</p></div></Row>)}</div>;
  }
  if (resource === "payments") {
    const rows = data as AdminResourcePayloads["payments"];
    return <div className="divide-y divide-white/[0.06]">{rows.items.map((row) => <Row key={`${row.source}-${row.id}`} columns="sm:grid-cols-[100px_1fr_1fr_120px_120px_150px]"><span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{row.source}</span><div><p className="text-sm font-semibold text-slate-100">{row.reference ?? shortId(row.id)}</p><p className="text-xs text-slate-500">{shortId(row.id)}</p></div><div><UserLink id={row.user_id} /><p className="text-xs text-slate-500">{row.deal_id ? `deal ${shortId(row.deal_id)}` : value(row.purpose)}</p></div><p className="text-sm text-slate-300">{kes(row.amount)}</p><StatusPill status={row.status} /><p className="text-xs text-slate-500">{date(row.created_at)}</p></Row>)}</div>;
  }
  if (resource === "financeIntegrity") {
    const row = data as AdminResourcePayloads["financeIntegrity"];
    return <div className="space-y-5 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Commission on released deals" value={kes(row.commission.released_deals_kes)} hint="Recognised, from Deal.status = released" />
        <Metric label="Ledger revenue credits" value={kes(row.commission.ledger_revenue_credits_kes)} hint="BROKA_REVENUE credits actually posted" />
        <Metric label="Gap" value={kes(row.commission.gap_kes)} hint="Released commission minus posted revenue" />
        <Metric label="Escrow held" value={kes(row.escrow_held_kes)} hint="ESCROW_HOLDING credits minus debits" />
        <Metric label="Refund payable" value={kes(row.refund_payable_kes)} hint="Recorded refunds not yet returned" />
        <Metric label="Awaiting manual refund" value={row.awaiting_manual_refund.count} hint="refund_outcome set, refunded_at empty" />
        <Metric label="Missing release entries" value={row.released_deals_without_release_entries.count} hint="Released deals with no escrow debit" />
        <Metric label="Missing revenue credits" value={row.released_deals_without_revenue_credit.count} hint="Released deals with no revenue credit" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-200">Released deals without release entries</p><StatusBadge tone={row.released_deals_without_release_entries.count ? "danger" : "success"}>{row.released_deals_without_release_entries.count ? "Action required" : "Clear"}</StatusBadge></div>
          <div className="mt-3 space-y-2">{row.released_deals_without_release_entries.sample.map((item) => <div key={item.deal_id} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/10 px-3 py-2 text-xs"><DealLink id={item.deal_id} /><span className="text-slate-400">{kes(item.commission)} · {date(item.released_at)}</span></div>)}{!row.released_deals_without_release_entries.sample.length ? <p className="text-xs text-slate-500">No rows in the sample.</p> : null}</div>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-200">Awaiting manual refund</p><StatusBadge tone={row.awaiting_manual_refund.count ? "warning" : "success"}>{row.awaiting_manual_refund.count ? "Queue" : "Clear"}</StatusBadge></div>
          <div className="mt-3 space-y-2">{row.awaiting_manual_refund.sample.map((item) => <div key={item.deal_id} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/10 px-3 py-2 text-xs"><DealLink id={item.deal_id} /><span className="text-slate-400">{kes(item.agreed_price_kes)} · {item.refund_outcome ?? "—"} · {date(item.refund_requested_at)}</span></div>)}{!row.awaiting_manual_refund.sample.length ? <p className="text-xs text-slate-500">No rows in the sample.</p> : null}</div>
        </div>
      </div>
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Definitions</p><div className="grid gap-2 lg:grid-cols-2">{Object.entries(row.definitions).map(([key, definition]) => <p key={key} className="text-xs leading-5 text-slate-500"><code className="rounded bg-white/[0.05] px-1.5 py-0.5 text-slate-300">{key}</code> {definition}</p>)}</div></div>
    </div>;
  }
  if (resource === "serviceHealth") {
    const row = data as AdminResourcePayloads["serviceHealth"];
    return <div className="space-y-5 p-4">
      <div className="space-y-2">{row.checks.map((check) => <div key={check.name} className="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-200">{check.name} <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-slate-600">{check.kind}</span></p><p className="mt-1 text-xs text-slate-500">{check.detail}</p></div><div className="flex items-center gap-3"><span className="text-xs text-slate-500">{check.latency_ms !== null ? `${check.latency_ms} ms` : "no probe latency"}</span><StatusBadge tone={check.status === "ok" ? "success" : check.status === "warning" || check.status === "degraded" ? "warning" : check.status === "not_configured" ? "neutral" : "danger"}>{check.status}</StatusBadge></div></div>)}</div>
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Provider configuration (no live call made)</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{row.providers.map((provider) => <div key={provider.name} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-200">{provider.name}</p><StatusBadge tone={provider.status === "configured" ? "success" : "neutral"}>{provider.status === "configured" ? "configured" : "not configured"}</StatusBadge></div><p className="mt-2 text-[11px] leading-5 text-slate-500">{provider.detail}</p></div>)}</div><p className="mt-3 text-[11px] text-slate-600">{row.note}</p></div>
    </div>;
  }
  if (resource === "zenoActivity") {
    const row = data as AdminResourcePayloads["zenoActivity"];
    return <div className="space-y-5 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="AI-relayed messages" value={row.durable.ai_relayed_total} hint={`${row.durable.ai_relayed_current} in current ${row.window_hours}h window`} />
        <Metric label="Agent-initiated messages" value={row.durable.agent_initiated_total} hint="Zeno opened the turn" />
        <Metric label="Total negotiation messages" value={row.durable.messages_total} hint={`${row.durable.messages_current} this window vs ${row.durable.messages_previous} previous`} />
        <Metric label="Zeno audit events" value={row.durable.zeno_audit_events_total} hint={row.durable.zeno_last_audit_at ? `Last ${date(row.durable.zeno_last_audit_at)}` : "No audit rows yet"} />
      </div>
      <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
        <div className="flex items-center gap-2"><ShieldQuestion size={15} className="text-amber-200" aria-hidden="true" /><p className="text-sm font-semibold text-slate-100">Process-local counters ({row.process_local.durability})</p></div>
        <p className="mt-1 text-xs text-slate-400">{row.process_local.note}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Classification calls made" value={row.process_local.ai_savings.classification_calls_made} />
          <Metric label="Requests total" value={row.process_local.ai_savings.classification_requests_total} />
          <Metric label="Avoided fraction" value={`${(row.process_local.ai_savings.avoided_fraction * 100).toFixed(2)}%`} />
          <Metric label="Events since restart" value={row.process_local.event_metrics_total} />
        </div>
      </div>
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Explicitly not instrumented</p><div className="grid gap-2 lg:grid-cols-2">{row.not_instrumented.map((entry) => <div key={entry.metric} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><p className="text-xs font-semibold text-slate-300">{entry.metric}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{entry.reason}</p></div>)}</div></div>
      <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-xs text-slate-500">Source: {row.durable.source}. Generated {date(row.generated_at)}.</p><a href="/zeno/savings" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-200 hover:text-amber-100">AI savings detail<ArrowUpRight size={13} /></a></div>
    </div>;
  }
  if (resource === "dealDetail") {
    const row = data as AdminResourcePayloads["dealDetail"];
    return <div className="space-y-5 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Agreed price" value={kes(row.deal.agreed_price)} />
        <Metric label="Commission" value={kes(row.deal.commission)} />
        <Metric label="Status" value={row.deal.status ?? "—"} />
        <Metric label="Created" value={date(row.deal.created_at)} />
        <Metric label="Buyer" value={shortId(row.deal.buyer_id)} />
        <Metric label="Seller" value={shortId(row.deal.seller_id)} />
        <Metric label="Released" value={date(row.deal.released_at)} />
        <Metric label="Refunded" value={date(row.deal.refunded_at)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-sm font-semibold text-slate-200">Ledger entries ({row.ledger_entries.length})</p><div className="mt-3 space-y-2">{row.ledger_entries.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/10 px-3 py-2 text-xs"><span className="text-slate-300">{entry.account} · {entry.direction}</span><span className="text-slate-400">{kes(entry.amount_kes)} · {date(entry.created_at)}</span></div>)}{!row.ledger_entries.length ? <p className="text-xs text-amber-200">No ledger entries for this deal.</p> : null}</div></section>
        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-sm font-semibold text-slate-200">External escrow payments ({row.external_escrows.length})</p><div className="mt-3 space-y-2">{row.external_escrows.map((escrow) => <div key={escrow.id} className="rounded-lg border border-white/[0.05] bg-black/10 px-3 py-2 text-xs"><div className="flex items-center justify-between"><span className="text-slate-300">payment {value(escrow.payment_no)} · {escrow.provider}</span><StatusPill status={escrow.status} /></div><p className="mt-1 text-slate-500">{kes(escrow.amount)} {escrow.currency ?? ""} · funded {date(escrow.funded_at)} · released {date(escrow.released_at)}{escrow.last_error ? ` · error: ${escrow.last_error}` : ""}</p></div>)}{!row.external_escrows.length ? <p className="text-xs text-slate-500">No external escrow rows.</p> : null}</div></section>
        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-sm font-semibold text-slate-200">M-Pesa transactions ({row.mpesa_transactions.length})</p><div className="mt-3 space-y-2">{row.mpesa_transactions.map((txn) => <div key={txn.id} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/10 px-3 py-2 text-xs"><span className="text-slate-300">{txn.mpesa_receipt ?? shortId(txn.id)}</span><span className="text-slate-400">{kes(txn.amount)} · {txn.status} · {date(txn.created_at)}</span></div>)}{!row.mpesa_transactions.length ? <p className="text-xs text-slate-500">No M-Pesa rows.</p> : null}</div></section>
        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-sm font-semibold text-slate-200">Dispute cases ({row.dispute_cases.length})</p><div className="mt-3 space-y-2">{row.dispute_cases.map((dispute) => <div key={dispute.id} className="rounded-lg border border-white/[0.05] bg-black/10 px-3 py-2 text-xs"><div className="flex items-center justify-between"><span className="text-slate-300">{dispute.dispute_type ?? "dispute"} · {shortId(dispute.id)}</span><StatusPill status={dispute.state} /></div><p className="mt-1 text-slate-500">{dispute.rule_decision_reason ?? "No rule reason recorded"}</p></div>)}{!row.dispute_cases.length ? <p className="text-xs text-slate-500">No dispute cases.</p> : null}</div></section>
      </div>
      <p className="text-[11px] text-slate-600"><ExternalLink size={12} className="mr-1 inline" aria-hidden="true" />Read-only: money movement stays with the escrow engine and is never triggered from this dashboard.</p>
    </div>;
  }
  if (resource === "aiSavings") { const row = data as AdminResourcePayloads["aiSavings"]; return <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Prefilter avoided" value={row.classification_calls_avoided_by_prefilter} /><Metric label="Cache avoided" value={row.classification_calls_avoided_by_cache} /><Metric label="Calls made" value={row.classification_calls_made} /><Metric label="Requests" value={row.classification_requests_total} /><Metric label="Avoided fraction" value={`${(row.avoided_fraction * 100).toFixed(2)}%`} /></div>; }
  if (resource === "ledgerIntegrity") { const row = data as AdminResourcePayloads["ledgerIntegrity"]; return <div className="space-y-4 p-4"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Credits" value={kes(row.total_credits_kes)} /><Metric label="Debits" value={kes(row.total_debits_kes)} /><Metric label="Discrepancy" value={kes(row.discrepancy_kes)} hint="balanced is true by construction; escrow integrity is the real check" /></div><p className={row.escrow_integrity_ok ? "text-sm text-emerald-200" : "text-sm text-rose-200"}>{row.escrow_integrity_ok ? "Escrow integrity check passed." : `${row.negative_escrow_deals.length} negative escrow balance(s) require attention.`}</p></div>; }
  if (resource === "eventMetrics") { const row = data as AdminResourcePayloads["eventMetrics"]; const handlerTypes = Object.keys(row.registered_handlers); const handlerTotal = Object.values(row.registered_handlers).reduce((sum, count) => sum + count, 0); return <div className="space-y-4 p-4"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Events since restart" value={row.total_events} hint={row.scope === "process_local" ? "Process-local; resets on deploy, per worker" : undefined} /><Metric label="Event types with handlers" value={handlerTypes.length} hint={`${handlerTotal} total subscriptions`} /><Metric label="Event types observed" value={Object.keys(row.by_type).length} /></div><div className="flex flex-wrap gap-2">{Object.entries(row.by_type).map(([key, count]) => <span key={key} className="rounded-full border border-white/[0.07] px-3 py-1 text-xs text-slate-400">{key}: {count}</span>)}</div><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Handler subscriptions</p><div className="flex flex-wrap gap-2">{handlerTypes.map((key) => <span key={key} className="rounded-full border border-white/[0.05] px-3 py-1 text-[11px] text-slate-500">{key} × {row.registered_handlers[key]}</span>)}</div></div></div>; }
  if (resource === "eventCatalog") { const row = data as AdminResourcePayloads["eventCatalog"]; return <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(row.by_domain).map(([domain, events]) => <div key={domain} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="text-sm font-semibold text-slate-200">{domain}</p><p className="mt-2 text-xs leading-5 text-slate-500">{events.join(" · ")}</p></div>)}</div>; }
  if (resource === "workflowVersions") { const row = data as AdminResourcePayloads["workflowVersions"]; return <div className="p-4"><Metric label="Current workflow version" value={row.current_version} /><pre className="mt-4 max-h-72 overflow-auto rounded-xl bg-black/20 p-4 text-xs text-slate-400">{JSON.stringify(row.versions, null, 2)}</pre></div>; }
  if (resource === "econfirmDiagnostics") { const row = data as AdminResourcePayloads["econfirmDiagnostics"]; return <div className="grid gap-3 p-4 sm:grid-cols-2"><Metric label="Configured" value={row.configured ? "Yes" : "No"} /><Metric label="Call" value={row.call} /><Metric label="Result" value={row.ok ? "OK" : row.error ?? "Failed"} /><Metric label="Message" value={row.message ?? "—"} /></div>; }
  if (resource === "clientIpDiagnostics") { const row = data as AdminResourcePayloads["clientIpDiagnostics"]; return <div className="grid gap-3 p-4 sm:grid-cols-2"><Metric label="Resolved address" value={row.resolved} /><Metric label="Source" value={row.source} /><Metric label="Peer" value={row.peer} /><Metric label="Trusted proxy hops" value={row.config.trusted_proxy_hops} /></div>; }
  return null;
}
