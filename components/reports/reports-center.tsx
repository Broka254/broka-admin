"use client";

import { CalendarClock, CalendarDays, Radar, RefreshCw, Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { ReportViewer } from "@/components/reports/report-viewer";
import { Chip, Segmented } from "@/components/intelligence/visuals";
import { ResourceState, SectionEyebrow, StatusBadge } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminDetail, useAdminResource } from "@/hooks/use-admin-resource";
import { useGenerateReport } from "@/hooks/use-intelligence";
import type { ReportKind, ReportMeta } from "@/lib/api/intelligence-schemas";
import { formatDateTime } from "@/lib/format";
import { relativeTime, SEVERITY_META } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

const KINDS: Array<{ value: ReportKind; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const KIND_NOUN: Record<ReportKind, string> = { daily: "day", weekly: "week", monthly: "month" };

function asKind(value: string | null): ReportKind {
  return value === "daily" || value === "monthly" ? value : "weekly";
}

function todayLocal(): string {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function ArchiveItem({ report, active, onOpen }: { report: ReportMeta; active: boolean; onOpen: () => void }) {
  const critical = report.insight_counts.critical ?? 0;
  const warning = report.insight_counts.warning ?? 0;
  const positive = report.insight_counts.positive ?? 0;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        className={cn("focus-ring w-full rounded-2xl border p-4 text-left transition", active ? "border-[#8b75ff]/50 bg-[#8b75ff]/[0.1]" : "border-white/[0.07] bg-black/20 hover:border-[#8b75ff]/30")}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a895ff]">{report.kind}</span>
          <span className="text-[10px] text-slate-600">{relativeTime(report.generated_at)}</span>
        </span>
        <span className="mt-1.5 block text-sm font-semibold text-white">{report.period_label ?? report.title}</span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-400">{report.headline}</span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          {critical ? <Chip tone={SEVERITY_META.critical.tone}>{critical} act now</Chip> : null}
          {warning ? <Chip tone={SEVERITY_META.warning.tone}>{warning} watch</Chip> : null}
          {positive ? <Chip tone={SEVERITY_META.positive.tone}>{positive} working</Chip> : null}
          {report.generated_by === "system" ? <Chip>auto</Chip> : <Chip tone="info">manual</Chip>}
        </span>
      </button>
    </li>
  );
}

export function ReportsCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const kind = asKind(searchParams.get("kind"));
  const selectedId = searchParams.get("id");
  const preview = searchParams.get("view") === "preview";
  const [periodDate, setPeriodDate] = useState("");

  const listQuery = useMemo(() => new URLSearchParams({ kind, limit: "30" }), [kind]);
  const previewQuery = useMemo(() => new URLSearchParams({ kind }), [kind]);
  const archive = useAdminResource("reports", listQuery);
  const live = useAdminResource("reportPreview", previewQuery, preview);
  const fallbackId = !preview && !selectedId ? archive.data?.items[0]?.id ?? "" : "";
  const detailId = selectedId ?? fallbackId;
  const detail = useAdminDetail("reportDetail", detailId, !preview && Boolean(detailId));
  const generate = useGenerateReport();

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key); else next.set(key, value);
    }
    router.replace(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    generate.mutate(
      periodDate ? { kind, period_date: periodDate } : { kind },
      { onSuccess: (report) => { setPeriodDate(""); update({ id: report.id, view: null }); } },
    );
  }

  const schedule = archive.data?.schedule;
  const missing = isEndpointMissing(archive.error);
  const shown = preview ? live : detail;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <SectionEyebrow>Founder reports</SectionEyebrow>
          <h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">The business, in writing</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Daily, weekly and monthly reports written automatically when each period closes, with the figures frozen as they stood. Weekly and monthly reports are announced in the Alert Centre. Download, print or paste the digest into your team chat.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Report kind" value={kind} options={KINDS} onChange={(value) => update({ kind: value === "weekly" ? null : value, id: null })} />
          {schedule ? <StatusBadge tone={schedule.enabled ? "success" : "warning"}>{schedule.enabled ? `Automatic · ${schedule.timezone}` : "Automatic reports off"}</StatusBadge> : null}
        </div>
      </section>

      {missing ? <ResourceState state="unavailable" message="Reports need the upgraded BROKA API (GET /admin/reports). They start appearing after the backend deploy and the first closed period." /> : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4" aria-label="Report archive">
          <button
            type="button"
            onClick={() => update({ view: preview ? null : "preview", id: null })}
            aria-pressed={preview}
            className={cn("focus-ring flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition", preview ? "border-cyan-300/45 bg-cyan-300/[0.08]" : "border-white/[0.07] bg-black/20 hover:border-cyan-300/30")}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200" aria-hidden="true"><Radar size={18} /></span>
            <span>
              <span className="block text-sm font-semibold text-white">This {KIND_NOUN[kind]} so far</span>
              <span className="mt-0.5 block text-xs text-slate-400">Live preview, computed now and never stored</span>
            </span>
          </button>

          <form onSubmit={submit} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-200"><Sparkles size={13} className="text-[#a895ff]" aria-hidden="true" />Generate a {kind} report</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">Leave the date empty for the last closed {KIND_NOUN[kind]}, or pick any day inside a past {KIND_NOUN[kind]}. Re-generating replaces that period&apos;s report.</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-slate-400">
                <span className="flex items-center gap-1"><CalendarDays size={11} aria-hidden="true" />Day in the period</span>
                <input type="date" value={periodDate} max={todayLocal()} onChange={(event) => setPeriodDate(event.target.value)} className="mt-1 block rounded-lg border border-white/10 bg-[#080a14] px-3 py-2 text-xs text-slate-100 [color-scheme:dark]" />
              </label>
              <button type="submit" disabled={generate.isPending} className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[#8b75ff] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50">
                {generate.isPending ? <RefreshCw size={12} className="animate-spin" aria-hidden="true" /> : <CalendarClock size={12} aria-hidden="true" />}
                {generate.isPending ? "Writing…" : "Generate"}
              </button>
            </div>
            {generate.isError ? <p role="alert" className="mt-2 text-xs text-rose-300">{generate.error.message}</p> : null}
          </form>

          {archive.isLoading ? <ResourceState state="loading" message="Loading the archive…" /> : archive.isError && !missing ? (
            <ResourceState state="error" message={archive.error.message} action={<button type="button" onClick={() => void archive.refetch()} className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200">Retry</button>} />
          ) : archive.data && !archive.data.items.length ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-xs leading-5 text-slate-500">No {kind} reports yet. The first one is written when the current {KIND_NOUN[kind]} closes, or generate one above.</p>
          ) : archive.data ? (
            <ul className="space-y-2">
              {archive.data.items.map((report) => (
                <ArchiveItem key={report.id ?? report.period_start} report={report} active={!preview && (detailId === report.id)} onOpen={() => update({ id: report.id, view: null })} />
              ))}
            </ul>
          ) : null}
          {archive.data && archive.data.total > archive.data.items.length ? <p className="text-[11px] text-slate-600">Showing the latest {archive.data.items.length} of {archive.data.total}.</p> : null}
        </aside>

        <div className="min-w-0">
          {shown.isLoading ? <ResourceState state="loading" message={preview ? `Computing this ${KIND_NOUN[kind]} so far…` : "Opening the report…"} /> : shown.isError ? (
            <ResourceState state="error" message={shown.error.message} />
          ) : shown.data ? (
            <ReportViewer report={shown.data} />
          ) : !missing ? (
            <ResourceState state="empty" message="Choose a report from the archive or open the live preview." />
          ) : null}
          {shown.data ? <p className="print-hidden mt-3 text-[11px] text-slate-600">Period {formatDateTime(shown.data.period_start)} to {formatDateTime(shown.data.period_end)} (end exclusive). Figures exclude staff accounts.</p> : null}
        </div>
      </div>
    </div>
  );
}
