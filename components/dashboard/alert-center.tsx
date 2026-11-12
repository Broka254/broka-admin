"use client";

import { AlertTriangle, ArrowUpRight, BellRing, CheckCircle2, CircleAlert, Info, RefreshCw, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useAdminAlerts, useAcknowledgeAlert, useResolveAlert } from "@/hooks/use-alerts";
import { useAlertsStream } from "@/hooks/use-alerts-stream";
import { AdminRequestError, isEndpointMissing } from "@/hooks/use-admin-resource";
import { DataFreshness, PageHeader, Panel } from "@/components/intelligence/visuals";
import { InfoTip } from "@/components/ui/tooltip";
import { ResourceState, StatusBadge, UnavailablePanel } from "@/components/ui/primitives";
import type { AdminAlert } from "@/lib/api/schemas";
import { relativeTime } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

function severityTone(severity: AdminAlert["severity"]): "danger" | "warning" | "info" | "neutral" {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  if (severity === "low") return "info";
  return "neutral";
}

function AlertCard({ alert }: { alert: AdminAlert }) {
  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();
  const [confirmingResolve, setConfirmingResolve] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = acknowledge.isPending || resolve.isPending;

  async function onAcknowledge() {
    setActionError(null);
    try {
      await acknowledge.mutateAsync({ id: alert.id });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Acknowledgement failed.");
    }
  }

  async function onResolve() {
    setActionError(null);
    try {
      await resolve.mutateAsync({ id: alert.id });
      setConfirmingResolve(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Resolution failed.");
    }
  }

  const Icon = alert.severity === "critical" || alert.severity === "high" ? AlertTriangle : alert.severity === "info" ? Info : CircleAlert;
  const tone = severityTone(alert.severity);
  return (
    <article className={cn("insight-card relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 pl-5", tone === "danger" ? "border-rose-400/25 bg-rose-400/[0.045]" : tone === "warning" ? "border-amber-300/20 bg-amber-300/[0.035]" : "border-white/[0.08] bg-white/[0.02]")}>
      <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", tone === "danger" ? "bg-rose-400 shadow-[0_0_20px_rgba(251,113,133,0.5)]" : tone === "warning" ? "bg-amber-300" : "bg-slate-500")} aria-hidden="true" />
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border", tone === "danger" ? "border-rose-300/25 bg-rose-400/10 text-rose-200" : tone === "warning" ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-cyan-300/20 bg-cyan-300/10 text-cyan-200")}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={tone}>{alert.severity}</StatusBadge>
            <StatusBadge tone={alert.status === "open" ? "warning" : alert.status === "acknowledged" ? "info" : "success"}>{alert.status}</StatusBadge>
            <span className="text-[10px] text-slate-500">{relativeTime(alert.created_at)}</span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-snug text-slate-100">{alert.title}</p>
          {alert.body ? <p className="mt-1 text-[11px] leading-5 text-slate-400">{alert.body}</p> : null}
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600"><span className="rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 font-mono">{alert.kind}</span>{alert.acknowledged_by ? <span>acknowledged by <span className="font-mono text-slate-500">{alert.acknowledged_by}</span></span> : <span>not acknowledged</span>}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/[0.055] pt-2.5">
        {alert.href ? <Link href={alert.href} className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-[#8b75ff]/40 hover:text-[#ded8ff]">Open record <ArrowUpRight size={11} aria-hidden="true" /></Link> : null}
        {alert.status === "open" ? <button onClick={onAcknowledge} disabled={busy} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-300/20 disabled:opacity-50">{acknowledge.isPending ? "Acknowledging…" : "Acknowledge"}</button> : null}
        {alert.status !== "resolved" ? (
          confirmingResolve ? (
            <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] text-emerald-200">
              Resolve this alert?
              <button onClick={onResolve} disabled={busy} className="focus-ring font-semibold underline disabled:opacity-50">{resolve.isPending ? "Resolving…" : "Confirm"}</button>
              <button onClick={() => setConfirmingResolve(false)} disabled={busy} className="focus-ring text-slate-400 hover:text-slate-200">Cancel</button>
            </span>
          ) : <button onClick={() => setConfirmingResolve(true)} disabled={busy} className="focus-ring rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50">Resolve</button>
        ) : null}
      </div>
      {actionError ? <p className="text-[11px] text-rose-200" role="alert">{actionError}</p> : null}
    </article>
  );
}

export function AlertCenter() {
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("open");
  const alerts = useAdminAlerts({ severity, status, limit: 50, offset: 0 });
  const stream = useAlertsStream();

  if (alerts.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Operational awareness" title="Alert Centre" description="Persisted admin alerts with acknowledgement and resolution." icon={<BellRing size={14} />} />
        <div className="data-panel p-5"><ResourceState state="loading" message="Loading the persisted alert feed from the backend." /></div>
      </div>
    );
  }

  const error = alerts.error instanceof AdminRequestError ? alerts.error : null;
  if (alerts.isError) {
    if (isEndpointMissing(alerts.error)) {
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Operational awareness" title="Alert Centre" description="Persisted admin alerts with acknowledgement and resolution." icon={<BellRing size={14} />} meta={<DataFreshness label="Persisted alert feed" state="unavailable" source="GET /admin/alerts is not served by this backend yet." />} actions={<StatusBadge tone="warning">Backend upgrade required</StatusBadge>} />
          <UnavailablePanel title="Alert source not deployed" detail="The deployed backend does not expose GET /admin/alerts yet (HTTP 404). The feed activates automatically after the backend upgrade." />
        </div>
      );
    }
    if (error?.status === 401) return <div className="data-panel p-5"><ResourceState state="unauthorized" message="Your session has expired. Returning to sign in…" /></div>;
    if (error?.status === 403) return <div className="data-panel p-5"><ResourceState state="forbidden" message="Your BROKA account is not authorized for the alert feed." /></div>;
    return <div className="data-panel p-5"><ResourceState state="error" message={alerts.error instanceof Error ? alerts.error.message : "Unable to load alerts."} action={<button onClick={() => alerts.refetch()} className="focus-ring rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-200">Retry</button>} /></div>;
  }

  const items = alerts.data?.items ?? [];
  const unread = alerts.data?.unread ?? 0;
  const critical = items.filter((alert) => alert.severity === "critical" || alert.severity === "high").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operational awareness"
        title="Alert Centre"
        description="Persisted admin alerts from the backend reconciliation bridge. Acknowledgement and resolution are audited; an unacknowledged alert is never the same as a resolved one."
        icon={<BellRing size={14} />}
        meta={<DataFreshness
          label="Persisted alert feed"
          state={alerts.isLoading ? "loading" : alerts.isError ? "error" : "ready"}
          windowLabel={`${items.length} in view · ${status} / ${severity}`}
          source="GET /admin/alerts for the persisted ledger. SSE stream state is reported separately and does not prove backend health."
        />}
        actions={<>
          <span className="inline-flex items-center gap-1"><StatusBadge tone={stream.status === "connected" ? "success" : stream.status === "connecting" ? "warning" : "neutral"}>{stream.status === "connected" ? "Live" : stream.status === "connecting" ? "Connecting" : "Offline"}</StatusBadge><InfoTip label="Live alert stream">Alerts stream over SSE and replay on reconnect. Offline falls back to polling; it does not mean the backend is healthy or unhealthy.</InfoTip></span>
          {unread > 0 ? <StatusBadge tone="info">{unread} unread</StatusBadge> : <StatusBadge tone="success">All read</StatusBadge>}
          <button onClick={() => alerts.refetch()} disabled={alerts.isFetching} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white disabled:opacity-50"><RefreshCw size={13} className={alerts.isFetching ? "animate-spin" : ""} aria-hidden="true" />Refresh</button>
        </>}
      />

      <section className="grid grid-cols-3 gap-3" aria-label="Alert summary">
        <div className="stat-tile"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">In view</p><p className="mt-2 font-display text-2xl font-bold tabular-nums text-white">{items.length}</p><p className="mt-1 text-[10px] text-slate-500">{status === "all" ? "all statuses" : status} · {severity === "all" ? "all severities" : severity}</p></div>
        <div className="stat-tile"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">High / critical</p><p className="mt-2 font-display text-2xl font-bold tabular-nums text-rose-300">{critical}</p><p className="mt-1 text-[10px] text-slate-500">in the current filter</p></div>
        <div className="stat-tile"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Unread</p><p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#ded8ff]">{unread}</p><p className="mt-1 text-[10px] text-slate-500">per the persisted feed</p></div>
      </section>

      <section className="data-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center" aria-label="Alert filters">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"><SlidersHorizontal size={12} aria-hidden="true" />Filters</span>
        <label className="inline-flex items-center gap-2 text-xs text-slate-400">Severity
          <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="focus-ring rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs font-semibold text-slate-200 outline-none [&>option]:bg-[#0b0e1a]">
            {["all", "critical", "high", "medium", "low", "info"].map((value) => <option key={value} value={value}>{value === "all" ? "All severities" : value}</option>)}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-slate-400">Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="focus-ring rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs font-semibold text-slate-200 outline-none [&>option]:bg-[#0b0e1a]">
            {["all", "open", "acknowledged", "resolved"].map((value) => <option key={value} value={value}>{value === "all" ? "All statuses" : value}</option>)}
          </select>
        </label>
        <p className="ml-auto hidden text-[10px] text-slate-600 lg:block">Acknowledge records review; resolve closes the alert. Both actions carry an idempotency key.</p>
      </section>

      {items.length ? (
        <section aria-label="Alerts" className="grid gap-3 xl:grid-cols-2">
          {items.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
        </section>
      ) : (
        <Panel eyebrow="Clear" title="Nothing waiting in this view">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"><CheckCircle2 size={18} aria-hidden="true" /></span>
            <div><p className="text-sm font-semibold text-slate-100">No alerts match these filters</p><p className="mt-1 text-xs text-slate-400">The persisted feed returned zero rows for this severity and status selection.</p></div>
          </div>
        </Panel>
      )}
    </div>
  );
}
