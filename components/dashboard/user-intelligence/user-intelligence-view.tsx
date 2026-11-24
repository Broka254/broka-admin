"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DataTable, type Column } from "@/components/dashboard/data-table";
import { DataFreshness, PageHeader, Panel, Segmented, StatTile } from "@/components/intelligence/visuals";
import { ResourceState, Skeleton, StatusBadge, UnavailablePanel } from "@/components/ui/primitives";
import { AdminRequestError, useAdminResource } from "@/hooks/use-admin-resource";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTimeseries } from "@/hooks/use-timeseries";
import { useUrlDateRange } from "@/hooks/use-url-date-range";
import { useActivityUsers } from "@/hooks/use-user-intelligence";
import {
  coverageNote,
  formatCount,
  formatDuration,
  formatPercent,
  formatRatio,
  utcRangeEndingToday,
} from "@/lib/activity-format";
import type { DateRangeSelection } from "@/lib/date-range";
import { formatShortDate } from "@/lib/format";
import type { ActivityUserRow } from "@/lib/api/schemas";

const PAGE_SIZE = 50;
const WINDOW_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

type QueryState = "loading" | "ready" | "error" | "unavailable";

function stateOf(query: { isLoading: boolean; isError: boolean; error: unknown }): QueryState {
  if (query.isLoading) return "loading";
  if (query.isError) return query.error instanceof AdminRequestError && query.error.status === 404 ? "unavailable" : "error";
  return "ready";
}

function messageOf(error: unknown): string {
  if (error instanceof AdminRequestError && error.status === 404) {
    return "This figure needs the upgraded backend. The live API does not serve this endpoint yet.";
  }
  return error instanceof Error ? error.message : "Unable to load this figure.";
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function windowFallback(): DateRangeSelection {
  const { from, to } = utcRangeEndingToday(30);
  return { from, to, bucket: "day" };
}

function LiveStrip() {
  const live = useAdminResource("activityLive");
  const state = stateOf(live);
  const data = live.data;
  if (state === "loading") return <Skeleton className="h-28" />;
  if (state !== "ready" || !data) {
    return <ResourceState state={state === "unavailable" ? "unavailable" : "error"} message={messageOf(live.error)} />;
  }
  return (
    <section aria-label="Live activity" className="space-y-3">
      <DataFreshness
        label="Live query, refreshed every 30 seconds while this tab is visible"
        generatedAt={data.generated_at}
        state="ready"
        windowLabel={`presence window ${Math.round(data.presence_window_seconds / 60)} min`}
        source="Active = an open session whose last foreground heartbeat is inside the presence window. Background activity is not counted."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Active accounts now"
          value={formatCount(data.active_users_now)}
          caption={`${formatCount(data.active_sessions_now)} signed-in sessions`}
          hint="Distinct accounts with an open session that sent a foreground heartbeat in the presence window."
        />
        <StatTile
          label="Active in last 5 min"
          value={formatCount(data.active_users.last_5m)}
          caption={`${formatPercent(data.active_user_percentage.last_5m)} of ${formatCount(data.registered_users)} registered`}
          hint="Share = active accounts ÷ registered accounts (created on or before now)."
        />
        <StatTile
          label="Active in last 60 min"
          value={formatCount(data.active_users.last_60m)}
          caption={`${formatPercent(data.active_user_percentage.last_60m)} of registered`}
          hint="Accounts with a foreground heartbeat in the last hour."
        />
        <StatTile
          label="Peak concurrent, 24 h"
          value={formatCount(data.peak_concurrent_users_24h.value)}
          caption={data.peak_concurrent_users_24h.value === null
            ? "No samples in the last 24 hours"
            : `Sampled every ${data.peak_concurrent_users_24h.sample_interval_seconds}s; ${formatCount(data.peak_concurrent_users_24h.samples_in_window)} samples`}
          hint="The highest active-account count among the one-minute samples. A minute between samples can be missed."
        />
      </div>
    </section>
  );
}

function EngagementPanel({ from, to }: { from: string; to: string }) {
  const params = useMemo(() => new URLSearchParams({ from, to }), [from, to]);
  const engagement = useAdminResource("activityEngagement", params);
  const state = stateOf(engagement);
  if (state === "loading") return <Skeleton className="h-40" />;
  if (state !== "ready" || !engagement.data) {
    return <ResourceState state={state === "unavailable" ? "unavailable" : "error"} message={messageOf(engagement.error)} />;
  }
  const e = engagement.data;
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-5 text-slate-500">
        Figures for the selected window. Day, week and month counts end on the window&apos;s last UTC day.
        {" "}{coverageNote(e.coverage_started_on)}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="DAU" value={formatCount(e.dau)} hint="Accounts with foreground activity on the last UTC day of the window." />
        <StatTile label="WAU" value={formatCount(e.wau)} hint="Accounts active on any of the 7 UTC days ending on the last day." />
        <StatTile label="MAU" value={formatCount(e.mau)} hint="Accounts active on any of the 30 UTC days ending on the last day." />
        <StatTile label="DAU / MAU" value={formatRatio(e.dau_mau_ratio)} hint="Stickiness: the share of monthly users who came back on the last day. Higher is more habitual." />
        <StatTile
          label="Active accounts in window"
          value={formatCount(e.active_users_in_range)}
          caption={`${formatPercent(e.active_user_percentage)} of ${formatCount(e.eligible_registered_users)} registered`}
          hint="Distinct accounts with any foreground activity in the window, divided by accounts registered before the window ends."
        />
        <StatTile
          label="New vs returning"
          value={`${formatCount(e.new_active_users)} / ${formatCount(e.returning_active_users)}`}
          caption="New: first activity inside the window. Returning: active before it too."
          hint="New accounts are those first seen in the window. Before tracking began, every account looks new."
        />
        <StatTile
          label="Average session"
          value={formatDuration(e.average_session_foreground_seconds)}
          caption={`Median ${formatDuration(e.median_session_foreground_seconds)} · ${formatCount(e.closed_sessions_in_range)} closed sessions`}
          hint="Foreground time per session, from sessions that have ended. Open sessions are excluded."
        />
        <StatTile
          label="Daily time per active account"
          value={formatDuration(e.average_daily_active_seconds_per_user)}
          caption="Average foreground time per account-day"
          hint="Total foreground time in the window divided by the number of account-days with activity."
        />
      </div>
      {e.median_sample_truncated ? (
        <p className="text-[11px] text-amber-200/80">The median uses the newest 50,000 closed sessions in the window; the average uses all of them.</p>
      ) : null}
    </div>
  );
}

function ActiveUsersTrend({ from, to }: { from: string; to: string }) {
  const trend = useTimeseries({ from, to, bucket: "day" });
  const state = stateOf(trend);
  if (state === "loading") return <Skeleton className="h-64" />;
  if (state !== "ready" || !trend.data) {
    return <ResourceState state={state === "unavailable" ? "unavailable" : "error"} message={messageOf(trend.error)} />;
  }
  const points = trend.data.series.active_users ?? [];
  const rows = points.map((point) => ({ t: point.t, v: point.v }));
  const measured = points.filter((point) => point.v !== null).length;
  return (
    <figure className="space-y-2" data-testid="active-users-trend">
      <figcaption className="text-[11px] leading-5 text-slate-500">
        Distinct active accounts per UTC day. {coverageNote(trend.data.coverage?.active_users_started_on ?? null)}
        {" "}{measured} of {points.length} days measured.
      </figcaption>
      <div className="h-64" role="img" aria-label={`Active accounts per day, ${measured} measured days in the window`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fill-active-users" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b75ff" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8b75ff" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(195,202,226,0.1)" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={(value: string) => formatShortDate(value)}
              tick={{ fill: "#9ba4bc", fontSize: 11 }}
              axisLine={{ stroke: "rgba(195,202,226,0.2)" }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#9ba4bc", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              labelFormatter={(value: string) => formatShortDate(String(value))}
              formatter={(value) => [formatCount(typeof value === "number" ? value : null), "Active accounts"]}
              contentStyle={{ background: "#13182b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#f7f7fc" }}
            />
            <Area
              type="monotone"
              dataKey="v"
              name="Active accounts"
              stroke="#8b75ff"
              fill="url(#fill-active-users)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 3, fill: "#8b75ff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

type RetentionRow = { cohort_date: string; registered: number; d1_pct: number | null; d7_pct: number | null; d30_pct: number | null };

function RetentionPanel({ from, to }: { from: string; to: string }) {
  const params = useMemo(() => new URLSearchParams({ from, to }), [from, to]);
  const retention = useAdminResource("activityRetention", params);
  const state = stateOf(retention);
  if (state === "loading") return <Skeleton className="h-40" />;
  if (state !== "ready" || !retention.data) {
    return <ResourceState state={state === "unavailable" ? "unavailable" : "error"} message={messageOf(retention.error)} />;
  }
  const rows: RetentionRow[] = retention.data.cohorts;
  const cell = (value: number | null) => (value === null ? <span className="text-slate-600" title="Not scored: too recent, or before tracking began">—</span> : <span className="tabular-nums">{formatPercent(value)}</span>);
  const columns: Column<RetentionRow>[] = [
    { key: "cohort", header: "Registered on", primary: true, render: (row) => <span className="tabular-nums text-slate-200">{formatShortDate(row.cohort_date)}</span> },
    { key: "registered", header: "Accounts", align: "right", render: (row) => <span className="tabular-nums">{formatCount(row.registered)}</span> },
    { key: "d1", header: "Day 1", align: "right", render: (row) => cell(row.d1_pct) },
    { key: "d7", header: "Day 7", align: "right", render: (row) => cell(row.d7_pct) },
    { key: "d30", header: "Day 30", align: "right", render: (row) => cell(row.d30_pct) },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-5 text-slate-500">
        Share of each registration day&apos;s accounts active again on day 1, 7 or 30. A dash means the cohort is too recent to score, or was registered before tracking began.
      </p>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.cohort_date}
        label="Retention by registration day"
        empty={<p className="p-5 text-sm text-slate-500">No accounts registered in this window.</p>}
      />
    </div>
  );
}

function ActivityTable() {
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(draft.trim(), 300);
  const params = useMemo(() => {
    const next = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
    if (search) next.set("search", search);
    return next;
  }, [page, search]);
  const users = useActivityUsers(params);
  const rows: ActivityUserRow[] = users.data?.rows ?? [];
  const total = users.data?.total ?? null;
  const state = users.isLoading ? "loading" : users.isError ? "error" : "ready";

  const columns: Column<ActivityUserRow>[] = [
    {
      key: "account", header: "Account", primary: true,
      render: (row) => (
        <Link href={`/users/${encodeURIComponent(row.id)}`} className="focus-ring font-semibold text-slate-200 transition hover:text-white">
          {row.name ?? "Unnamed account"}
        </Link>
      ),
    },
    {
      key: "presence", header: "Presence",
      render: (row) => <StatusBadge tone={row.is_online ? "success" : "neutral"}>{row.is_online ? "Online" : "Offline"}</StatusBadge>,
    },
    { key: "last_seen", header: "Last seen", hideBelow: "md", render: (row) => <span className="text-slate-400">{row.presence_label}</span> },
    { key: "registered", header: "Registered", hideBelow: "lg", render: (row) => <span className="tabular-nums text-slate-400">{row.registered_at ? formatShortDate(row.registered_at) : "—"}</span> },
    { key: "listings", header: "Listings", align: "right", hideBelow: "lg", render: (row) => <span className="tabular-nums">{formatCount(row.listings)}</span> },
    { key: "sessions", header: "Sessions 30d", align: "right", hideBelow: "xl", render: (row) => <span className="tabular-nums">{formatCount(row.sessions_30d)}</span> },
    { key: "time", header: "Time in app 30d", align: "right", render: (row) => <span className="tabular-nums">{formatDuration(row.foreground_seconds_30d)}</span> },
    {
      key: "moderation", header: "Moderation",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.is_flagged ? <StatusBadge tone="danger">Flagged</StatusBadge> : null}
          {row.is_admin ? <StatusBadge tone="warning">Admin</StatusBadge> : null}
          {!row.is_flagged && !row.is_admin ? <span className="text-xs text-slate-600">Clear</span> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Search accounts by name, nickname, phone or email</span>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
          <input
            type="search"
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setPage(1); }}
            placeholder="Search name, nickname, phone or email"
            className="h-10 w-full rounded-lg border border-white/[0.08] bg-black/15 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-600"
          />
        </label>
        <p className="text-[11px] text-slate-500">Searched on the server. Phone and email are matched but never shown here.</p>
      </div>
      <section className="data-panel overflow-hidden">
        {state === "loading" ? (
          <div className="space-y-2 p-4" aria-busy="true">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-12" />)}</div>
        ) : state === "error" ? (
          <div className="p-5"><ResourceState state="error" message={messageOf(users.error)} /></div>
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(row) => row.id}
            label="Account activity"
            empty={<p className="p-5 text-sm text-slate-500">No accounts match this search.</p>}
          />
        )}
        {state === "ready" ? (
          <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 text-xs text-slate-500">
            <span>Page {page}{total !== null ? ` · ${formatCount(total)} matching accounts` : " · filtered total unavailable"}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="focus-ring rounded-lg border border-white/[0.08] px-3 py-1.5 font-semibold text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <button
                type="button"
                disabled={total !== null ? page * PAGE_SIZE >= total : rows.length < PAGE_SIZE}
                onClick={() => setPage(page + 1)}
                className="focus-ring rounded-lg border border-white/[0.08] px-3 py-1.5 font-semibold text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function UserIntelligenceView() {
  const fallback = useMemo(windowFallback, []);
  const [range, setRange] = useUrlDateRange(fallback);
  const days = daysBetween(range.from, range.to);
  const selectedWindow = WINDOW_OPTIONS.some((option) => option.value === String(days)) ? String(days) : "30";

  function selectWindow(value: string) {
    const next = utcRangeEndingToday(Number(value));
    setRange({ from: next.from, to: next.to, bucket: "day" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identity & activity"
        title="User intelligence"
        description="Who is using BROKA now, how often they come back, and which accounts need attention. Built from foreground heartbeats, not from logins alone."
        meta={<span className="text-[11px] text-slate-500">Window {formatShortDate(range.from)} to {formatShortDate(range.to)} (UTC, exclusive end)</span>}
      />

      <LiveStrip />

      <Panel
        id="engagement"
        eyebrow="Engagement"
        title="Engagement in the selected window"
        description="DAU, WAU and MAU, session length, activity share and new versus returning accounts."
        actions={<Segmented value={selectedWindow as "7" | "30" | "90"} options={WINDOW_OPTIONS as Array<{ value: "7" | "30" | "90"; label: string }>} onChange={selectWindow} label="Engagement window" />}
      >
        <EngagementPanel from={range.from} to={range.to} />
      </Panel>

      <Panel id="trend" eyebrow="Trend" title="Active accounts per day" description="Gaps mean the day was not measured. They are never drawn as zero.">
        <ActiveUsersTrend from={range.from} to={range.to} />
      </Panel>

      <Panel id="retention" eyebrow="Retention" title="Return rate by registration day" description="Day 1, day 7 and day 30 returns for each day's new accounts.">
        <RetentionPanel from={range.from} to={range.to} />
      </Panel>

      <Panel id="accounts" eyebrow="Accounts" title="Account activity" description="Presence and 30-day activity per account. Open an account for its sessions and daily history.">
        <ActivityTable />
      </Panel>

      <UnavailablePanel
        title="Not in these figures"
        detail="Per-device details, IP addresses and message or call content are never recorded for activity. Background requests are not counted as use."
        compact
      />
    </div>
  );
}
