"use client";

import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleAlert, Info, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useAdminAlerts, useAcknowledgeAlert, useResolveAlert } from "@/hooks/use-alerts";
import { useAlertsStream } from "@/hooks/use-alerts-stream";
import { AdminRequestError, isEndpointMissing } from "@/hooks/use-admin-resource";
import { ResourceState, SectionEyebrow, StatusBadge, UnavailablePanel } from "@/components/ui/primitives";
import type { AdminAlert } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";

function relativeTime(value: string | null | undefined): string {
  if (!value) return "timestamp unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "timestamp unavailable";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleString("en-KE");
}

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
    <article className={cn("flex flex-col gap-4 rounded-xl border p-5", tone === "danger" ? "border-rose-400/25 bg-rose-400/[0.05]" : tone === "warning" ? "border-amber-300/20 bg-amber-300/[0.04]" : "border-white/[0.08] bg-white/[0.02]")}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border", tone === "danger" ? "border-rose-300/25 bg-rose-400/10 text-rose-200" : tone === "warning" ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-cyan-300/20 bg-cyan-300/10 text-cyan-200")}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone}>{alert.severity}</StatusBadge>
            <StatusBadge tone={alert.status === "open" ? "warning" : alert.status === "acknowledged" ? "info" : "success"}>{alert.status}</StatusBadge>
            <span className="text-[11px] text-slate-500">{relativeTime(alert.created_at)}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-100">{alert.title}</p>
          {alert.body ? <p className="mt-1 text-xs leading-5 text-slate-400">{alert.body}</p> : null}
          <p className="mt-1 text-[11px] text-slate-600">kind: {alert.kind}{alert.acknowledged_by ? ` · ack by ${alert.acknowledged_by}` : ""}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {alert.href ? <Link href={alert.href} className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.025] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-[#8b75ff]/40 hover:text-[#ded8ff]">Open record<ArrowUpRight size={13} aria-hidden="true" /></Link> : null}
        {alert.status === "open" ? <button onClick={onAcknowledge} disabled={busy} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/20 disabled:opacity-50">{acknowledge.isPending ? "Acknowledging…" : "Acknowledge"}</button> : null}
        {alert.status !== "resolved" ? (
          confirmingResolve ? (
            <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200">
              Resolve this alert?
              <button onClick={onResolve} disabled={busy} className="focus-ring font-semibold underline disabled:opacity-50">{resolve.isPending ? "Resolving…" : "Confirm"}</button>
              <button onClick={() => setConfirmingResolve(false)} disabled={busy} className="focus-ring text-slate-400 hover:text-slate-200">Cancel</button>
            </span>
          ) : (
            <button onClick={() => setConfirmingResolve(true)} disabled={busy} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50">Resolve</button>
          )
        ) : null}
      </div>
      {actionError ? <p className="text-xs text-rose-200" role="alert">{actionError}</p> : null}
    </article>
  );
}

export function AlertCenter() {
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("open");
  const alerts = useAdminAlerts({ severity, status, limit: 50, offset: 0 });
  const stream = useAlertsStream();

  if (alerts.isLoading) {
    return <div className="data-panel p-5"><ResourceState state="loading" message="Loading the persisted alert feed from the backend." /></div>;
  }

  const error = alerts.error instanceof AdminRequestError ? alerts.error : null;
  if (alerts.isError) {
    if (isEndpointMissing(alerts.error)) {
      return (
        <div className="space-y-6">
          <header className="border-b border-white/[0.07] pb-6">
            <SectionEyebrow>Operational awareness</SectionEyebrow>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">Alert Centre</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">The persisted alert feed is not deployed on this backend yet.</p>
          </header>
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionEyebrow>Operational awareness</SectionEyebrow>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">Alert Centre</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Persisted admin alerts with acknowledgement and resolution. {unread > 0 ? `${unread} unread.` : "Nothing unread."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={stream.status === "connected" ? "success" : stream.status === "connecting" ? "warning" : "neutral"}>{stream.status === "connected" ? "Live" : stream.status === "connecting" ? "Connecting" : "Offline"}</StatusBadge>
          {unread > 0 ? <StatusBadge tone="info">{unread} unread</StatusBadge> : <StatusBadge tone="success">All read</StatusBadge>}
          <button onClick={() => alerts.refetch()} disabled={alerts.isFetching} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white disabled:opacity-50"><RefreshCw size={13} className={alerts.isFetching ? "animate-spin" : ""} aria-hidden="true" />Refresh</button>
        </div>
      </header>

      <section className="data-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center" aria-label="Alert filters">
        <label className="inline-flex items-center gap-2 text-xs text-slate-400">Severity
          <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs font-semibold text-slate-200 outline-none [&>option]:bg-[#0b0e1a]">
            {["all", "critical", "high", "medium", "low", "info"].map((value) => <option key={value} value={value}>{value === "all" ? "All severities" : value}</option>)}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-slate-400">Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs font-semibold text-slate-200 outline-none [&>option]:bg-[#0b0e1a]">
            {["all", "open", "acknowledged", "resolved"].map((value) => <option key={value} value={value}>{value === "all" ? "All statuses" : value}</option>)}
          </select>
        </label>
      </section>

      {items.length ? (
        <section aria-label="Alerts" className="grid gap-3 xl:grid-cols-2">
          {items.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
        </section>
      ) : (
        <div className="data-panel flex items-center gap-3 p-5">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"><CheckCircle2 size={18} aria-hidden="true" /></span>
          <div><p className="text-sm font-semibold text-slate-100">No alerts match these filters</p><p className="mt-1 text-xs text-slate-400">The persisted feed returned zero rows for this severity and status selection.</p></div>
        </div>
      )}
    </div>
  );
}
