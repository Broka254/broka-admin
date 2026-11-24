"use client";

import { ResourceState, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { AdminRequestError, useAdminDetail } from "@/hooks/use-admin-resource";
import { formatCount, formatDuration } from "@/lib/activity-format";
import { formatDateTime, formatShortDate } from "@/lib/format";

const END_REASON_LABELS: Record<string, string> = {
  logout: "Signed out on this device",
  revoked: "Ended by sign-out everywhere or a password change",
  suspended: "Ended by an account suspension",
  inactive: "Closed after 5 minutes without activity",
};

function endLabel(reason: string | null, open: boolean): string {
  if (open) return "Open now";
  if (!reason) return "Ended";
  return END_REASON_LABELS[reason] ?? reason;
}

/**
 * The activity record for one account, shown on its detail page. Every figure
 * is foreground time from heartbeats, so a device left open in the background
 * does not add to it.
 */
export function UserActivityPanel({ userId }: { userId: string }) {
  const profile = useAdminDetail("activityUserProfile", userId);
  const data = profile.data;

  if (profile.isLoading) {
    return <Skeleton className="h-48" />;
  }
  if (profile.isError || !data) {
    const error = profile.error;
    const notFound = error instanceof AdminRequestError && error.status === 404;
    return (
      <div className="data-panel p-5">
        <ResourceState
          state={notFound ? "empty" : "error"}
          message={error instanceof Error ? error.message : "Unable to load the activity record."}
        />
      </div>
    );
  }

  return (
    <section aria-label="Activity record" className="data-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-200">Activity record</p>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">
            Foreground time only: background requests are not counted. Periods before platform tracking began are not included, and are never shown as zero.
          </p>
        </div>
        <StatusBadge tone={data.user.is_online ? "success" : "neutral"}>{data.user.presence_label}</StatusBadge>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
          <dt className="text-[10px] uppercase tracking-[0.1em] text-slate-600">Sessions, all time</dt>
          <dd className="mt-1 font-display text-lg font-bold text-slate-100">{formatCount(data.totals.sessions)}</dd>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
          <dt className="text-[10px] uppercase tracking-[0.1em] text-slate-600">Time in app, all time</dt>
          <dd className="mt-1 font-display text-lg font-bold text-slate-100">{formatDuration(data.totals.foreground_seconds)}</dd>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
          <dt className="text-[10px] uppercase tracking-[0.1em] text-slate-600">Last 30 days</dt>
          <dd className="mt-1 font-display text-lg font-bold text-slate-100">
            {formatCount(data.last_30_days.active_days)} active {data.last_30_days.active_days === 1 ? "day" : "days"} · {formatDuration(data.last_30_days.foreground_seconds)}
          </dd>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
          <dt className="text-[10px] uppercase tracking-[0.1em] text-slate-600">Last active</dt>
          <dd className="mt-1 text-sm text-slate-200">{data.totals.last_active_at ? formatDateTime(data.totals.last_active_at) : "Never recorded"}</dd>
        </div>
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-slate-400">Recent sessions</p>
          <ul className="mt-2 divide-y divide-white/[0.05] rounded-lg border border-white/[0.06]">
            {data.recent_sessions.length ? data.recent_sessions.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="tabular-nums text-slate-300">{session.started_at ? formatDateTime(session.started_at) : "—"}</span>
                <span className="tabular-nums text-slate-400">{formatDuration(session.foreground_seconds)}</span>
                <span className="text-slate-500">{endLabel(session.end_reason, session.is_open)}</span>
              </li>
            )) : <li className="px-3 py-3 text-xs text-slate-500">No sessions recorded.</li>}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400">Daily foreground time, last 30 days</p>
          <ul className="mt-2 divide-y divide-white/[0.05] rounded-lg border border-white/[0.06]">
            {data.daily.length ? data.daily.map((day) => (
              <li key={day.date} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="tabular-nums text-slate-300">{formatShortDate(day.date)}</span>
                <span className="tabular-nums text-slate-400">{formatDuration(day.foreground_seconds)}</span>
              </li>
            )) : <li className="px-3 py-3 text-xs text-slate-500">No foreground activity in the last 30 days.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
