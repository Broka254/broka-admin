"use client";

import { ArrowUpDown, Inbox, ListFilter, RefreshCw, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ComplaintDrawer } from "@/components/complaints/complaint-drawer";
import { Chip, DeltaChip, Panel, StatTile } from "@/components/intelligence/visuals";
import { ResourceState, SectionEyebrow, StatusBadge } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import { buildFeedbackParams, COMPLAINT_PAGE_SIZE, complaintQueue, complaintSort, type ComplaintQueue } from "@/hooks/use-complaints";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { FeedbackAdminItem, FeedbackStats } from "@/lib/api/intelligence-schemas";
import {
  FEEDBACK_CATEGORY_LABELS,
  feedbackCategoryLabel,
  feedbackReference,
  feedbackSeverityMeta,
  feedbackStatusMeta,
  formatCount,
  formatDuration,
  relativeTime,
  slaSummary,
} from "@/lib/intelligence";
import { cn } from "@/lib/utils";

const QUEUES: Array<{ value: ComplaintQueue; label: string; hint: string }> = [
  { value: "unanswered", label: "Needs a reply", hint: "Open, and nobody has replied yet" },
  { value: "overdue", label: "Past deadline", hint: "Unanswered complaints past their first-reply deadline" },
  { value: "open", label: "Open", hint: "New, acknowledged or in progress" },
  { value: "closed", label: "Closed", hint: "Resolved or closed" },
  { value: "all", label: "Everything", hint: "All submissions" },
];

/**
 * A count is shown only where it is exact: the active queue uses the list's
 * own total; other queues use the stats, which know nothing of the filters
 * and count unanswered complaints only (the queue also holds feedback).
 */
function queueCount(stats: FeedbackStats | undefined, queue: ComplaintQueue, active: ComplaintQueue, listTotal: number | undefined, filtered: boolean): number | null {
  if (queue === active) return listTotal ?? null;
  if (!stats || filtered || queue === "unanswered") return null;
  const by = stats.by_status;
  if (queue === "overdue") return stats.sla_breached;
  if (queue === "open") return (by.open ?? 0) + (by.acknowledged ?? 0) + (by.in_progress ?? 0);
  if (queue === "closed") return (by.resolved ?? 0) + (by.closed ?? 0);
  return stats.total;
}

function SearchBox({ initial, onCommit }: { initial: string; onCommit: (value: string | null) => void }) {
  const [value, setValue] = useState(initial);
  const debounced = useDebouncedValue(value, 350);
  useEffect(() => { setValue(initial); }, [initial]);
  useEffect(() => {
    const next = debounced.trim();
    // onCommit changes identity every render; only the committed text matters.
    if (next !== initial) onCommit(next || null);
  }, [debounced]);
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">Search subjects</span>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
      <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search subjects" className="h-10 w-full rounded-lg border border-white/[0.08] bg-black/20 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-600" />
    </label>
  );
}

function Row({ item, onOpen, active }: { item: FeedbackAdminItem; onOpen: () => void; active: boolean }) {
  const severity = feedbackSeverityMeta(item.severity);
  const sla = slaSummary(item);
  const status = feedbackStatusMeta(item.status);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        className={cn(
          "focus-ring group grid w-full gap-3 rounded-2xl border p-4 text-left transition sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center",
          active ? "border-[#8b75ff]/45 bg-[#8b75ff]/[0.09]" : sla.overdue ? "border-rose-400/25 bg-rose-400/[0.04] hover:border-rose-400/45" : "border-white/[0.07] bg-[linear-gradient(140deg,rgba(19,24,43,0.7),rgba(8,10,20,0.9))] hover:border-[#8b75ff]/35",
        )}
        data-testid={`complaint-row-${item.id}`}
      >
        <span className={cn("hidden h-10 w-1 rounded-full sm:block", severity.tone === "danger" ? "bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.6)]" : severity.tone === "warning" ? "bg-amber-300" : "bg-slate-600")} aria-hidden="true" />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <Chip tone={item.kind === "complaint" ? "warning" : "info"}>{item.kind}</Chip>
            <Chip tone={severity.tone}>{severity.label}</Chip>
            <span className="text-[11px] text-slate-500">{feedbackCategoryLabel(item.category)}</span>
            <span className="font-mono text-[10px] text-slate-600">{feedbackReference(item.id)}</span>
          </span>
          <span className="mt-1.5 block truncate text-sm font-semibold text-slate-100 group-hover:text-white">{item.subject}</span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">{item.reporter?.name || "Unknown reporter"} · {item.body}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <span className={cn("text-[11px] font-semibold tabular-nums", sla.overdue ? "text-rose-300" : sla.tone === "warning" ? "text-amber-200" : "text-slate-400")}>{sla.label}</span>
          <span className="flex items-center gap-2 text-[11px] text-slate-500"><StatusBadge tone={status.tone}>{status.label}</StatusBadge>{relativeTime(item.created_at)}</span>
        </span>
      </button>
    </li>
  );
}

function Sidebar({ stats }: { stats: FeedbackStats }) {
  const categories = Object.entries(stats.by_category).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...categories.map(([, count]) => count));
  return (
    <div className="space-y-6">
      <Panel eyebrow="Patterns" title="Most-reported accounts" description="Accounts named in two or more complaints in 90 days. Repeat reports are the earliest fraud signal BROKA has.">
        {stats.repeat_reported_users.length ? (
          <ul className="space-y-2.5">
            {stats.repeat_reported_users.map((user) => (
              <li key={user.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
                <Link href={`/users/${encodeURIComponent(user.user_id)}`} className="focus-ring min-w-0 truncate text-xs font-semibold text-slate-100 hover:text-[#ded8ff]">{user.name || `${user.user_id.slice(0, 8)}…`}</Link>
                <Link href={`/complaints?about=${encodeURIComponent(user.user_id)}&queue=all`} className="focus-ring shrink-0"><Chip tone="danger">{user.complaints_90d} complaints</Chip></Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-slate-500">No account has been complained about more than once in 90 days.</p>}
      </Panel>
      <Panel eyebrow="Patterns" title="By category" description="All submissions, all time.">
        <ul className="space-y-2">
          {categories.map(([key, count]) => (
            <li key={key}>
              <Link href={`/complaints?category=${encodeURIComponent(key)}&queue=all`} className="focus-ring block">
                <span className="flex items-baseline justify-between text-xs"><span className="text-slate-300">{feedbackCategoryLabel(key)}</span><span className="font-semibold tabular-nums text-white">{formatCount(count)}</span></span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><span className="block h-full rounded-full bg-gradient-to-r from-[#8b75ff] to-[#54d7e9]" style={{ width: `${(count / max) * 100}%` }} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export function ComplaintsDesk() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queue = complaintQueue(searchParams.get("queue"));
  const sort = complaintSort(searchParams.get("sort"));
  const kind = searchParams.get("kind");
  const severity = searchParams.get("severity");
  const category = searchParams.get("category");
  const search = searchParams.get("search") ?? "";
  const reporterId = searchParams.get("user");
  const aboutId = searchParams.get("about");
  const openId = searchParams.get("id");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const query = useMemo(() => buildFeedbackParams({ queue, sort, kind, severity, category, search, page, userId: reporterId, relatedUserId: aboutId }), [queue, sort, kind, severity, category, search, page, reporterId, aboutId]);
  const list = useAdminResource("feedback", query);
  const stats = useAdminResource("feedbackStats");

  function update(changes: Record<string, string | null>, keepPage = false) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key); else next.set(key, value);
    }
    if (!keepPage) next.delete("page");
    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const openItem = openId ? items.find((item) => item.id === openId) : undefined;
  const filtersActive = Boolean(kind || severity || category || search || reporterId || aboutId);
  const s = stats.data;
  const filedChange = s && s.filed_previous_7d ? ((s.filed_last_7d - s.filed_previous_7d) / s.filed_previous_7d) * 100 : null;
  const missing = isEndpointMissing(list.error) || isEndpointMissing(stats.error);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <SectionEyebrow>Trust desk</SectionEyebrow>
          <h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Complaints & feedback</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Everything users report from the BROKA app, with first-reply deadlines by severity. A reply or a status change is pushed to the reporter&apos;s phone and appears in their Feedback &amp; complaints screen.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s ? <StatusBadge tone={s.sla_breached ? "danger" : "success"}>{s.sla_breached ? `${s.sla_breached} past deadline` : "All inside deadlines"}</StatusBadge> : null}
          <button type="button" onClick={() => { void list.refetch(); void stats.refetch(); }} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"><RefreshCw size={12} aria-hidden="true" />Refresh</button>
        </div>
      </section>

      {missing ? <ResourceState state="unavailable" message="The complaints desk needs the upgraded BROKA API (GET /admin/feedback with triage fields). It activates after the backend deploy." /> : null}

      {s ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Complaint health">
          <StatTile label="Open complaints" value={formatCount(s.open_complaints)} caption={`${formatCount(s.open_by_severity.urgent ?? 0)} urgent`} accent="text-amber-200" />
          <StatTile label="Needs a reply" value={formatCount(s.unanswered)} caption="complaints, no reply yet" accent="text-cyan-200" />
          <StatTile label="Past deadline" value={formatCount(s.sla_breached)} caption={s.sla_breached_urgent ? `${s.sla_breached_urgent} urgent` : "none urgent"} accent={s.sla_breached ? "text-rose-300" : "text-emerald-300"} />
          <StatTile label="Oldest waiting" value={formatDuration(s.oldest_unanswered_hours)} caption="for a first reply" />
          <StatTile label="Median first reply" value={formatDuration(s.median_response_hours_90d)} caption="last 90 days" accent="text-[#a895ff]" />
          <div className="stat-tile">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Filed this week</p>
            <p className="mt-3 font-display text-[1.6rem] font-bold leading-none tracking-[-0.04em] text-white tabular-nums">{formatCount(s.filed_last_7d)}</p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500"><DeltaChip change={filedChange} good="down" label="vs the 7 days before" /><span>prev {formatCount(s.filed_previous_7d)}</span></div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <nav className="flex flex-wrap gap-2" aria-label="Queues">
            {QUEUES.map((entry) => {
              const count = queueCount(s, entry.value, queue, list.data?.total, filtersActive);
              const active = queue === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  title={entry.hint}
                  aria-pressed={active}
                  onClick={() => update({ queue: entry.value === "unanswered" ? null : entry.value, id: null })}
                  className={cn("focus-ring inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition", active ? "border-[#8b75ff]/50 bg-[#8b75ff]/15 text-[#ded8ff] shadow-[0_0_20px_rgba(139,117,255,0.18)]" : "border-white/[0.08] text-slate-400 hover:text-slate-100")}
                >
                  {entry.label}
                  {count !== null ? <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] tabular-nums", entry.value === "overdue" && count > 0 ? "bg-rose-400/20 text-rose-200" : "bg-white/[0.06] text-slate-300")}>{count}</span> : null}
                </button>
              );
            })}
          </nav>

          <div className="holo-panel flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
            <SearchBox initial={search} onCommit={(value) => update({ search: value })} />
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-slate-400">
              <ListFilter size={13} aria-hidden="true" /><span className="sr-only">Kind</span>
              <select value={kind ?? "all"} onChange={(event) => update({ kind: event.target.value === "all" ? null : event.target.value })} className="bg-transparent text-xs font-semibold text-slate-200 outline-none [&>option]:bg-[#0b0e1a]" aria-label="Kind">
                <option value="all">All kinds</option><option value="complaint">Complaints</option><option value="feedback">Feedback</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-slate-400">
              <span className="sr-only">Severity</span>
              <select value={severity ?? "all"} onChange={(event) => update({ severity: event.target.value === "all" ? null : event.target.value })} className="bg-transparent text-xs font-semibold text-slate-200 outline-none [&>option]:bg-[#0b0e1a]" aria-label="Severity">
                <option value="all">Any severity</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-slate-400">
              <span className="sr-only">Category</span>
              <select value={category ?? "all"} onChange={(event) => update({ category: event.target.value === "all" ? null : event.target.value })} className="bg-transparent text-xs font-semibold text-slate-200 outline-none [&>option]:bg-[#0b0e1a]" aria-label="Category">
                <option value="all">Any category</option>
                {Object.entries(FEEDBACK_CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-slate-400">
              <ArrowUpDown size={13} aria-hidden="true" /><span className="sr-only">Sort</span>
              <select value={sort} onChange={(event) => update({ sort: event.target.value === "priority" ? null : event.target.value })} className="bg-transparent text-xs font-semibold text-slate-200 outline-none [&>option]:bg-[#0b0e1a]" aria-label="Sort">
                <option value="priority">Most urgent first</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option>
              </select>
            </label>
            {filtersActive ? <button type="button" onClick={() => update({ kind: null, severity: null, category: null, search: null, user: null, about: null })} className="focus-ring inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white"><X size={12} aria-hidden="true" />Clear</button> : null}
          </div>

          {reporterId || aboutId ? (
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              {reporterId ? <Chip tone="info">Filed by {reporterId.slice(0, 8)}…</Chip> : null}
              {aboutId ? <Chip tone="warning">About account {aboutId.slice(0, 8)}…</Chip> : null}
              <Link href={`/users/${encodeURIComponent(aboutId ?? reporterId ?? "")}`} className="focus-ring font-semibold text-[#a895ff] hover:text-[#ded8ff]">Open profile</Link>
            </p>
          ) : null}

          {list.isLoading ? <ResourceState state="loading" message="Loading the queue…" /> : list.isError && !missing ? (
            <ResourceState state="error" message={list.error.message} action={<button type="button" onClick={() => void list.refetch()} className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200">Retry</button>} />
          ) : list.data && items.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 p-10 text-center">
              <Inbox size={22} className="text-emerald-300" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-200">{queue === "unanswered" || queue === "overdue" ? "Nothing is waiting for a reply." : "No submissions match."}</p>
              <p className="mt-1 text-xs text-slate-500">{filtersActive ? "Try clearing the filters." : "New complaints from the app land here and in the Alert Centre when urgent."}</p>
            </div>
          ) : items.length ? (
            <>
              <ul className="space-y-2" aria-label="Submissions">
                {items.map((item) => <Row key={item.id} item={item} active={item.id === openId} onOpen={() => update({ id: item.id }, true)} />)}
              </ul>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{formatCount(total)} matching · page {page} of {Math.max(1, Math.ceil(total / COMPLAINT_PAGE_SIZE))}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, true)} className="focus-ring rounded-lg border border-white/[0.08] px-3 py-1.5 font-semibold text-slate-300 disabled:opacity-40">Previous</button>
                  <button type="button" disabled={page * COMPLAINT_PAGE_SIZE >= total} onClick={() => update({ page: String(page + 1) }, true)} className="focus-ring rounded-lg border border-white/[0.08] px-3 py-1.5 font-semibold text-slate-300 disabled:opacity-40">Next</button>
                </div>
              </div>
            </>
          ) : null}
        </div>
        {s ? <Sidebar stats={s} /> : null}
      </div>

      {openId ? <ComplaintDrawer key={openId} id={openId} preview={openItem} onClose={() => update({ id: null }, true)} /> : null}
    </div>
  );
}
