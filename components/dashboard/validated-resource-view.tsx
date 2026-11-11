"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, ExternalLink, ShieldQuestion } from "lucide-react";
import Link from "next/link";

import { DataTable, type Column } from "@/components/dashboard/data-table";
import { FinanceIntegrityView } from "@/components/dashboard/finance-integrity-view";
import { StatusBadge } from "@/components/ui/primitives";
import { InfoTip } from "@/components/ui/tooltip";
import type { AdminResourcePayloads } from "@/lib/api/schemas";
import type { ApiResource } from "@/types/broka";
import { formatDateTime, formatKesAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

const shortId = (id: string | null | undefined) => (id ? id.replace(/^(deal|listing|seller|buyer|store|user|d)-/, "").slice(0, 8) : "—");
const date = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : "—");
const kes = (amount: number | null | undefined) => (amount === null || amount === undefined ? "—" : formatKesAmount(amount));

function statusTone(status: string | null | undefined): "success" | "warning" | "danger" | "info" | "neutral" {
  if (!status) return "neutral";
  if (["released", "success", "completed", "active", "ok", "delivered", "configured", "closed_released"].includes(status)) return "success";
  if (["failed", "payout_failed", "error", "closed_refunded", "degraded"].includes(status)) return "danger";
  if (["pending", "processing", "initiated", "disputed", "escalated", "release_pending", "warning", "awaiting_condition_check", "awaiting_resolution", "awaiting_replacement", "goods_not_arrived", "ai_review", "ready_for_refund", "ready_for_release"].includes(status)) return "warning";
  if (["open", "waiting_seller_explanation", "waiting_buyer_decision", "waiting_replacement", "waiting_return", "not_configured"].includes(status)) return "info";
  return "neutral";
}

function StatusPill({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-slate-500">—</span>;
  return <StatusBadge tone={statusTone(status)}>{status.replaceAll("_", " ")}</StatusBadge>;
}

function RecordLink({ href, children, label }: { href: string; children: React.ReactNode; label?: string }) {
  return <Link href={href} className="focus-ring whitespace-nowrap font-mono text-[12px] font-semibold text-slate-100 hover:text-[#ded8ff]" aria-label={label}>{children}</Link>;
}

function UserRef({ id }: { id: string | null | undefined }) {
  return id ? <RecordLink href={`/users/${encodeURIComponent(id)}`} label={`Open user ${id}`}>{shortId(id)}</RecordLink> : <span className="text-slate-500">—</span>;
}
function DealRef({ id }: { id: string | null | undefined }) {
  return id ? <RecordLink href={`/deals/${encodeURIComponent(id)}`} label={`Open deal ${id}`}>deal {shortId(id)}</RecordLink> : <span className="text-slate-500">—</span>;
}
function ListingRef({ id, name }: { id: string | null | undefined; name?: string }) {
  if (!id) return <span className="text-slate-500">{name ?? "—"}</span>;
  return <Link href={`/listings/${encodeURIComponent(id)}`} className="focus-ring whitespace-nowrap text-[12px] font-semibold text-slate-100 hover:text-[#ded8ff]">{name ?? `#${shortId(id)}`}</Link>;
}
function Timestamp({ iso }: { iso: string | null | undefined }) {
  return <span className="text-[11px] tabular-nums text-slate-400" title={iso ?? undefined}>{date(iso)}</span>;
}

function Metric({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "danger" | "success" | "warning" }) {
  return (
    <div className="inset-panel p-3.5">
      <div className="flex items-center gap-1.5"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>{hint ? <InfoTip label={`${label} definition`}>{hint}</InfoTip> : null}</div>
      <p className={cn("mt-2 font-display text-lg font-bold tabular-nums", tone === "danger" ? "text-rose-300" : tone === "success" ? "text-emerald-300" : tone === "warning" ? "text-amber-200" : "text-slate-100")}>{value}</p>
    </div>
  );
}

function DetailSection({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-sm font-semibold text-slate-200">{title}</p>{description ? <p className="mt-0.5 text-[11px] text-slate-500">{description}</p> : null}</div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ResolveFraudEvent({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const queryClient = useQueryClient();
  async function submit() {
    setStatus("sending");
    setMessage("");
    const key = idempotencyKey || crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(key);
    try {
      const response = await fetch(`/api/broka/fraud-events/${encodeURIComponent(eventId)}/resolve`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(note.trim() ? { reason: note.trim() } : {}),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; changed?: boolean };
      if (!response.ok) throw new Error(payload.message ?? "The BROKA API could not resolve this event.");
      setStatus("done");
      void queryClient.invalidateQueries({ queryKey: ["broka-admin"] });
      setMessage(payload.changed === false ? "Already resolved." : "Resolved and audited.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The BROKA API could not resolve this event.");
    }
  }
  if (status === "done") return <p role="status" className="text-[11px] text-emerald-200">{message}</p>;
  return (
    <div>
      {open ? (
        <div className="space-y-2">
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} placeholder="Optional review note (3-500 characters)" aria-label="Fraud review note" className="w-full rounded-lg border border-white/[0.08] bg-black/20 p-2.5 text-[11px] text-slate-200 placeholder:text-slate-600" />
          <div className="flex gap-2">
            <button onClick={submit} disabled={status === "sending" || (note.trim().length > 0 && note.trim().length < 3)} className="focus-ring rounded-lg bg-emerald-400/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-400/25 disabled:opacity-50">{status === "sending" ? "Resolving…" : "Resolve event"}</button>
            <button onClick={() => setOpen(false)} className="focus-ring rounded-lg border border-white/[0.09] px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200">Cancel</button>
          </div>
          {status === "error" ? <p className="text-[11px] text-rose-200">{message}</p> : null}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-400/20"><CheckCircle2 size={12} aria-hidden="true" />Resolve</button>
      )}
    </div>
  );
}

function Table<Row>({ rows, columns, label, rowKey }: { rows: Row[]; columns: Column<Row>[]; label: string; rowKey: (row: Row) => string }) {
  return <DataTable rows={rows} columns={columns} label={label} rowKey={rowKey} />;
}

function FraudEvents({ rows }: { rows: AdminResourcePayloads["fraudEvents"] }) {
  const columns: Column<AdminResourcePayloads["fraudEvents"][number]>[] = [
    { key: "user", header: "User", primary: true, render: (row) => <div><UserRef id={row.user_id} /><p className="cell-secondary font-mono">{shortId(row.id)}</p></div> },
    { key: "reason", header: "Reason", render: (row) => <span className="text-[12px] text-slate-300">{row.reason}</span> },
    { key: "trust", header: "Trust at flag", align: "right", render: (row) => <span className="tabular-nums text-slate-300">{row.trust_score_at_flag ?? "—"}</span> },
    { key: "trigger", header: "Trigger", render: (row) => <span className="font-mono text-[11px] text-slate-400">{row.triggered_by ? shortId(row.triggered_by) : "—"}</span> },
    { key: "created", header: "Created", render: (row) => <div><Timestamp iso={row.created_at} /><StatusBadge tone={row.resolved ? "success" : "warning"} className="mt-1">{row.resolved ? "Resolved" : "Open"}</StatusBadge></div> },
    { key: "action", header: "Action", mobileHidden: true, render: (row) => row.resolved ? <span className="text-[10px] text-slate-600">Reviewed</span> : <ResolveFraudEvent eventId={row.id} /> },
  ];
  return <Table rows={rows} columns={columns} label="Fraud events" rowKey={(row) => row.id} />;
}

function Transactions({ rows }: { rows: AdminResourcePayloads["transactions"] }) {
  const columns: Column<AdminResourcePayloads["transactions"][number]>[] = [
    { key: "txn", header: "Transaction", primary: true, render: (row) => <div><span className="cell-primary font-mono">{shortId(row.id)}</span><p className="cell-secondary"><DealRef id={row.deal_id} /></p></div> },
    { key: "amount", header: "Amount", align: "right", render: (row) => <span className="font-semibold tabular-nums text-white">{kes(row.amount)}</span> },
    { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
    { key: "buyer", header: "Buyer", render: (row) => <UserRef id={row.buyer_id} /> },
    { key: "evidence", header: "M-Pesa / date", render: (row) => <div><p className="font-mono text-[10px] text-slate-400">{row.mpesa_receipt ?? "no receipt"}</p><Timestamp iso={row.created_at} /></div> },
  ];
  return <Table rows={rows} columns={columns} label="M-Pesa transactions" rowKey={(row) => row.id} />;
}

function AuditLogs({ rows }: { rows: AdminResourcePayloads["auditLogs"] }) {
  const columns: Column<AdminResourcePayloads["auditLogs"][number]>[] = [
    { key: "action", header: "Action", primary: true, render: (row) => <div><span className="cell-primary">{row.action}</span><p className="cell-secondary">Actor <span className="font-mono">{shortId(row.actor_id)}</span></p></div> },
    { key: "when", header: "When", render: (row) => <Timestamp iso={row.created_at} /> },
    { key: "resource", header: "Resource", render: (row) => <span className="text-[11px] text-slate-400">{row.resource_type}/<span className="font-mono">{shortId(row.resource_id)}</span></span> },
    { key: "detail", header: "Detail", render: (row) => <span className="line-clamp-2 text-[11px] leading-4 text-slate-400">{row.detail || "No detail"}</span> },
    { key: "ip", header: "IP", mobileHidden: true, render: (row) => <span className="font-mono text-[10px] text-slate-600">{row.ip_address ?? "—"}</span> },
  ];
  return <Table rows={rows} columns={columns} label="Audit log" rowKey={(row) => row.id} />;
}

function Deals({ rows }: { rows: AdminResourcePayloads["deals"] }) {
  const columns: Column<AdminResourcePayloads["deals"]["items"][number]>[] = [
    { key: "deal", header: "Deal", primary: true, render: (row) => <div><DealRef id={row.id} /><p className="cell-secondary">listing {row.listing_id ? <ListingRef id={row.listing_id} /> : "—"}</p></div> },
    { key: "parties", header: "Buyer / seller", render: (row) => <div className="text-[11px]"><span className="text-slate-500">buyer </span><UserRef id={row.buyer_id} /><br /><span className="text-slate-500">seller </span><UserRef id={row.seller_id} /></div> },
    { key: "price", header: "Agreed", align: "right", render: (row) => <span className="font-semibold tabular-nums text-white">{kes(row.agreed_price)}</span> },
    { key: "commission", header: "Commission", align: "right", hideBelow: "xl", render: (row) => <span className="tabular-nums text-slate-300">{kes(row.commission)}</span> },
    { key: "status", header: "Status", render: (row) => <div><StatusPill status={row.status} />{row.leak_flag ? <StatusBadge tone="danger" className="mt-1">Leak flag</StatusBadge> : null}</div> },
    { key: "lifecycle", header: "Lifecycle", hideBelow: "xl", render: (row) => <div className="space-y-0.5 text-[10px] text-slate-500"><p>created <Timestamp iso={row.created_at} /></p>{row.released_at ? <p className="text-emerald-300/80">released <Timestamp iso={row.released_at} /></p> : null}{row.refunded_at ? <p className="text-amber-300/80">refunded <Timestamp iso={row.refunded_at} /></p> : null}{row.delivery_confirmed_at ? <p>delivered <Timestamp iso={row.delivery_confirmed_at} /></p> : null}</div> },
  ];
  return <Table rows={rows.items} columns={columns} label="Deals" rowKey={(row) => row.id} />;
}

function Listings({ rows }: { rows: AdminResourcePayloads["listings"] }) {
  const columns: Column<AdminResourcePayloads["listings"]["items"][number]>[] = [
    { key: "name", header: "Listing", primary: true, render: (row) => <div><ListingRef id={row.id} name={row.name} /><p className="cell-secondary">{shortId(row.id)}{row.is_featured ? " · featured" : ""}</p></div> },
    { key: "seller", header: "Seller", render: (row) => <UserRef id={row.seller_id} /> },
    { key: "category", header: "Category", render: (row) => <span className="text-[11px] text-slate-300">{row.category}</span> },
    { key: "price", header: "Price", align: "right", render: (row) => <span className="font-semibold tabular-nums text-white">{kes(row.price)}</span> },
    { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
    { key: "location", header: "Location", render: (row) => <span className="text-[11px] text-slate-400">{row.location_name ?? "—"}</span> },
    { key: "views", header: "Views", align: "right", render: (row) => <span className="tabular-nums text-slate-300">{row.views.toLocaleString("en-KE")}</span> },
    { key: "created", header: "Created", render: (row) => <Timestamp iso={row.created_at} /> },
  ];
  return <Table rows={rows.items} columns={columns} label="Listings" rowKey={(row) => row.id} />;
}

function Stores({ rows }: { rows: AdminResourcePayloads["stores"] }) {
  const columns: Column<AdminResourcePayloads["stores"]["items"][number]>[] = [
    { key: "name", header: "Store", primary: true, render: (row) => <div><Link href={`/stores/${encodeURIComponent(row.id)}`} className="focus-ring cell-primary hover:text-[#ded8ff]">{row.name}</Link><p className="cell-secondary font-mono">/{row.slug}</p></div> },
    { key: "owner", header: "Owner", render: (row) => <UserRef id={row.owner_id} /> },
    { key: "category", header: "Category", render: (row) => <span className="text-[11px] text-slate-300">{row.category ?? "—"}</span> },
    { key: "county", header: "County", render: (row) => <span className="text-[11px] text-slate-300">{row.county ?? "—"}</span> },
    { key: "status", header: "Status", render: (row) => <div><StatusPill status={row.deleted_at ? "deleted" : row.is_active ? "active" : "inactive"} />{row.deleted_at ? <p className="mt-1 text-[10px] text-rose-300/80">soft-deleted</p> : null}</div> },
    { key: "created", header: "Created", render: (row) => <Timestamp iso={row.created_at} /> },
  ];
  return <Table rows={rows.items} columns={columns} label="Stores" rowKey={(row) => row.id} />;
}

function Disputes({ rows }: { rows: AdminResourcePayloads["disputes"] }) {
  const columns: Column<AdminResourcePayloads["disputes"]["items"][number]>[] = [
    { key: "case", header: "Case", primary: true, render: (row) => <div><Link href={`/disputes/${encodeURIComponent(row.id)}`} className="focus-ring cell-primary hover:text-[#ded8ff]">case {shortId(row.id)}</Link><p className="cell-secondary"><DealRef id={row.deal_id} /></p></div> },
    { key: "type", header: "Type", render: (row) => <span className="text-[11px] text-slate-300">{row.dispute_type ?? "—"}</span> },
    { key: "amount", header: "Deal amount", align: "right", render: (row) => <span className="font-semibold tabular-nums text-white">{kes(row.deal_amount_kes)}</span> },
    { key: "funds", header: "Fund action", render: (row) => <span className="text-[11px] text-slate-300">{row.fund_action ? `${row.fund_action} ${kes(row.fund_amount)}` : "—"}</span> },
    { key: "state", header: "State", render: (row) => <div><StatusPill status={row.state} />{row.age_hours !== null ? <p className="mt-1 text-[10px] text-slate-500">{row.age_hours}h old</p> : null}</div> },
    { key: "decision", header: "Rule / AI context", render: (row) => <div className="text-[10px] leading-4 text-slate-500"><p>{row.rule_decision ? `rule: ${row.rule_decision}` : row.ai_recommendation ? "AI recommendation only" : "no decision recorded"}</p><p className="line-clamp-2">{row.rule_decision_reason ?? ""}</p></div> },
  ];
  return <Table rows={rows.items} columns={columns} label="Disputes" rowKey={(row) => row.id} />;
}

function Payments({ rows }: { rows: AdminResourcePayloads["payments"] }) {
  const columns: Column<AdminResourcePayloads["payments"]["items"][number]>[] = [
    { key: "reference", header: "Reference", primary: true, render: (row) => <div><span className="cell-primary font-mono">{row.reference ?? shortId(row.id)}</span><p className="cell-secondary">{row.source.toUpperCase()} · {shortId(row.id)}</p></div> },
    { key: "user", header: "User / deal", render: (row) => <div className="text-[11px]"><UserRef id={row.user_id} /><p className="text-slate-500">{row.deal_id ? <DealRef id={row.deal_id} /> : row.purpose ?? "—"}</p></div> },
    { key: "amount", header: "Amount", align: "right", render: (row) => <span className="font-semibold tabular-nums text-white">{kes(row.amount)}</span> },
    { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
    { key: "created", header: "Created", render: (row) => <Timestamp iso={row.created_at} /> },
  ];
  return <Table rows={rows.items} columns={columns} label="Payments" rowKey={(row) => `${row.source}-${row.id}`} />;
}

function ServiceHealth({ data }: { data: AdminResourcePayloads["serviceHealth"] }) {
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Generated {date(data.generated_at)}. Probes are read-only; provider configuration checks are not live provider calls.</p>
        <StatusBadge tone={data.checks.some((check) => check.status === "error" || check.status === "degraded") ? "danger" : "success"}>{data.checks.some((check) => check.status === "error" || check.status === "degraded") ? "Attention required" : "All probes healthy"}</StatusBadge>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {data.checks.map((check) => (
          <div key={check.name} className="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold text-slate-200">{check.name} <span className="ml-2 text-[9px] uppercase tracking-[0.12em] text-slate-600">{check.kind}</span></p><p className="mt-1 text-[11px] leading-4 text-slate-500">{check.detail}</p><p className="mt-1 text-[10px] text-slate-600">checked {date(check.checked_at)}</p></div>
            <div className="flex shrink-0 items-center gap-3"><span className="text-[11px] tabular-nums text-slate-500">{check.latency_ms !== null ? `${check.latency_ms} ms` : "no latency"}</span><StatusBadge tone={check.status === "ok" ? "success" : check.status === "warning" || check.status === "degraded" ? "warning" : check.status === "not_configured" ? "neutral" : "danger"}>{check.status}</StatusBadge></div>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Provider configuration · no live call made</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {data.providers.map((provider) => <div key={provider.name} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-200">{provider.name}</p><StatusBadge tone={provider.status === "configured" ? "success" : "neutral"}>{provider.status === "configured" ? "configured" : "not configured"}</StatusBadge></div><p className="mt-2 text-[11px] leading-5 text-slate-500">{provider.detail}</p></div>)}
        </div>
        <p className="mt-3 text-[10px] text-slate-600">{data.note}</p>
      </div>
    </div>
  );
}

function ZenoActivity({ data }: { data: AdminResourcePayloads["zenoActivity"] }) {
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="AI-relayed messages" value={data.durable.ai_relayed_total.toLocaleString("en-KE")} hint={`${data.durable.ai_relayed_current} in the current ${data.window_hours}h window`} />
        <Metric label="Agent-initiated" value={data.durable.agent_initiated_total.toLocaleString("en-KE")} hint="Zeno opened the turn" />
        <Metric label="Negotiation messages" value={data.durable.messages_total.toLocaleString("en-KE")} hint={`${data.durable.messages_current} this window vs ${data.durable.messages_previous} previous`} />
        <Metric label="Zeno audit events" value={data.durable.zeno_audit_events_total.toLocaleString("en-KE")} hint={data.durable.zeno_last_audit_at ? `Last ${date(data.durable.zeno_last_audit_at)}` : "No audit rows yet"} />
      </div>
      <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
        <div className="flex items-center gap-2"><ShieldQuestion size={15} className="text-amber-200" aria-hidden="true" /><p className="text-sm font-semibold text-slate-100">Process-local counters ({data.process_local.durability})</p></div>
        <p className="mt-1 text-xs text-slate-400">{data.process_local.note}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Classification calls" value={data.process_local.ai_savings.classification_calls_made.toLocaleString("en-KE")} />
          <Metric label="Requests total" value={data.process_local.ai_savings.classification_requests_total.toLocaleString("en-KE")} />
          <Metric label="Avoided fraction" value={`${(data.process_local.ai_savings.avoided_fraction * 100).toFixed(2)}%`} />
          <Metric label="Events since restart" value={data.process_local.event_metrics_total.toLocaleString("en-KE")} />
        </div>
      </div>
      <DetailSection title="Explicitly not instrumented" description="The backend names these gaps rather than estimating them.">
        <div className="grid gap-2 lg:grid-cols-2">{data.not_instrumented.map((entry) => <div key={entry.metric} className="rounded-lg border border-white/[0.055] bg-black/20 p-3"><p className="text-[11px] font-semibold text-slate-300">{entry.metric}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{entry.reason}</p></div>)}</div>
      </DetailSection>
      <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><p className="text-[10px] text-slate-500">Source: {data.durable.source}. Generated {date(data.generated_at)}.</p><Link href="/zeno/savings" className="focus-ring inline-flex items-center gap-1 text-[10px] font-semibold text-amber-200 hover:text-amber-100">AI savings detail <ArrowUpRight size={11} aria-hidden="true" /></Link></div>
    </div>
  );
}

function DealDetail({ data }: { data: AdminResourcePayloads["dealDetail"] }) {
  const ledgerColumns: Column<AdminResourcePayloads["dealDetail"]["ledger_entries"][number]>[] = [
    { key: "account", header: "Account", primary: true, render: (row) => <div><span className="cell-primary">{row.account}</span><p className="cell-secondary">{row.direction} · {row.description ?? "no description"}</p></div> },
    { key: "amount", header: "Amount", align: "right", render: (row) => <span className="font-semibold tabular-nums text-white">{kes(row.amount_kes)}</span> },
    { key: "ref", header: "Reference", render: (row) => <span className="font-mono text-[10px] text-slate-400">{row.ref_id ?? "—"}</span> },
    { key: "when", header: "Created", render: (row) => <Timestamp iso={row.created_at} /> },
  ];
  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Agreed price" value={kes(data.deal.agreed_price)} />
        <Metric label="Commission" value={kes(data.deal.commission)} />
        <Metric label="Deal status" value={<StatusPill status={data.deal.status} />} />
        <Metric label="Created" value={<Timestamp iso={data.deal.created_at} />} />
        <Metric label="Buyer" value={<UserRef id={data.deal.buyer_id} />} />
        <Metric label="Seller" value={<UserRef id={data.deal.seller_id} />} />
        <Metric label="Released" value={<Timestamp iso={data.deal.released_at} />} />
        <Metric label="Refunded" value={<Timestamp iso={data.deal.refunded_at} />} />
      </div>
      {data.deal.leak_flag ? <p className="rounded-lg border border-rose-400/25 bg-rose-400/[0.06] p-3 text-xs text-rose-100">This deal carries a leak flag. Review the dispute and payment evidence before any release decision.</p> : null}
      <DetailSection title={`Ledger entries (${data.ledger_entries.length})`} description="Escrow debits, credits and revenue recognition recorded by the ledger.">
        {data.ledger_entries.length ? <div className="table-shell"><DataTable rows={data.ledger_entries} columns={ledgerColumns} label="Deal ledger entries" rowKey={(row) => row.id} /></div> : <p className="text-xs text-slate-500">No ledger entries recorded for this deal.</p>}
      </DetailSection>
      <div className="grid gap-4 xl:grid-cols-2">
        <DetailSection title={`External escrow payments (${data.external_escrows.length})`} description="Escrow held externally: these are external funds, not BROKA cash or platform income.">
          <div className="space-y-2">{data.external_escrows.map((escrow) => <div key={escrow.id} className="rounded-lg border border-white/[0.055] bg-black/20 px-3 py-2 text-[11px]"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-200">{escrow.provider} · {kes(escrow.amount)}</span><StatusPill status={escrow.status} /></div><p className="mt-1 text-slate-500">payment #{escrow.payment_no ?? "—"} · funded {date(escrow.funded_at)} · released {date(escrow.released_at)}</p>{escrow.last_error ? <p className="mt-1 text-rose-300">{escrow.last_error}</p> : null}</div>)}{!data.external_escrows.length ? <p className="text-xs text-slate-500">No external escrow payment recorded.</p> : null}</div>
        </DetailSection>
        <DetailSection title={`M-Pesa transactions (${data.mpesa_transactions.length})`}>
          <div className="space-y-2">{data.mpesa_transactions.map((txn) => <div key={txn.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.055] bg-black/20 px-3 py-2 text-[11px]"><span className="font-mono text-slate-300">{txn.mpesa_receipt ?? shortId(txn.id)} · {kes(txn.amount)}</span><StatusPill status={txn.status} /></div>)}{!data.mpesa_transactions.length ? <p className="text-xs text-slate-500">No M-Pesa transaction recorded.</p> : null}</div>
        </DetailSection>
        <DetailSection title={`Dispute cases (${data.dispute_cases.length})`} action={<Link href="/disputes" className="focus-ring text-[10px] font-semibold text-[#a895ff]">Open disputes</Link>}>
          <div className="space-y-2">{data.dispute_cases.map((dispute) => <div key={dispute.id} className="rounded-lg border border-white/[0.055] bg-black/20 px-3 py-2 text-[11px]"><div className="flex items-center justify-between gap-2"><Link href={`/disputes/${encodeURIComponent(dispute.id)}`} className="focus-ring font-mono font-semibold text-slate-200">case {shortId(dispute.id)}</Link><StatusPill status={dispute.state} /></div><p className="mt-1 text-slate-500">{dispute.dispute_type ?? "—"} · fund {dispute.fund_action ?? "—"} {dispute.fund_amount !== null ? kes(dispute.fund_amount) : ""} · {dispute.rule_decision ?? "no rule decision"}</p>{dispute.rule_decision_reason ? <p className="mt-1 text-slate-600">{dispute.rule_decision_reason}</p> : null}</div>)}{!data.dispute_cases.length ? <p className="text-xs text-slate-500">No dispute case recorded.</p> : null}</div>
        </DetailSection>
        <DetailSection title="Administrative boundary">
          <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-500"><ExternalLink size={12} className="mt-0.5 shrink-0" aria-hidden="true" />Read-only: money movement stays with the escrow engine and is never triggered from this dashboard. Actions elsewhere are allowlisted, reason-gated and written to the audit log.</p>
        </DetailSection>
      </div>
    </div>
  );
}

export function ValidatedResourceView({ resource, data }: { resource: ApiResource; data: unknown }) {
  if (resource === "fraudEvents") return <FraudEvents rows={data as AdminResourcePayloads["fraudEvents"]} />;
  if (resource === "transactions") return <Transactions rows={data as AdminResourcePayloads["transactions"]} />;
  if (resource === "auditLogs") return <AuditLogs rows={data as AdminResourcePayloads["auditLogs"]} />;
  if (resource === "deals") return <Deals rows={data as AdminResourcePayloads["deals"]} />;
  if (resource === "listings") return <Listings rows={data as AdminResourcePayloads["listings"]} />;
  if (resource === "stores") return <Stores rows={data as AdminResourcePayloads["stores"]} />;
  if (resource === "disputes") return <Disputes rows={data as AdminResourcePayloads["disputes"]} />;
  if (resource === "payments") return <Payments rows={data as AdminResourcePayloads["payments"]} />;
  if (resource === "financeIntegrity") return <FinanceIntegrityView data={data as AdminResourcePayloads["financeIntegrity"]} />;
  if (resource === "serviceHealth") return <ServiceHealth data={data as AdminResourcePayloads["serviceHealth"]} />;
  if (resource === "zenoActivity") return <ZenoActivity data={data as AdminResourcePayloads["zenoActivity"]} />;
  if (resource === "dealDetail") return <DealDetail data={data as AdminResourcePayloads["dealDetail"]} />;

  if (resource === "aiSavings") {
    const row = data as AdminResourcePayloads["aiSavings"];
    return <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Prefilter avoided" value={row.classification_calls_avoided_by_prefilter.toLocaleString("en-KE")} /><Metric label="Cache avoided" value={row.classification_calls_avoided_by_cache.toLocaleString("en-KE")} /><Metric label="Calls made" value={row.classification_calls_made.toLocaleString("en-KE")} /><Metric label="Requests" value={row.classification_requests_total.toLocaleString("en-KE")} /><Metric label="Avoided fraction" value={`${(row.avoided_fraction * 100).toFixed(2)}%`} /></div>;
  }
  if (resource === "ledgerIntegrity") {
    const row = data as AdminResourcePayloads["ledgerIntegrity"];
    return <div className="space-y-4 p-4"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Credits" value={kes(row.total_credits_kes)} /><Metric label="Debits" value={kes(row.total_debits_kes)} /><Metric label="Discrepancy" value={kes(row.discrepancy_kes)} tone={row.discrepancy_kes > 0 ? "danger" : "success"} hint="Balanced is true by construction; escrow integrity is the real control." /></div><p className={row.escrow_integrity_ok ? "text-sm text-emerald-200" : "text-sm text-rose-200"}>{row.escrow_integrity_ok ? "Escrow integrity check passed." : `${row.negative_escrow_deals.length} negative escrow balance(s) require attention.`}</p></div>;
  }
  if (resource === "eventMetrics") {
    const row = data as AdminResourcePayloads["eventMetrics"];
    const handlerTypes = Object.keys(row.registered_handlers);
    const handlerTotal = Object.values(row.registered_handlers).reduce((sum, count) => sum + count, 0);
    return <div className="space-y-4 p-4"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Events since restart" value={row.total_events.toLocaleString("en-KE")} hint={row.scope === "process_local" ? "Process-local; resets on deploy and is per worker." : undefined} /><Metric label="Event types with handlers" value={handlerTypes.length} hint={`${handlerTotal} total subscriptions`} /><Metric label="Event types observed" value={Object.keys(row.by_type).length} /></div><div className="flex flex-wrap gap-2">{Object.entries(row.by_type).map(([key, count]) => <span key={key} className="rounded-full border border-white/[0.07] px-3 py-1 text-[11px] text-slate-400">{key}: {count}</span>)}</div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Handler subscriptions</p><div className="flex flex-wrap gap-2">{handlerTypes.map((key) => <span key={key} className="rounded-full border border-white/[0.05] px-3 py-1 text-[10px] text-slate-500">{key} × {row.registered_handlers[key]}</span>)}</div></div></div>;
  }
  if (resource === "eventCatalog") {
    const row = data as AdminResourcePayloads["eventCatalog"];
    return <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(row.by_domain).map(([domain, events]) => <div key={domain} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="text-sm font-semibold text-slate-200">{domain}</p><p className="mt-2 text-[11px] leading-5 text-slate-500">{events.join(" · ")}</p></div>)}</div>;
  }
  if (resource === "workflowVersions") {
    const row = data as AdminResourcePayloads["workflowVersions"];
    return <div className="p-4"><Metric label="Current workflow version" value={<span className="font-mono">{row.current_version}</span>} /><pre className="scroll-thin mt-4 max-h-72 overflow-auto rounded-xl border border-white/[0.06] bg-black/20 p-4 text-xs text-slate-400">{JSON.stringify(row.versions, null, 2)}</pre></div>;
  }
  if (resource === "econfirmDiagnostics") {
    const row = data as AdminResourcePayloads["econfirmDiagnostics"];
    return <div className="grid gap-3 p-4 sm:grid-cols-2"><Metric label="Configured" value={row.configured ? "Yes" : "No"} tone={row.configured ? "success" : "warning"} /><Metric label="Call" value={row.call} /><Metric label="Result" value={row.ok ? "OK" : row.error ?? "Failed"} tone={row.ok ? "success" : "danger"} /><Metric label="Message" value={row.message ?? "—"} /></div>;
  }
  if (resource === "clientIpDiagnostics") {
    const row = data as AdminResourcePayloads["clientIpDiagnostics"];
    return <div className="grid gap-3 p-4 sm:grid-cols-2"><Metric label="Resolved address" value={row.resolved ?? "—"} /><Metric label="Source" value={row.source} /><Metric label="Peer" value={row.peer ?? "—"} /><Metric label="Trusted proxy hops" value={row.config.trusted_proxy_hops} /></div>;
  }
  return null;
}
