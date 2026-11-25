"use client";

import { Download, FileText, Printer, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Chip, DeltaChip } from "@/components/intelligence/visuals";
import type { BuilderKpi, BuilderPayload, BuilderSeries, BuilderTable } from "@/lib/api/report-builder-schemas";
import { downloadCSV } from "@/lib/csv";
import { formatDateTime, formatShortDate } from "@/lib/format";
import { changeText, formatBuilderValue, payloadCsvRows, reportFileStem } from "@/lib/report-builder";

// One report builder payload, as stored: the same figures the PDF and the CSV
// carry. Nothing is recomputed here; a figure the backend could not measure
// says so and why.

const tooltipStyle = { background: "#13182b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#f7f7fc" };

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{children}</p>;
}

function Block({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-white/[0.06] pt-5 first:border-t-0 first:pt-0">
      <h3 className="font-display text-base font-bold text-white">{title}</h3>
      {children}
      {note ? <p className="text-[11px] leading-4 text-slate-500">{note}</p> : null}
    </section>
  );
}

function KpiCard({ kpi }: { kpi: BuilderKpi }) {
  const change = changeText(kpi);
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3" data-testid={`kpi-${kpi.key}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-300" title={kpi.definition}>{kpi.label}</p>
        {kpi.filtered ? <Chip tone="info">filtered</Chip> : null}
      </div>
      {kpi.available ? (
        <>
          <p className="mt-2 font-display text-xl font-bold tabular-nums text-white">{formatBuilderValue(kpi.value, kpi.unit)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {kpi.kind === "point" ? <span>As of generation</span> : kpi.previous !== null ? (
              <>
                {kpi.unit === "pct" ? <span className="font-semibold text-slate-300">{change}</span> : <DeltaChip change={kpi.change_pct} good={kpi.good === "down" ? "down" : kpi.good === "neutral" ? "neutral" : "up"} />}
                <span>before {formatBuilderValue(kpi.previous, kpi.unit)}</span>
              </>
            ) : <span>No comparison</span>}
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold text-slate-500">Not measured</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">{kpi.unavailable_reason}</p>
        </>
      )}
    </div>
  );
}

function SeriesChart({ series }: { series: BuilderSeries }) {
  const money = series.unit === "kes_minor";
  const rows = series.points.map((p) => ({ t: p.t, v: p.v === null ? null : money ? p.v / 100 : p.v }));
  const measured = series.points.filter((p) => p.v !== null).length;
  if (!measured) return <p className="text-sm text-slate-500">{series.label}: no measured value in this period.</p>;
  if (series.visualization === "table") {
    return (
      <table className="w-full max-w-md text-xs">
        <caption className="sr-only">{series.label} by {series.bucket}</caption>
        <thead><tr><th className="px-2 py-1 text-left text-[10px] uppercase tracking-[0.12em] text-slate-500">Starting</th><th className="px-2 py-1 text-right text-[10px] uppercase tracking-[0.12em] text-slate-500">{series.label}</th></tr></thead>
        <tbody>{series.points.map((p) => <tr key={p.t} className="border-t border-white/[0.05]"><td className="px-2 py-1 text-slate-300">{p.t.slice(0, 10)}</td><td className="px-2 py-1 text-right tabular-nums">{formatBuilderValue(p.v, series.unit)}</td></tr>)}</tbody>
      </table>
    );
  }
  const axis = { tick: { fill: "#9ba4bc", fontSize: 11 }, tickLine: false };
  return (
    <figure className="space-y-1" data-testid={`series-${series.key}`}>
      <figcaption className="text-[11px] text-slate-400">{series.label} by {series.bucket}{money ? " (KES)" : ""} · {measured} of {series.points.length} measured{series.note ? ` · ${series.note}` : ""}</figcaption>
      <div className="h-52" role="img" aria-label={`${series.label} by ${series.bucket}`}>
        <ResponsiveContainer width="100%" height="100%">
          {series.visualization === "bar" ? (
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(195,202,226,0.1)" vertical={false} />
              <XAxis dataKey="t" tickFormatter={(value: string) => formatShortDate(value)} axisLine={{ stroke: "rgba(195,202,226,0.2)" }} minTickGap={24} {...axis} />
              <YAxis axisLine={false} width={56} {...axis} />
              <Tooltip labelFormatter={(value: string) => formatShortDate(String(value))} contentStyle={tooltipStyle} />
              <Bar dataKey="v" name={series.label} fill="#8b75ff" isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(195,202,226,0.1)" vertical={false} />
              <XAxis dataKey="t" tickFormatter={(value: string) => formatShortDate(value)} axisLine={{ stroke: "rgba(195,202,226,0.2)" }} minTickGap={24} {...axis} />
              <YAxis axisLine={false} width={56} {...axis} />
              <Tooltip labelFormatter={(value: string) => formatShortDate(String(value))} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="v" name={series.label} stroke="#8b75ff" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function DataTable({ table }: { table: BuilderTable }) {
  return (
    <div className="space-y-2">
      <Eyebrow>{table.title}</Eyebrow>
      {table.rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <caption className="sr-only">{table.title}</caption>
            <thead><tr>{table.columns.map((c) => <th key={c.key} scope="col" className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${c.unit === "text" ? "text-left" : "text-right"}`}>{c.label}</th>)}</tr></thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={`${row.label ?? index}-${index}`} className="border-t border-white/[0.06]">
                  {table.columns.map((c) => {
                    const value = row[c.key];
                    return <td key={c.key} className={`px-2 py-1.5 ${c.unit === "text" ? "text-left text-slate-200" : "text-right tabular-nums text-slate-300"}`}>{c.unit === "text" ? (value ?? "—") : formatBuilderValue(typeof value === "number" ? value : null, c.unit)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-500">Nothing to show for this period.</p>}
      {table.note ? <p className="text-[11px] text-slate-500">{table.note}</p> : null}
    </div>
  );
}

export function BuilderReportView({ payload, runId, stored, actions }: {
  payload: BuilderPayload; runId?: string | null; stored: boolean; actions?: ReactNode;
}) {
  const kpis = new Map(payload.kpis.map((k) => [k.key, k]));
  const series = new Map(payload.series.map((s) => [s.key, s]));
  const stem = reportFileStem(payload.title, payload.period.from);
  const pdfHref = stored && runId ? `/api/broka/report-builder/runs/${encodeURIComponent(runId)}/pdf` : null;

  return (
    <article className="holo-panel space-y-6 p-5 sm:p-6" data-print-root aria-labelledby="builder-report-title">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={stored ? "success" : "info"}>{stored ? "Stored" : "Preview · not stored"}</Chip>
            {payload.period.in_progress ? <Chip tone="warning">Period in progress</Chip> : null}
            {payload.filters.note ? <Chip tone="info">Filtered</Chip> : null}
          </div>
          <h2 id="builder-report-title" className="mt-2 font-display text-xl font-bold text-white">{payload.title}</h2>
          <p className="mt-1 text-xs text-slate-400">
            {payload.period.label} (UTC){payload.comparison ? ` · compared with ${payload.comparison.label}` : " · no comparison"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Generated {formatDateTime(payload.generated_at)} · data as of {formatDateTime(payload.data_as_of)}</p>
        </div>
        <div className="print-hidden flex flex-wrap items-center gap-2">
          {actions}
          <button type="button" onClick={() => downloadCSV(`${stem}.csv`, payloadCsvRows(payload))} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200"><Download size={13} aria-hidden="true" />CSV</button>
          {pdfHref ? (
            <a href={pdfHref} download className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200"><FileText size={13} aria-hidden="true" />PDF</a>
          ) : (
            <button type="button" disabled title="Save the report to the archive to download its PDF." className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-500 opacity-60"><FileText size={13} aria-hidden="true" />PDF after saving</button>
          )}
          <button type="button" onClick={() => window.print()} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200"><Printer size={13} aria-hidden="true" />Print</button>
        </div>
      </header>

      <Block title="Executive summary">
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-200">
          {payload.executive_summary.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </Block>

      {payload.sections.map((section) => (
        <Block key={section.key} title={section.title}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {section.kpis.map((key) => kpis.get(key)).filter((k): k is BuilderKpi => Boolean(k)).map((k) => <KpiCard key={k.key} kpi={k} />)}
          </div>
          {section.series.map((key) => series.get(key)).filter((s): s is BuilderSeries => Boolean(s)).map((s) => <SeriesChart key={s.key} series={s} />)}
        </Block>
      ))}

      <Block title="Important changes" note={payload.comparison ? "A move of 20% or more on a base of at least 10, or 5 points for a rate." : undefined}>
        {payload.changes.length ? (
          <ul className="space-y-1.5 text-sm">
            {payload.changes.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center gap-2">
                <Chip tone={c.direction === "worse" ? "danger" : c.direction === "better" ? "success" : "neutral"}>{c.direction}</Chip>
                <span className="text-slate-200">{c.label}: {formatBuilderValue(c.previous, c.unit)} to {formatBuilderValue(c.value, c.unit)}</span>
                <span className="text-slate-500">({changeText({ unit: c.unit, delta: c.delta, change_pct: c.change_pct, previous: c.previous })})</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">{payload.comparison ? "No measured figure moved enough to call out." : "No comparison was chosen."}</p>}
      </Block>

      <Block title="Significant anomalies" note={payload.anomalies.note}>
        {payload.anomalies.items.length ? (
          <ul className="space-y-2">
            {payload.anomalies.items.map((a) => (
              <li key={`${a.metric}-${a.date}`} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs">
                <p className="font-semibold text-slate-100">{a.label} on {a.date}: {a.observed} against a usual {a.baseline_median} <Chip tone={a.severity === "high" ? "danger" : "warning"}>{a.severity}</Chip></p>
                <p className="mt-1 text-slate-400">{a.impact}. z {a.z_score}. Source: {a.source}.</p>
                <p className="mt-1 text-slate-300">Check: {a.suggested_action}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">No day stood out against its usual weekday.</p>}
      </Block>

      <Block title="Actionable observations">
        {payload.observations.length ? (
          <ul className="space-y-2">
            {payload.observations.map((o) => (
              <li key={o.text} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs">
                <p className="text-sm text-slate-100">{o.text}</p>
                {o.action ? <p className="mt-1 text-slate-300"><span className="font-semibold text-[#ded8ff]">Check:</span> {o.action}</p> : null}
                <p className="mt-1 text-slate-500">Based on {o.evidence.map((e) => `${e.label} (${e.source})`).join(", ")}.</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">Nothing in this period&apos;s figures calls for action.</p>}
      </Block>

      {payload.tables.length ? (
        <Block title="Supporting tables">
          <div className="space-y-5">{payload.tables.map((t) => <DataTable key={t.key} table={t} />)}</div>
        </Block>
      ) : null}

      {payload.unavailable.length ? (
        <Block title="Not measured">
          <ul className="space-y-1 text-xs text-slate-400">
            {payload.unavailable.map((u) => <li key={u.key}><span className="font-semibold text-slate-300">{u.label}:</span> {u.reason}</li>)}
          </ul>
        </Block>
      ) : null}

      <Block title="Data sources and definitions">
        <details className="text-xs text-slate-400">
          <summary className="focus-ring cursor-pointer text-slate-300">{payload.kpis.length} figures</summary>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {payload.kpis.map((k) => (
              <div key={k.key}><dt className="font-semibold text-slate-300">{k.label}</dt><dd>{k.definition} <span className="text-slate-500">Source: {k.source}.</span></dd></div>
            ))}
          </dl>
        </details>
        <ul className="list-disc space-y-1 pl-5 text-[11px] text-slate-500">
          {payload.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </Block>
    </article>
  );
}

export function RegenerateButton({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={pending} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/35 bg-[#8b75ff]/10 px-3 py-1.5 text-xs font-semibold text-[#ded8ff] disabled:opacity-50">
      <RefreshCw size={13} aria-hidden="true" />{pending ? "Rebuilding…" : "Regenerate"}
    </button>
  );
}
