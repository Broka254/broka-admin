"use client";

import { CalendarClock, Eye, Play, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { BuilderReportView, RegenerateButton } from "@/components/reports/builder-report";
import { Chip, DataFreshness, PageHeader, Panel } from "@/components/intelligence/visuals";
import { ResourceState } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminDetail, useAdminResource } from "@/hooks/use-admin-resource";
import {
  useCreateRun, useDeleteDefinition, usePreviewReport, useRegenerateRun, useRunDefinition, useSaveDefinition,
  useUpdateDefinition,
} from "@/hooks/use-report-builder";
import type { Catalog, Definition, DefinitionIn } from "@/lib/api/report-builder-schemas";
import { SCHEDULES } from "@/lib/api/report-builder-schemas";
import { relativeTime } from "@/lib/intelligence";
import { WEEKDAYS, defaultForm, formError, formToSpec, scheduleText, specToForm, type BuilderForm } from "@/lib/report-builder";

const input = "focus-ring w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-100";
const select = "focus-ring w-full rounded-lg border border-white/10 bg-[#080a14] px-2.5 py-1.5 text-xs text-slate-100 [&>option]:bg-[#0b0e1a]";
const primary = "focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/40 bg-[#8b75ff]/15 px-3 py-1.5 text-xs font-semibold text-[#ded8ff] disabled:opacity-50";
const secondary = "focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1 text-[11px] font-semibold text-slate-400">{label}{children}</label>;
}

function ErrorLine({ error }: { error: unknown }) {
  if (!error) return null;
  return <p role="alert" className="text-xs text-rose-200">{error instanceof Error ? error.message : "Something went wrong."}</p>;
}

function SpecForm({ catalog, form, setForm }: { catalog: Catalog; form: BuilderForm; setForm: (f: BuilderForm) => void }) {
  const implied = new Set(form.categories.flatMap((key) => catalog.categories.find((c) => c.key === key)?.metrics ?? []));
  const byCategory = catalog.categories.filter((c) => c.key !== "business").map((c) => ({
    ...c, list: catalog.metrics.filter((m) => m.category === c.key),
  }));
  const toggle = (list: string[], key: string) => list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  return (
    <div className="space-y-4">
      <Field label="Title"><input className={input} value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
      <fieldset className="space-y-2">
        <legend className="text-[11px] font-semibold text-slate-400">Report categories</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {catalog.categories.map((c) => (
            <label key={c.key} className="flex items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2 text-xs text-slate-200">
              <input type="checkbox" checked={form.categories.includes(c.key)} onChange={() => setForm({ ...form, categories: toggle(form.categories, c.key) })} className="mt-0.5" />
              <span><span className="font-semibold">{c.label}</span> <span className="text-slate-500">· {c.metrics.length}</span><br /><span className="text-[10px] text-slate-500">{c.description}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <details className="text-xs text-slate-300">
        <summary className="focus-ring cursor-pointer font-semibold">Single figures {form.metrics.length ? `(${form.metrics.length} chosen)` : ""}</summary>
        <div className="mt-2 max-h-64 space-y-3 overflow-y-auto pr-1">
          {byCategory.map((c) => (
            <div key={c.key}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{c.label}</p>
              {c.list.map((m) => (
                <label key={m.key} className="mt-1 flex items-start gap-2 text-[11px]" title={m.definition}>
                  <input type="checkbox" checked={implied.has(m.key) || form.metrics.includes(m.key)} disabled={implied.has(m.key)}
                    onChange={() => setForm({ ...form, metrics: toggle(form.metrics, m.key) })} />
                  <span>{m.label}{m.kind === "point" ? " (as of generation)" : ""}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </details>
      <fieldset className="space-y-2">
        <legend className="text-[11px] font-semibold text-slate-400">Dates (UTC days, end included)</legend>
        <div className="flex flex-wrap gap-3 text-xs text-slate-200">
          <label className="flex items-center gap-1.5"><input type="radio" name="range" checked={form.rangeMode === "last"} onChange={() => setForm({ ...form, rangeMode: "last" })} />The last</label>
          <input aria-label="Number of days" type="number" min={1} max={catalog.limits.max_range_days} value={form.lastDays} disabled={form.rangeMode !== "last"}
            onChange={(e) => setForm({ ...form, lastDays: Number(e.target.value) })} className={`${input} w-20`} />
          <span className="self-center text-slate-400">complete days</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
          <label className="flex items-center gap-1.5"><input type="radio" name="range" checked={form.rangeMode === "fixed"} onChange={() => setForm({ ...form, rangeMode: "fixed" })} />From</label>
          <input aria-label="From date" type="date" value={form.dateFrom} disabled={form.rangeMode !== "fixed"} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} className={`${input} w-auto`} />
          <span>through</span>
          <input aria-label="Through date" type="date" value={form.dateTo} disabled={form.rangeMode !== "fixed"} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} className={`${input} w-auto`} />
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Compare with">
          <select aria-label="Compare with" className={select} value={form.comparison} onChange={(e) => setForm({ ...form, comparison: e.target.value as BuilderForm["comparison"] })}>
            {catalog.comparisons.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Group by">
          <select aria-label="Group by" className={select} value={form.groupBy} onChange={(e) => setForm({ ...form, groupBy: e.target.value as BuilderForm["groupBy"] })}>
            {catalog.groupings.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </Field>
        <Field label="Show grouped figures as">
          <select aria-label="Visualization" className={select} value={form.visualization} onChange={(e) => setForm({ ...form, visualization: e.target.value as BuilderForm["visualization"] })}>
            {catalog.visualizations.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Listing category filter">
          <select aria-label="Listing category filter" className={select} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">All categories</option>
            {catalog.filter_options.category.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="County filter">
          <select aria-label="County filter" className={select} value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })}>
            <option value="">All counties</option>
            {catalog.filter_options.county.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <p className="text-[10px] leading-4 text-slate-500">Filters apply to listing performance and the category and county breakdowns only; every other figure is platform-wide.</p>
    </div>
  );
}

type SaveState = Pick<DefinitionIn, "name" | "description"> & {
  schedule: (typeof SCHEDULES)[number]; hour: number; weekday: number; day: number; every: number; recipients: string[];
};

function SaveForm({ catalog, form, onDone }: { catalog: Catalog; form: BuilderForm; onDone: () => void }) {
  const save = useSaveDefinition();
  const [state, setState] = useState<SaveState>({ name: form.title, description: "", schedule: "none", hour: 4, weekday: 0, day: 1, every: 7, recipients: [] });
  const rangeError = state.schedule === "none" ? formError(form, catalog.limits.max_range_days) : null;
  function submit() {
    const spec = formToSpec(form);
    save.mutate({
      name: state.name.trim() || form.title, description: state.description || null, spec,
      schedule: state.schedule, schedule_hour_utc: state.hour,
      schedule_weekday: state.schedule === "weekly" ? state.weekday : null,
      schedule_day: state.schedule === "monthly" ? state.day : null,
      schedule_every_days: state.schedule === "custom" ? state.every : null,
      recipients: state.schedule === "none" ? [] : state.recipients, enabled: true,
    }, { onSuccess: onDone });
  }
  const toggle = (id: string) => setState({ ...state, recipients: state.recipients.includes(id) ? state.recipients.filter((r) => r !== id) : [...state.recipients, id] });
  return (
    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <Field label="Name"><input className={input} value={state.name} maxLength={120} onChange={(e) => setState({ ...state, name: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Schedule">
          <select aria-label="Schedule" className={select} value={state.schedule} onChange={(e) => setState({ ...state, schedule: e.target.value as SaveState["schedule"] })}>
            <option value="none">Not scheduled</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option><option value="custom">Every N days</option>
          </select>
        </Field>
        {state.schedule !== "none" ? (
          <Field label="Hour (UTC; Nairobi is UTC+3)">
            <input aria-label="Hour" type="number" min={0} max={23} className={input} value={state.hour} onChange={(e) => setState({ ...state, hour: Number(e.target.value) })} />
          </Field>
        ) : null}
        {state.schedule === "weekly" ? (
          <Field label="Weekday">
            <select aria-label="Weekday" className={select} value={state.weekday} onChange={(e) => setState({ ...state, weekday: Number(e.target.value) })}>
              {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </Field>
        ) : null}
        {state.schedule === "monthly" ? (
          <Field label="Day of the month (1 to 28)"><input aria-label="Day of the month" type="number" min={1} max={28} className={input} value={state.day} onChange={(e) => setState({ ...state, day: Number(e.target.value) })} /></Field>
        ) : null}
        {state.schedule === "custom" ? (
          <Field label="Every how many days (2 to 90)"><input aria-label="Every how many days" type="number" min={2} max={90} className={input} value={state.every} onChange={(e) => setState({ ...state, every: Number(e.target.value) })} /></Field>
        ) : null}
      </div>
      {state.schedule !== "none" ? (
        <div className="space-y-1 text-xs text-slate-300">
          <p className="text-[11px] text-slate-500">A scheduled run reports on the complete UTC days before it: the day, the 7 days, the month or the N days. The dates above are not used.</p>
          {catalog.email.can_send ? (
            catalog.email.recipients.length ? (
              <fieldset>
                <legend className="text-[11px] font-semibold text-slate-400">Email it to {catalog.email.configured ? "" : "(email is not configured on the server yet)"}</legend>
                {catalog.email.recipients.map((r) => (
                  <label key={r.id} className="mr-3 inline-flex items-center gap-1.5"><input type="checkbox" checked={state.recipients.includes(r.id)} onChange={() => toggle(r.id)} />{r.name ?? r.id}{r.email_hint ? <span className="text-slate-500">({r.email_hint})</span> : null}</label>
                ))}
                <p className="mt-1 text-[10px] text-slate-500">{catalog.email.note}</p>
              </fieldset>
            ) : <p className="text-[11px] text-slate-500">No administrator has an email address to send to.</p>
          ) : <p className="text-[11px] text-slate-500">Emailing reports needs the send-admin-email permission.</p>}
        </div>
      ) : null}
      {rangeError ? <p role="alert" className="text-xs text-rose-200">{rangeError}</p> : null}
      <ErrorLine error={save.error} />
      <div className="flex gap-2">
        <button type="button" className={primary} disabled={save.isPending || Boolean(rangeError)} onClick={submit}><Save size={13} aria-hidden="true" />{save.isPending ? "Saving…" : "Save"}</button>
        <button type="button" className={secondary} onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function SavedReports({ catalog, items, onLoad, onOpen }: {
  catalog: Catalog; items: Definition[]; onLoad: (d: Definition) => void; onOpen: (runId: string) => void;
}) {
  const update = useUpdateDefinition();
  const remove = useDeleteDefinition();
  const run = useRunDefinition();
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!items.length) return <p className="text-sm text-slate-500">No saved report yet. Build one and save it, with or without a schedule.</p>;
  const names = new Map(catalog.email.recipients.map((r) => [r.id, r.name ?? r.id]));
  return (
    <div className="space-y-2">
      <ErrorLine error={update.error ?? remove.error ?? run.error} />
      <ul className="space-y-2">
        {items.map((d) => (
          <li key={d.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">{d.name}</p>
                <p className="mt-0.5 text-slate-400"><CalendarClock size={11} className="mr-1 inline" aria-hidden="true" />{scheduleText(d)}{d.schedule !== "none" && !d.enabled ? " · paused" : ""}</p>
                {d.next_run_at ? <p className="text-slate-500">Next run {relativeTime(d.next_run_at)}</p> : null}
                {d.last_status ? <p className="text-slate-500">Last run <Chip tone={d.last_status === "failed" ? "danger" : "success"}>{d.last_status}</Chip>{d.last_error ? ` ${d.last_error}` : ""}</p> : null}
                {d.recipients.length ? <p className="text-slate-500">Emailed to {d.recipients.map((r) => names.get(r) ?? r).join(", ")}</p> : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={secondary} onClick={() => onLoad(d)}>Edit in builder</button>
                <button type="button" className={secondary} disabled={run.isPending} onClick={() => run.mutate(d.id, { onSuccess: (r) => onOpen(r.id) })}><Play size={12} aria-hidden="true" />Run now</button>
                {d.schedule !== "none" ? (
                  <button type="button" className={secondary} disabled={update.isPending}
                    onClick={() => update.mutate({ id: d.id, patch: { expected_version: d.version, enabled: !d.enabled } })}>
                    {d.enabled ? "Pause" : "Resume"}
                  </button>
                ) : null}
                {confirming === d.id ? (
                  <button type="button" className={`${secondary} border-rose-300/30 text-rose-200`} disabled={remove.isPending} onClick={() => remove.mutate(d.id, { onSuccess: () => setConfirming(null) })}>Confirm removal</button>
                ) : (
                  <button type="button" className={secondary} aria-label={`Remove ${d.name}`} onClick={() => setConfirming(d.id)}><Trash2 size={12} aria-hidden="true" /></button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportBuilder() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const runId = params.get("run");
  const catalog = useAdminResource("reportBuilderCatalog");
  const runsQuery = useMemo(() => new URLSearchParams({ limit: "20" }), []);
  const runs = useAdminResource("reportBuilderRuns", runsQuery);
  const definitions = useAdminResource("reportBuilderDefinitions");
  const run = useAdminDetail("reportBuilderRunDetail", runId ?? "", Boolean(runId));
  const [form, setForm] = useState<BuilderForm>(() => defaultForm());
  const [saving, setSaving] = useState(false);
  const preview = usePreviewReport();
  const create = useCreateRun();
  const regenerate = useRegenerateRun();

  function open(id: string | null) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("run", id); else next.delete("run");
    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  if (catalog.isLoading) return <ResourceState state="loading" message="Loading the report builder…" />;
  if (catalog.isError || !catalog.data) {
    return isEndpointMissing(catalog.error)
      ? <ResourceState state="unavailable" message="The report builder needs the upgraded BROKA API." />
      : <ResourceState state="error" message={catalog.error instanceof Error ? catalog.error.message : "The report builder could not be loaded."} />;
  }
  const cat = catalog.data;
  const error = formError(form, cat.limits.max_range_days);
  const categoryMetrics = Object.fromEntries(cat.categories.map((c) => [c.key, c.metrics]));
  const shown = runId
    ? run.data ? { payload: run.data.payload, stored: true, id: run.data.id, failed: run.data.status === "failed", error: run.data.error } : null
    : preview.data ? { payload: preview.data.payload, stored: false, id: null, failed: false, error: null } : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Report builder"
        description="Choose the figures, the dates and the comparison. Every figure is read from the same source as its dashboard page; one that cannot be measured for the period says why and is left out of the summary."
        meta={<DataFreshness state={runs.isError ? "error" : runs.data ? "ready" : "loading"} generatedAt={runs.data?.generated_at} windowLabel="UTC days" source="GET /admin/report-builder/catalog, /runs and /definitions." />}
        actions={<Link href="/reports" className={secondary}>Founder briefs</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel eyebrow="Build" title="What the report covers">
            <SpecForm catalog={cat} form={form} setForm={setForm} />
            {error ? <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p> : null}
            <ErrorLine error={preview.error ?? create.error} />
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={secondary} disabled={Boolean(error) || preview.isPending}
                onClick={() => { open(null); preview.mutate(formToSpec(form)); }}>
                <Eye size={13} aria-hidden="true" />{preview.isPending ? "Building…" : "Preview"}
              </button>
              <button type="button" className={primary} disabled={Boolean(error) || create.isPending}
                onClick={() => create.mutate({ spec: formToSpec(form) }, { onSuccess: (r) => open(r.id) })}>
                <Play size={13} aria-hidden="true" />{create.isPending ? "Building…" : "Generate and archive"}
              </button>
              <button type="button" className={secondary} onClick={() => setSaving(!saving)}><Save size={13} aria-hidden="true" />Save…</button>
            </div>
            {saving ? <div className="mt-4"><SaveForm catalog={cat} form={form} onDone={() => setSaving(false)} /></div> : null}
          </Panel>

          <Panel eyebrow="Saved" title="Saved and scheduled reports">
            {definitions.isError ? <ResourceState state="error" message="Saved reports could not be loaded." /> : (
              <SavedReports catalog={cat} items={definitions.data?.items ?? []} onOpen={open}
                onLoad={(d) => { setForm(specToForm(d.spec, categoryMetrics)); open(null); }} />
            )}
          </Panel>

          <Panel eyebrow="Archive" title="Generated reports">
            {runs.isError ? <ResourceState state="error" message="The archive could not be loaded." /> : runs.data?.items.length ? (
              <ul className="space-y-1.5">
                {runs.data.items.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => open(r.id)} aria-pressed={r.id === runId}
                      className={`focus-ring w-full rounded-lg border px-3 py-2 text-left text-xs ${r.id === runId ? "border-[#8b75ff]/50 bg-[#8b75ff]/10" : "border-white/[0.07] bg-white/[0.02]"}`}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-100">{r.title}</span>
                        <Chip tone={r.status === "failed" ? "danger" : "neutral"}>{r.status === "failed" ? "failed" : r.trigger}</Chip>
                      </span>
                      <span className="mt-0.5 block text-slate-500">{r.period_label ?? r.period_start.slice(0, 10)} · {r.measured} of {r.metrics} measured · {relativeTime(r.generated_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">Nothing archived yet.</p>}
          </Panel>
        </div>

        <div className="min-w-0">
          {runId && run.isLoading ? <ResourceState state="loading" message="Opening the report…" /> : runId && run.isError ? (
            <ResourceState state={isEndpointMissing(run.error) ? "empty" : "error"} message="This report is not in the archive." />
          ) : shown?.failed ? (
            <ResourceState state="error" message={`This scheduled report failed to build (${shown.error ?? "error"}).`} action={shown.id ? <RegenerateButton pending={regenerate.isPending} onClick={() => regenerate.mutate(shown.id as string, { onSuccess: (r) => open(r.id) })} /> : undefined} />
          ) : shown?.payload ? (
            <BuilderReportView payload={shown.payload} runId={shown.id} stored={shown.stored}
              actions={shown.stored && shown.id ? <RegenerateButton pending={regenerate.isPending} onClick={() => regenerate.mutate(shown.id as string, { onSuccess: (r) => open(r.id) })} /> : undefined} />
          ) : (
            <ResourceState state="empty" message="Preview a report, or open one from the archive." />
          )}
          <ErrorLine error={regenerate.error} />
        </div>
      </div>
    </div>
  );
}
