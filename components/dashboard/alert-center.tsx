"use client";

import { AlertTriangle, ArrowUpRight, Bell, CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";
import Link from "next/link";

import { buildAlerts } from "@/components/dashboard/command-center";
import { ResourceState, SectionEyebrow, StatusBadge, UnavailablePanel } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import { cn } from "@/lib/utils";

function generatedAt(value: string | null | undefined) {
  if (!value) return "timestamp unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "timestamp unavailable" : date.toLocaleString("en-KE");
}

export function AlertCenter() {
  const snapshot = useAdminResource("opsSnapshot");
  const health = useAdminResource("serviceHealth");
  const snapshotMissing = isEndpointMissing(snapshot.error);

  if (snapshot.isLoading) {
    return <div className="data-panel p-5"><ResourceState state="loading" message="Loading operational queues from the backend." /></div>;
  }

  if (!snapshot.data) {
    const unavailable = snapshotMissing ? "The deployed backend does not expose /admin/ops-snapshot yet (HTTP 404). No alert list is shown until the endpoint exists." : snapshot.error instanceof Error ? snapshot.error.message : "The operations snapshot is unavailable.";
    return <div className="space-y-6">
      <header className="border-b border-white/[0.07] pb-6">
        <SectionEyebrow>Operational awareness</SectionEyebrow>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">Alert Centre</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Live queue conditions derived from backend counts. There is no persisted alert, unread count or acknowledgement state until the backend provides one.</p>
      </header>
      <UnavailablePanel title={snapshotMissing ? "Alert source not deployed" : "Alert source unavailable"} detail={unavailable} />
    </div>;
  }

  const alerts = buildAlerts(snapshot.data, health.isError ? undefined : health.data);
  const critical = alerts.filter((alert) => alert.tone === "danger").length;
  const warnings = alerts.length - critical;

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <SectionEyebrow>Operational awareness</SectionEyebrow>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">Alert Centre</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Every item below is derived from the live operations snapshot and validated service-health checks. No unread count, notification delivery or acknowledgement state is shown because the backend does not record them yet.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {critical ? <StatusBadge tone="danger">{critical} critical</StatusBadge> : <StatusBadge tone="success">No critical queues</StatusBadge>}
        {warnings ? <StatusBadge tone="warning">{warnings} warning{warnings === 1 ? "" : "s"}</StatusBadge> : null}
        <button onClick={() => { void snapshot.refetch(); void health.refetch(); }} disabled={snapshot.isFetching} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white disabled:opacity-50"><RefreshCw size={13} className={snapshot.isFetching ? "animate-spin" : ""} aria-hidden="true" />Refresh</button>
      </div>
    </header>

    <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4 text-xs leading-5 text-slate-400">
      <p><span className="font-semibold text-cyan-100">Snapshot generated:</span> {generatedAt(snapshot.data.generated_at)}. Window: {snapshot.data.window_hours}h.</p>
      <p className="mt-1">This is a derived view, not the planned persisted Admin Alert Centre. Required backend work is documented in <code className="rounded bg-white/[0.05] px-1.5 py-0.5 text-slate-300">docs/NOTIFICATION_CONTRACTS.md</code>.</p>
      {health.isError ? <p className="mt-1 text-amber-200">Service-health checks are unavailable, so only queue-derived alerts are shown.</p> : null}
    </div>

    {alerts.length ? <section aria-label="Operational alerts" className="grid gap-3 xl:grid-cols-2">
      {alerts.map((alert) => <article key={alert.id} className={cn("flex flex-col gap-4 rounded-xl border p-5", alert.tone === "danger" ? "border-rose-400/25 bg-rose-400/[0.05]" : "border-amber-300/20 bg-amber-300/[0.04]")}>
        <div className="flex items-start gap-3">
          <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border", alert.tone === "danger" ? "border-rose-300/25 bg-rose-400/10 text-rose-200" : "border-amber-300/25 bg-amber-300/10 text-amber-200")}>{alert.tone === "danger" ? <AlertTriangle size={17} aria-hidden="true" /> : <CircleAlert size={17} aria-hidden="true" />}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={alert.tone}>{alert.tone}</StatusBadge><span className="text-[11px] text-slate-500">Snapshot {generatedAt(snapshot.data.generated_at)}</span></div>
            <p className="mt-2 text-sm font-semibold text-slate-100">{alert.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{alert.detail}</p>
          </div>
        </div>
        <Link href={alert.href} className="focus-ring mt-auto inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.025] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-[#8b75ff]/40 hover:text-[#ded8ff]">{alert.cta}<ArrowUpRight size={13} aria-hidden="true" /></Link>
      </article>)}
    </section> : <div className="data-panel flex items-center gap-3 p-5"><span className="grid h-10 w-10 place-items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"><CheckCircle2 size={18} aria-hidden="true" /></span><div><p className="text-sm font-semibold text-slate-100">No derived alert queues are active</p><p className="mt-1 text-xs text-slate-400">The snapshot reports no unresolved escrow, refund, dispute, fraud, payment or media queues, and the available health checks passed.</p></div></div>}

    <div className="flex items-center gap-2 text-[11px] text-slate-600"><Bell size={13} aria-hidden="true" />No bell badge or unread indicator is rendered: those values are not instrumented by the backend.</div>
  </div>;
}
