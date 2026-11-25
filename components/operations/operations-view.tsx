"use client";

import { Activity, RefreshCw } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Chip, DataFreshness, PageHeader, Panel, Segmented, toneChip } from "@/components/intelligence/visuals";
import { ResourceState } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import type { Operations, OperationsEndpoint, OperationsSection, OpsMetric } from "@/lib/api/operations-schemas";
import { formatCount, formatPctValue, relativeTime } from "@/lib/intelligence";
import {
  LOOP_STATUS, OPERATION_WINDOWS, bucketLabel, formatAge, formatOpsValue, opsChange, opsChangeTone, type OperationWindow,
} from "@/lib/operations";
import { cn } from "@/lib/utils";

// Is BROKA working, and where not: GET /admin/operations. Sampled figures
// (API, database, pushes, background work) exist only from the first
// operations sample; before it they say so instead of showing zero.

const tooltipStyle = { background: "#13182b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#f7f7fc" };

function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{children}</p>;
}

function MetricTile({ metric }: { metric: OpsMetric }) {
  const change = opsChange(metric);
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3" data-testid={`ops-${metric.key}`}>
      <p className="text-[11px] font-semibold text-slate-300" title={metric.definition}>{metric.label}</p>
      {metric.available ? (
        <>
          <p className="mt-2 font-display text-xl font-bold tabular-nums text-white">{formatOpsValue(metric.value, metric.unit)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {change ? <span className={cn("rounded-full border px-2 py-0.5 font-semibold", toneChip(opsChangeTone(metric)))}>{change}</span> : null}
            {metric.previous !== null ? <span>before {formatOpsValue(metric.previous, metric.unit)}</span> : metric.kind === "point" ? <span>now</span> : null}
          </div>
          {metric.caption ? <p className="mt-1 text-[11px] leading-4 text-slate-500">{metric.caption}</p> : null}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold text-slate-500">Not measured</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">{metric.unavailable_reason}</p>
        </>
      )}
      <p className="sr-only">{metric.definition}</p>
    </div>
  );
}

function Metrics({ section }: { section: OperationsSection }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{section.metrics.map((m) => <MetricTile key={m.key} metric={m} />)}</div>;
}

function Trend({ title, points, unit, hours }: { title: string; points: Array<{ t: string; v: number | null }>; unit: string; hours: number }) {
  const measured = points.filter((p) => p.v !== null).length;
  return (
    <figure className="space-y-1">
      <figcaption className="text-[11px] text-slate-400">{title} · {measured} of {points.length} periods sampled (UTC)</figcaption>
      <div className="h-40" role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(195,202,226,0.1)" vertical={false} />
            <XAxis dataKey="t" tickFormatter={(value: string) => bucketLabel(value, hours)} tick={{ fill: "#9ba4bc", fontSize: 10 }} tickLine={false} minTickGap={28} />
            <YAxis tick={{ fill: "#9ba4bc", fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
            <Tooltip labelFormatter={(value: string) => bucketLabel(String(value), hours)} formatter={(value) => [formatOpsValue(typeof value === "number" ? value : null, unit), title]} contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="v" stroke="#8b75ff" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function EndpointTable({ title, rows }: { title: string; rows: OperationsEndpoint[] }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      {rows.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <caption className="sr-only">{title}</caption>
            <thead><tr><Th>Endpoint</Th><Th right>Requests</Th><Th right>5xx</Th><Th right>4xx</Th><Th right>p95</Th><Th right>Max</Th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.route} className="border-t border-white/[0.06]">
                  <td className="px-2 py-1.5 font-mono text-[11px] text-slate-200">{e.route}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(e.requests)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(e.server_errors)}{e.error_rate ? <span className="text-slate-500"> ({formatPctValue(e.error_rate)})</span> : null}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(e.client_errors)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatOpsValue(e.p95_ms, "ms")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatOpsValue(e.max_ms, "ms")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-2 text-sm text-slate-500">None in this window.</p>}
    </div>
  );
}

function ApiPanel({ section, data }: { section: OperationsSection; data: Operations }) {
  const hours = data.window.hours;
  return (
    <Panel id="api" eyebrow="API" title="Requests, errors and latency" description={data.definitions.latency}>
      <Metrics section={section} />
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Trend title="Requests" points={data.series.requests} unit="count" hours={hours} />
        <Trend title="Server error rate" points={data.series.error_rate} unit="percent" hours={hours} />
        <Trend title="Latency p95" points={data.series.p95_ms} unit="ms" hours={hours} />
      </div>
      {section.endpoints ? (
        <div className="mt-5 space-y-5">
          <EndpointTable title="Busiest endpoints" rows={section.endpoints.busiest} />
          <div className="grid gap-5 xl:grid-cols-2">
            <EndpointTable title="Slowest endpoints (20 requests or more)" rows={section.endpoints.slowest} />
            <EndpointTable title="Endpoints answering 5xx" rows={section.endpoints.failing} />
          </div>
          {section.endpoints.note ? <p className="text-[11px] text-slate-500">{section.endpoints.note}</p> : null}
        </div>
      ) : null}
    </Panel>
  );
}

function DatabasePanel({ section, data }: { section: OperationsSection; data: Operations }) {
  const live = section.live ?? {};
  const kinds = Object.entries(section.unavailable_by_kind ?? {});
  return (
    <Panel id="database" eyebrow="Database" title="Pool, statements and outages" description={data.definitions.pool_utilization}>
      <Metrics section={section} />
      <p className="mt-3 text-xs text-slate-400">
        This process now: {formatCount(live.checked_out ?? null)} of {formatCount(live.max_connections ?? null)} connections checked out
        {live.timeout_s !== undefined && live.timeout_s !== null ? `, waits up to ${live.timeout_s} s for one` : ""}. {section.live_note}
      </p>
      {kinds.length ? <p className="mt-2 text-xs text-slate-400">Refused requests by cause: {kinds.map(([k, n]) => `${k.replaceAll("_", " ")} ${n}`).join(" · ")}</p> : null}
    </Panel>
  );
}

function PaymentsPanel({ section, data }: { section: OperationsSection; data: Operations }) {
  return (
    <Panel id="payments" eyebrow="Payments" title="Payment outcomes" description={data.definitions.payment_success}>
      <Metrics section={section} />
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div>
          <Eyebrow>By provider</Eyebrow>
          {section.providers?.length ? (
            <table className="mt-2 w-full text-xs">
              <caption className="sr-only">Payments by provider</caption>
              <thead><tr><Th>Provider</Th><Th right>Succeeded</Th><Th right>Failed</Th><Th right>Pending</Th><Th right>Success rate</Th></tr></thead>
              <tbody>{section.providers.map((p) => (
                <tr key={p.source} className="border-t border-white/[0.06]">
                  <td className="px-2 py-1.5 text-slate-200">{p.source === "mpesa" ? "M-Pesa (Daraja)" : p.source === "zetupay" ? "ZetuPay" : p.source}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(p.success)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(p.failed)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(p.pending)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatPctValue(p.success_pct)}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="mt-2 text-sm text-slate-500">No payment attempt in this window.</p>}
        </div>
        <div>
          <Eyebrow>Failure reasons (digits masked)</Eyebrow>
          {section.errors?.length ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-300">{section.errors.map((e) => <li key={`${e.source}-${e.pattern}`}><Chip>{e.source}</Chip> {e.pattern} <span className="text-slate-500">× {e.count}</span></li>)}</ul>
          ) : <p className="mt-2 text-sm text-slate-500">No failed payment in this window.</p>}
        </div>
      </div>
    </Panel>
  );
}

function NotificationsPanel({ section, data }: { section: OperationsSection; data: Operations }) {
  return (
    <Panel id="notifications" eyebrow="Notifications" title="Pushes and chat delivery" description={`${data.definitions.push_accepted} ${data.definitions.message_delivered}`}>
      <Metrics section={section} />
      {section.failure_codes?.length ? <p className="mt-3 text-xs text-slate-400">FCM answers for failed pushes: {section.failure_codes.map((c) => `${c.code} ${c.count}`).join(" · ")}</p> : null}
    </Panel>
  );
}

function CallsPanel({ section, data }: { section: OperationsSection; data: Operations }) {
  return (
    <Panel id="calls" eyebrow="Calls" title="Call outcomes" description={data.definitions.calls}>
      <Metrics section={section} />
      {section.outcomes?.length ? (
        <p className="mt-3 text-xs text-slate-400">{section.outcomes.map((o) => `${o.outcome.replaceAll("_", " ")} ${o.count} (before ${o.previous})`).join(" · ")}</p>
      ) : null}
    </Panel>
  );
}

function BackgroundPanel({ section, data }: { section: OperationsSection; data: Operations }) {
  return (
    <Panel id="background" eyebrow="Background" title="Loops, queues and failed jobs" description={data.definitions.loop}>
      <Metrics section={section} />
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <caption className="sr-only">Background loops</caption>
          <thead><tr><Th>Loop</Th><Th>Status</Th><Th right>Last pass</Th><Th right>Took</Th><Th right>Passes</Th><Th right>Failures</Th><Th>Failing tasks</Th></tr></thead>
          <tbody>{(section.loops ?? []).map((loop) => {
            const meta = LOOP_STATUS[loop.status] ?? LOOP_STATUS.unknown;
            return (
              <tr key={loop.name} className="border-t border-white/[0.06]">
                <td className="px-2 py-1.5 text-slate-200">{loop.label}<p className="text-[10px] text-slate-500">every {formatAge(loop.interval_seconds)}</p></td>
                <td className="px-2 py-1.5"><Chip tone={meta.tone}>{meta.label}</Chip></td>
                <td className="px-2 py-1.5 text-right tabular-nums">{loop.last_pass_age_seconds !== null ? `${formatAge(loop.last_pass_age_seconds)} ago` : "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatOpsValue(loop.last_pass_ms, "ms")}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(loop.passes)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(loop.failures)}</td>
                <td className="px-2 py-1.5 text-slate-400">{loop.failing_tasks.length ? loop.failing_tasks.map((t) => `${t.task.replaceAll("_", " ")} ${t.count}`).join(", ") : "—"}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div>
          <Eyebrow>In-process queues</Eyebrow>
          {section.queues?.length ? (
            <table className="mt-2 w-full text-xs">
              <caption className="sr-only">Queues</caption>
              <thead><tr><Th>Queue</Th><Th right>Waiting</Th><Th right>Done</Th><Th right>Failed</Th><Th right>Dropped</Th></tr></thead>
              <tbody>{section.queues.map((q) => (
                <tr key={q.name} className="border-t border-white/[0.06]">
                  <td className="px-2 py-1.5 text-slate-200">{q.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(q.depth)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(q.done)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(q.failed)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(q.dropped)}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="mt-2 text-sm text-slate-500">No queued job in this window.</p>}
        </div>
        <div>
          <Eyebrow>Items that failed inside a task</Eyebrow>
          {section.item_failures?.length ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-300">{section.item_failures.map((i) => <li key={i.item}>{i.item.replaceAll("_", " ")} × {i.count}</li>)}</ul>
          ) : <p className="mt-2 text-sm text-slate-500">None in this window.</p>}
        </div>
      </div>
    </Panel>
  );
}

const PANELS: Record<string, (props: { section: OperationsSection; data: Operations }) => ReactNode> = {
  api: ApiPanel, database: DatabasePanel, payments: PaymentsPanel, notifications: NotificationsPanel,
  calls: CallsPanel, background: BackgroundPanel,
};

const FIGURE_STATUS: Record<string, { label: string; tone: "danger" | "success" | "warning" | "neutral" }> = {
  flagged: { label: "Flagged", tone: "danger" },
  normal: { label: "Normal", tone: "success" },
  insufficient_history: { label: "Too little history", tone: "warning" },
  not_measured: { label: "Not measured", tone: "neutral" },
};

// Unusual changes against each figure's own history (GET /admin/operations/anomalies).
// A figure without enough history, or without samples for the day, says so: it
// is never compared with zero.
function AnomaliesPanel() {
  const anomalies = useAdminResource("operationsAnomalies");
  const data = anomalies.data;
  return (
    <Panel id="unusual" eyebrow="Anomalies" title="Unusual changes on the last complete day"
      description="Each figure is compared with the 28 days before it. A day counts only with enough samples, and a figure needs seven measured days of history before it is judged.">
      {anomalies.isLoading ? (
        <ResourceState state="loading" message="Comparing the figures with their history…" />
      ) : anomalies.isError ? (
        isEndpointMissing(anomalies.error) ? (
          <ResourceState state="unavailable" message="Unusual-change checks need the upgraded BROKA API." />
        ) : (
          <ResourceState state="error" message="Unusual changes could not be checked." />
        )
      ) : data ? (
        <div className="space-y-5">
          {data.anomalies.length ? (
            <ul className="space-y-3">
              {data.anomalies.map((a) => (
                <li key={a.key} data-testid={`anomaly-${a.key}`} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-100">{a.what_happened}</p>
                    <Chip tone={a.severity === "high" ? "danger" : "warning"}>{a.severity}</Chip>
                  </div>
                  <p className="mt-1 text-slate-400">
                    Observed {formatOpsValue(a.observed, a.unit)} against a median of {formatOpsValue(a.baseline_median, a.unit)} over {a.baseline_days} measured days before it (z {a.z_score}).
                  </p>
                  <p className="mt-1 text-slate-400">Impact: {a.impact}</p>
                  <p className="mt-1 text-slate-300">Check: {a.suggested_action}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Source: {a.source}. Day: {a.date} (UTC).</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No figure moved outside its usual range on {data.evaluated_day} (UTC).</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <caption className="sr-only">Each figure against its history</caption>
              <thead><tr><Th>Figure</Th><Th>Status</Th><Th right>Observed</Th><Th right>Usual</Th><Th right>Measured days before</Th></tr></thead>
              <tbody>
                {data.figures.map((f) => {
                  const status = FIGURE_STATUS[f.status] ?? FIGURE_STATUS.not_measured;
                  return (
                    <tr key={f.key} className="border-t border-white/[0.06]">
                      <td className="px-2 py-1.5 text-slate-200">{f.label}</td>
                      <td className="px-2 py-1.5">
                        <Chip tone={status.tone}>{status.label}</Chip>
                        {f.reason ? <p className="mt-1 text-[10px] text-slate-500">{f.reason}</p> : null}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatOpsValue(f.observed, f.unit)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatOpsValue(f.baseline_median, f.unit)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(f.baseline_days)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.not_covered.length ? (
            <div>
              <Eyebrow>Not judged yet</Eyebrow>
              <ul className="mt-1 space-y-1 text-xs text-slate-400">
                {data.not_covered.map((n) => <li key={n.figure}><span className="font-semibold text-slate-300">{n.figure}:</span> {n.reason}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

export function OperationsView() {
  const [windowValue, setWindowValue] = useState<OperationWindow>("24");
  const query = useMemo(() => new URLSearchParams({ window_hours: windowValue }), [windowValue]);
  const operations = useAdminResource("operations", query);
  const data = operations.data;
  const coverage = data?.coverage;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System"
        icon={<Activity size={14} />}
        title="Operations"
        description="Whether BROKA is working, and where not: the API, the database, payments, notifications, calls and background work, against the window before."
        meta={<DataFreshness state={operations.isLoading ? "loading" : operations.isError ? "error" : data ? "ready" : "unavailable"} generatedAt={data?.generated_at} windowLabel={`last ${OPERATION_WINDOWS.find((w) => w.value === windowValue)?.label}`} source="GET /admin/operations: ops_samples written by every API process once a minute, and payment, delivery and call rows." />}
        actions={<Segmented label="Window" value={windowValue} options={[...OPERATION_WINDOWS]} onChange={setWindowValue} />}
      />
      {operations.isLoading ? <ResourceState state="loading" message="Reading the operations samples…" /> : operations.isError ? (
        isEndpointMissing(operations.error)
          ? <ResourceState state="unavailable" message="The operations workspace needs the upgraded BROKA API." />
          : <ResourceState state="error" message={operations.error instanceof Error ? operations.error.message : "Operations could not be loaded."} action={<button type="button" onClick={() => void operations.refetch()} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200"><RefreshCw size={12} aria-hidden="true" />Retry</button>} />
      ) : data && coverage ? (
        <>
          <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-xs text-slate-400" aria-label="Sampling coverage">
            {coverage.sampling_started_at ? (
              <p>
                Sampling began {relativeTime(coverage.sampling_started_at)}. {formatCount(coverage.samples)} samples from {formatCount(coverage.instances_in_window)} process{coverage.instances_in_window === 1 ? "" : "es"} in this window; {formatCount(coverage.instances_reporting)} reporting in the last 3 minutes.
                {coverage.truncated ? " The window has more samples than one read takes; the oldest are left out." : ""}
              </p>
            ) : <p>No operations sample has been recorded yet. Each API process writes one a minute once the upgraded API runs; payments, chat delivery and calls are read from their own records meanwhile.</p>}
          </section>
          <AnomaliesPanel />
          {data.sections.map((section) => {
            const Render = PANELS[section.key];
            return Render ? <div key={section.key}>{Render({ section, data })}</div> : (
              <Panel key={section.key} title={section.title}><Metrics section={section} /></Panel>
            );
          })}
          <Panel eyebrow="Limits" title="Not measured" description="What these figures cannot tell, and why.">
            <ul className="space-y-1 text-xs text-slate-400">
              {data.not_instrumented.map((n) => <li key={n.metric}><span className="font-semibold text-slate-300">{n.metric.replaceAll("_", " ")}:</span> {n.reason}</li>)}
            </ul>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
