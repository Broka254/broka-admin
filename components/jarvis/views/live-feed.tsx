"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Segmented } from "@/components/intelligence/visuals";
import { EmptyNote, FreshnessTag, GlassPanel, PageHeading, SectionHeader, SignalCard } from "@/components/jarvis/ui/primitives";
import { Skeleton } from "@/components/ui/primitives";
import { useAdminAlerts } from "@/hooks/use-alerts";
import { useAlertsStream, type StreamStatus } from "@/hooks/use-alerts-stream";
import { useAdminResource } from "@/hooks/use-admin-resource";
import type { AdminAlert } from "@/lib/api/schemas";
import { isInternalHref } from "@/lib/intelligence";
import { attentionInsights, formatServerInstant, severityTone } from "@/lib/jarvis/command-centre";
import { cn } from "@/lib/utils";

/**
 * Alerts from the backend with their live status. An alert is "Live" only if
 * it arrived after this view mounted: its id was absent from the baseline,
 * which is the first response fetched after mounting. Cached data from an
 * earlier visit never sets the baseline, because alerts may have arrived since.
 * The browser clock is never compared with the server's created_at.
 */
export function useLiveAlerts(limit = 50) {
  const alerts = useAdminAlerts({ status: "all", limit });
  const stream = useAlertsStream();
  const baseline = useRef<Set<number> | null>(null);
  const [liveIds, setLiveIds] = useState<ReadonlySet<number>>(() => new Set());

  useEffect(() => {
    const items = alerts.data?.items;
    if (!items || !alerts.isFetchedAfterMount) return;
    if (baseline.current === null) {
      baseline.current = new Set(items.map((item) => item.id));
      return;
    }
    const known = baseline.current;
    const fresh = items.filter((item) => !known.has(item.id)).map((item) => item.id);
    if (fresh.length === 0) return;
    fresh.forEach((id) => known.add(id));
    setLiveIds((current) => new Set([...current, ...fresh]));
  }, [alerts.data, alerts.isFetchedAfterMount]);

  return { alerts, streamStatus: stream.status, liveIds };
}

export const STREAM_TAG: Record<StreamStatus, { kind: "live" | "checking" | "unavailable"; label: string }> = {
  connected: { kind: "live", label: "Live stream connected" },
  connecting: { kind: "checking", label: "Connecting to the live stream" },
  offline: { kind: "unavailable", label: "Stream offline: refreshing every 15 seconds" },
};

const SEVERITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "info", label: "Info" },
] as const;

type SeverityFilter = (typeof SEVERITY_FILTERS)[number]["value"];

export function AlertRow({ alert, live }: { alert: AdminAlert; live: boolean }) {
  const href = alert.href && isInternalHref(alert.href) ? alert.href : null;
  const tone = severityTone(alert.severity);
  return (
    <li className={cn("jv-glass flex flex-col gap-2 p-4", live && "border-cyan-300/30")}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
            tone === "danger"
              ? "border-rose-400/35 bg-rose-400/10 text-rose-200"
              : tone === "warning"
                ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                : "border-white/12 bg-white/[0.04] text-slate-300",
          )}
        >
          {alert.severity}
        </span>
        <span className="text-[11px] capitalize text-slate-500">{alert.status}</span>
        <span className="ml-auto">
          <FreshnessTag kind={live ? "live" : "recorded"} label={live ? "Live" : "Recorded"} />
        </span>
      </div>
      <p className="text-sm font-semibold leading-5 text-slate-100">{alert.title}</p>
      {alert.body ? <p className="line-clamp-3 text-sm leading-6 text-slate-400">{alert.body}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          {alert.kind} · {formatServerInstant(alert.created_at)}
        </span>
        {href ? (
          <Link href={href} className="focus-ring inline-flex items-center gap-1 rounded-md font-semibold text-slate-300 hover:text-white">
            Open <ArrowUpRight size={11} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/** Live Intelligence Feed: backend alerts as they arrive, plus the command centre's snapshot signals. */
export function LiveFeedView() {
  const { alerts, streamStatus, liveIds } = useLiveAlerts();
  const centre = useAdminResource("commandCenter");
  const [severity, setSeverity] = useState<SeverityFilter>("all");

  const items = alerts.data?.items ?? [];
  const visible = severity === "all" ? items : items.filter((item) => item.severity === severity);
  const stream = STREAM_TAG[streamStatus];
  const updatedIso = alerts.dataUpdatedAt > 0 ? new Date(alerts.dataUpdatedAt).toISOString() : null;
  const snapshotSignals = attentionInsights(centre.data).slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Jarvis Mode · Live"
        title="Live Intelligence Feed"
        description="Backend alerts, newest first. An alert that arrives while this page is open is marked Live. Everything else is recorded history. Nothing on this page is simulated."
        meta={
          <>
            <FreshnessTag kind={stream.kind} label={stream.label} />
            {updatedIso ? <FreshnessTag kind="snapshot" label="Last updated" at={updatedIso} /> : null}
          </>
        }
      />

      {/* A narrow screen scrolls the filter inside its own box, so the page itself never overflows. */}
      <div className="max-w-full overflow-x-auto pb-1">
        <Segmented value={severity} options={[...SEVERITY_FILTERS]} onChange={setSeverity} label="Filter by severity" />
      </div>

      {alerts.isPending ? (
        <div aria-busy="true" className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      ) : alerts.error ? (
        <EmptyNote>The alerts could not be loaded. The feed retries when the connection returns.</EmptyNote>
      ) : visible.length === 0 ? (
        <EmptyNote>
          {items.length === 0 ? "The backend has no alerts recorded." : `No alerts at ${severity} severity.`}
        </EmptyNote>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" aria-label="Alerts">
          {visible.map((alert) => (
            <AlertRow key={alert.id} alert={alert} live={liveIds.has(alert.id)} />
          ))}
        </ul>
      )}

      <GlassPanel labelledBy="snapshot-signals-title" className="space-y-4">
        <SectionHeader
          id="snapshot-signals-title"
          eyebrow="Snapshot"
          title="Significant business changes"
          description="Signals from the command centre snapshot. They change when the snapshot is regenerated, not in real time."
          meta={centre.data ? <FreshnessTag kind="snapshot" label="Snapshot" at={centre.data.generated_at} /> : null}
        />
        {centre.isPending ? (
          <Skeleton className="h-32" />
        ) : centre.error || !centre.data ? (
          <EmptyNote>The command centre snapshot could not be loaded.</EmptyNote>
        ) : snapshotSignals.length === 0 ? (
          <EmptyNote>No critical or warning signal is raised in the current snapshot.</EmptyNote>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {snapshotSignals.map((insight) => (
              <SignalCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}
        {centre.data ? (
          <p className="text-[11px] text-slate-600">Snapshot generated {formatServerInstant(centre.data.generated_at)}</p>
        ) : null}
      </GlassPanel>
    </div>
  );
}
