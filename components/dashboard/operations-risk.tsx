"use client";

import { AlertTriangle, ArrowUpRight, BadgeCheck, BellRing, CircleAlert, HeartPulse, MessageSquareWarning, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { buildAlerts } from "@/components/dashboard/command-center";
import { Panel } from "@/components/intelligence/visuals";
import { ResourceState, StatusBadge } from "@/components/ui/primitives";
import { useAdminAlerts } from "@/hooks/use-alerts";
import { isEndpointMissing } from "@/hooks/use-admin-resource";
import type { AdminResourcePayloads, AdminAlert } from "@/lib/api/schemas";
import type { Pulse } from "@/lib/api/intelligence-schemas";
import { formatCount, formatDuration, relativeTime } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

type Snapshot = AdminResourcePayloads["opsSnapshot"];
type Health = AdminResourcePayloads["serviceHealth"];
type SnapshotState = "loading" | "ready" | "error" | "not-deployed" | "unavailable";
type HealthState = "loading" | "ready" | "error" | "not-deployed" | "unavailable";

const SEVERITY_TONE: Record<AdminAlert["severity"], "danger" | "warning" | "info" | "neutral"> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "neutral",
};

function RiskRow({ tone, icon, title, detail, href, cta }: {
  tone: "danger" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  detail: string;
  href: string;
  cta: string;
}) {
  return (
    <li className={cn("flex flex-col gap-2.5 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between", tone === "danger" ? "border-rose-400/20 bg-rose-400/[0.045]" : tone === "warning" ? "border-amber-300/18 bg-amber-300/[0.035]" : "border-cyan-300/15 bg-cyan-300/[0.03]")}>
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border", tone === "danger" ? "border-rose-300/25 bg-rose-400/10 text-rose-200" : tone === "warning" ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-cyan-300/20 bg-cyan-300/10 text-cyan-200")}>{icon}</span>
        <div className="min-w-0">
          <p className="break-words text-xs font-semibold text-slate-100">{title}</p>
          <p className="mt-0.5 break-words text-[11px] leading-4 text-slate-400">{detail}</p>
        </div>
      </div>
      <Link href={href} className="focus-ring inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-white/[0.09] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold text-slate-200 transition hover:border-[#8b75ff]/40 hover:text-[#ded8ff] sm:self-center">{cta}<ArrowUpRight size={11} aria-hidden="true" /></Link>
    </li>
  );
}

export function OperationsAndRisk({ snapshot, health, pulse, snapshotState, healthState }: {
  snapshot?: Snapshot;
  health?: Health;
  pulse?: Pulse;
  snapshotState: SnapshotState;
  healthState: HealthState;
}) {
  const persisted = useAdminAlerts({ status: "open", limit: 4, offset: 0 });
  const derived = snapshot ? buildAlerts(snapshot, health) : [];
  const critical = derived.filter((alert) => alert.tone === "danger");
  const warnings = derived.filter((alert) => alert.tone === "warning");
  const complaints = pulse?.complaints;
  const unhealthy = health?.checks.filter((check) => check.status === "error" || check.status === "degraded") ?? [];
  const alertsMissing = isEndpointMissing(persisted.error);
  const lifecycle = persisted.data?.items ?? [];

  return (
    <Panel
      eyebrow="Operations & risk"
      title="What needs attention now"
      description="Live queue counts, persisted alerts and complaint deadlines. Every warning below links to the surface that can act on it."
      actions={<>
        {critical.length ? <StatusBadge tone="danger">{critical.length} critical</StatusBadge> : <StatusBadge tone="success">No critical queues</StatusBadge>}
        {warnings.length ? <StatusBadge tone="warning">{warnings.length} warning{warnings.length === 1 ? "" : "s"}</StatusBadge> : null}
      </>}
    >
      {!snapshot ? (
        <ResourceState
          state={snapshotState === "loading" ? "loading" : snapshotState === "not-deployed" ? "unavailable" : "error"}
          message={snapshotState === "loading"
            ? "Loading live operational queues from /admin/ops-snapshot…"
            : snapshotState === "not-deployed"
              ? "The deployed backend does not expose /admin/ops-snapshot yet (HTTP 404). Queue alerts activate after the backend upgrade; nothing is estimated."
              : "The ops snapshot is unavailable. Queue alerting is paused until the backend responds."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Operational queue</p>
              <span className="text-[10px] text-slate-600">window {snapshot.window_hours}h · no estimates</span>
            </div>
            {derived.length ? (
              <ul className="space-y-2">
                {derived.slice(0, 6).map((alert) => (
                  <RiskRow
                    key={alert.id}
                    tone={alert.tone === "danger" ? "danger" : "warning"}
                    icon={alert.tone === "danger" ? <AlertTriangle size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}
                    title={alert.title}
                    detail={alert.detail}
                    href={alert.href}
                    cta={alert.cta}
                  />
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-3.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-300/25 bg-emerald-400/10 text-emerald-200"><BadgeCheck size={15} aria-hidden="true" /></span>
                <div><p className="text-xs font-semibold text-slate-100">All operational queues report zero</p><p className="mt-0.5 text-[11px] text-slate-400">Escrow, refunds, disputes, fraud, payments and media backlogs are clear.</p></div>
              </div>
            )}
            {snapshotState !== "ready" ? <p className="mt-2 text-[10px] text-slate-600">Snapshot generation: {snapshotState}.</p> : null}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="inset-panel p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Persisted alerts</p>
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><BellRing size={11} aria-hidden="true" />{persisted.data ? `${formatCount(persisted.data.unread)} unread` : "—"}</span>
              </div>
              {persisted.isLoading ? <p className="mt-2 text-[11px] text-slate-500">Reading the alert ledger…</p> : alertsMissing ? (
                <p className="mt-2 text-[11px] leading-4 text-slate-500">The persisted alert feed is not deployed on this backend (HTTP 404). Derived queue warnings above remain live.</p>
              ) : persisted.isError ? (
                <div className="mt-2 flex items-center justify-between gap-2"><p className="text-[11px] text-rose-200">Alert ledger unavailable.</p><button type="button" onClick={() => void persisted.refetch()} className="focus-ring inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300"><RefreshCw size={10} aria-hidden="true" />Retry</button></div>
              ) : lifecycle.length ? (
                <ul className="mt-2 space-y-1.5">
                  {lifecycle.map((alert) => (
                    <li key={alert.id} className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.055] bg-black/20 px-2.5 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-slate-200">{alert.title}</p>
                        <p className="mt-0.5 text-[10px] text-slate-600">{relativeTime(alert.created_at)} · {alert.status}</p>
                      </div>
                      <StatusBadge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</StatusBadge>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-[11px] text-slate-500">No open persisted alerts.</p>}
              <Link href="/alerts" className="focus-ring mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#a895ff] hover:text-[#ded8ff]">Open Alert Centre <ArrowUpRight size={10} aria-hidden="true" /></Link>
            </div>

            <div className="inset-panel p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Trust & service</p>
                <HeartPulse size={12} className={unhealthy.length ? "text-rose-300" : "text-emerald-300"} aria-hidden="true" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <Link href="/complaints?queue=overdue" className="focus-ring rounded-lg border border-white/[0.055] bg-black/20 px-2.5 py-2 hover:border-rose-400/30">
                  <p className="text-slate-500">Past deadline</p>
                  <p className={cn("mt-0.5 font-semibold tabular-nums", complaints?.sla_breached ? "text-rose-300" : "text-emerald-300")}>{formatCount(complaints?.sla_breached)}</p>
                </Link>
                <Link href="/complaints?queue=unanswered" className="focus-ring rounded-lg border border-white/[0.055] bg-black/20 px-2.5 py-2 hover:border-amber-300/30">
                  <p className="text-slate-500">Unanswered</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-amber-200">{formatCount(complaints?.unanswered)}</p>
                </Link>
                <Link href="/complaints?queue=unanswered" className="focus-ring rounded-lg border border-white/[0.055] bg-black/20 px-2.5 py-2 hover:border-cyan-300/30">
                  <p className="text-slate-500">Oldest waiting</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-cyan-200">{formatDuration(complaints?.oldest_unanswered_hours)}</p>
                </Link>
                <Link href="/service-health" className="focus-ring rounded-lg border border-white/[0.055] bg-black/20 px-2.5 py-2 hover:border-[#8b75ff]/30">
                  <p className="text-slate-500">Dependency checks</p>
                  <p className={cn("mt-0.5 font-semibold tabular-nums", unhealthy.length ? "text-rose-300" : health ? "text-emerald-300" : "text-slate-500")}>{health ? (unhealthy.length ? `${unhealthy.length} failing` : "All clear") : healthState === "not-deployed" ? "Not deployed" : "—"}</p>
                </Link>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-600"><MessageSquareWarning size={10} aria-hidden="true" />First-reply deadlines: urgent 4h · high 24h · normal 72h · low 5 days</p>
            </div>
          </div>
        </div>
      )}
      {healthState === "error" || healthState === "not-deployed" ? (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500"><ShieldAlert size={11} aria-hidden="true" />{healthState === "not-deployed" ? "Service health probe not deployed (HTTP 404)." : "Service health probe did not respond; durable queue counts above are unaffected."} <Link href="/service-health" className="focus-ring font-semibold text-amber-200/80 hover:text-amber-100">Inspect</Link></p>
      ) : null}
    </Panel>
  );
}
