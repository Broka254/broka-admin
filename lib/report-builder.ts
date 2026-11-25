import type { BuilderKpi, BuilderPayload, Definition, ReportSpec, SpecIn } from "@/lib/api/report-builder-schemas";
import type { CsvRow } from "@/lib/csv";
import { formatKES } from "@/lib/format";
import { formatChange, formatCount, formatPctValue } from "@/lib/intelligence";

// Pure rules for the report builder: the form a spec is edited in, what a
// value looks like in its unit, the CSV a report exports to, and how a
// schedule reads. The backend validates every spec again; these checks only
// save a round trip.

export type RangeMode = "last" | "fixed";

export interface BuilderForm {
  title: string;
  categories: string[];
  metrics: string[];
  rangeMode: RangeMode;
  lastDays: number;
  dateFrom: string;
  dateTo: string;
  comparison: NonNullable<SpecIn["comparison"]>;
  category: string;
  county: string;
  groupBy: NonNullable<SpecIn["group_by"]>;
  visualization: NonNullable<SpecIn["visualization"]>;
}

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function dayMs(value: string): number | null {
  if (!ISO_DAY.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(ms) || utcDay(ms) !== value) return null;
  return ms;
}

export function defaultForm(now: number = Date.now()): BuilderForm {
  const today = Date.parse(`${utcDay(now)}T00:00:00.000Z`);
  return {
    title: "Weekly business review",
    categories: ["business"],
    metrics: [],
    rangeMode: "last",
    lastDays: 7,
    dateFrom: utcDay(today - 7 * DAY_MS),
    dateTo: utcDay(today - DAY_MS),
    comparison: "previous_period",
    category: "",
    county: "",
    groupBy: "none",
    visualization: "auto",
  };
}

/** What is wrong with the form, or null when it can be sent. */
export function formError(form: BuilderForm, maxDays = 366, now: number = Date.now()): string | null {
  if (!form.title.trim()) return "Give the report a title.";
  if (!form.categories.length && !form.metrics.length) return "Choose at least one category or figure.";
  if (form.rangeMode === "last") {
    if (!Number.isInteger(form.lastDays) || form.lastDays < 1 || form.lastDays > maxDays) {
      return `The last 1 to ${maxDays} days.`;
    }
    return null;
  }
  const from = dayMs(form.dateFrom);
  const to = dayMs(form.dateTo);
  if (from === null || to === null) return "Choose a start and an end date.";
  if (to < from) return "The end date is before the start date.";
  if (from > now) return "The start date is in the future.";
  const days = Math.round((to - from) / DAY_MS) + 1;
  if (days > maxDays) return `A report covers at most ${maxDays} days; this one is ${days}.`;
  return null;
}

export function formToSpec(form: BuilderForm): SpecIn {
  const range = form.rangeMode === "last"
    ? { last_days: form.lastDays, date_from: null, date_to: null }
    : { date_from: form.dateFrom, date_to: form.dateTo, last_days: null };
  return {
    title: form.title.trim(),
    categories: form.categories,
    metrics: form.metrics,
    ...range,
    comparison: form.comparison,
    filters: { category: form.category || null, county: form.county || null },
    group_by: form.groupBy,
    visualization: form.visualization,
  };
}

/**
 * A saved spec back in the form. The backend stores the categories' metrics
 * expanded, so only the figures chosen one by one come back as single
 * metrics. A scheduled spec without dates keeps the default range.
 */
export function specToForm(spec: ReportSpec, categoryMetrics: Record<string, string[]> = {}, now: number = Date.now()): BuilderForm {
  const base = defaultForm(now);
  const fixed = Boolean(spec.date_from && spec.date_to);
  const implied = new Set((spec.categories ?? []).flatMap((key) => categoryMetrics[key] ?? []));
  return {
    ...base,
    title: spec.title,
    categories: spec.categories ?? [],
    metrics: (spec.metrics ?? []).filter((key) => !implied.has(key)),
    rangeMode: fixed ? "fixed" : "last",
    lastDays: spec.last_days ?? base.lastDays,
    dateFrom: spec.date_from ?? base.dateFrom,
    dateTo: spec.date_to ?? base.dateTo,
    comparison: spec.comparison,
    category: spec.filters?.category ?? "",
    county: spec.filters?.county ?? "",
    groupBy: spec.group_by,
    visualization: spec.visualization,
  };
}

/** A value in the unit the backend names; null is "not measured", never zero. */
export function formatBuilderValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (unit === "pct") return formatPctValue(value);
  if (unit === "kes_minor") return formatKES(value);
  if (unit === "minutes") return `${value.toFixed(1).replace(/\.0$/, "")} min`;
  if (unit === "ms") return `${Math.round(value).toLocaleString("en-KE")} ms`;
  if (unit === "seconds") return `${value.toFixed(1).replace(/\.0$/, "")} s`;
  if (!Number.isInteger(value)) return value.toLocaleString("en-KE", { maximumFractionDigits: 1 });
  return formatCount(value);
}

/** "+5.2 pts" for a rate, "+20%" otherwise; null when there is no comparison. */
export function changeText(kpi: Pick<BuilderKpi, "unit" | "delta" | "change_pct" | "previous">): string | null {
  if (kpi.previous === null || kpi.delta === null) return null;
  if (kpi.unit === "pct") return `${kpi.delta > 0 ? "+" : kpi.delta < 0 ? "−" : ""}${Math.abs(kpi.delta).toFixed(1)} pts`;
  if (kpi.change_pct === null) return kpi.delta === 0 ? "0%" : "new";
  return formatChange(kpi.change_pct);
}

function csvValue(value: number | null | undefined, unit: string): { value: number | null; unit: string } {
  if (value === null || value === undefined) return { value: null, unit: unit === "kes_minor" ? "KES" : unit };
  if (unit === "kes_minor") return { value: value / 100, unit: "KES" };
  return { value, unit };
}

/**
 * The whole report as one long CSV: a row per figure, per chart point and
 * per table cell, each saying which part of the report it is. Money is in
 * shillings. A figure that was not measured is an empty value with the
 * reason, never a zero.
 */
export function payloadCsvRows(payload: BuilderPayload): CsvRow[] {
  const rows: CsvRow[] = [];
  // period.to is exclusive (the next midnight, or the generation time while
  // the period is still running): the last day reported is the one before it.
  const toMs = Date.parse(payload.period.to);
  const lastDay = Number.isFinite(toMs) ? utcDay(toMs - 1) : payload.period.to.slice(0, 10);
  const period = `${payload.period.from.slice(0, 10)} to ${lastDay} UTC${payload.period.in_progress ? " (in progress)" : ""}`;
  for (const kpi of payload.kpis) {
    const now = csvValue(kpi.value, kpi.unit);
    const before = csvValue(kpi.previous, kpi.unit);
    rows.push({
      part: "figure", section: kpi.category, item: kpi.label, column: "", period,
      value: now.value, previous: before.value, change_pct: kpi.change_pct, unit: now.unit,
      measured: kpi.available ? "yes" : "no", note: kpi.unavailable_reason ?? "", source: kpi.source,
    });
  }
  for (const series of payload.series) {
    for (const p of series.points) {
      const v = csvValue(p.v, series.unit);
      rows.push({
        part: "series", section: series.bucket, item: series.label, column: "", period: p.t.slice(0, 10),
        value: v.value, previous: null, change_pct: null, unit: v.unit,
        measured: p.v === null ? "no" : "yes", note: "", source: payload.sources[series.key] ?? "",
      });
    }
  }
  for (const table of payload.tables) {
    for (const row of table.rows) {
      for (const column of table.columns) {
        if (column.key === "label" || column.unit === "text") continue;
        const raw = row[column.key];
        const v = csvValue(typeof raw === "number" ? raw : null, column.unit);
        rows.push({
          part: "table", section: table.title, item: String(row.label ?? ""), column: column.label, period,
          value: v.value, previous: null, change_pct: null, unit: v.unit,
          measured: typeof raw === "number" ? "yes" : "no", note: "", source: "",
        });
      }
    }
  }
  return rows;
}

export function reportFileStem(title: string, periodFrom: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "report";
  return `broka-${slug}-${periodFrom.slice(0, 10) || "period"}`;
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function hour(h: number): string {
  return `${String(h).padStart(2, "0")}:00 UTC`;
}

export function scheduleText(d: Pick<Definition, "schedule" | "schedule_hour_utc" | "schedule_weekday" | "schedule_day" | "schedule_every_days">): string {
  switch (d.schedule) {
    case "daily": return `Daily at ${hour(d.schedule_hour_utc)}, for the day before`;
    case "weekly": return `Every ${WEEKDAYS[d.schedule_weekday ?? 0]} at ${hour(d.schedule_hour_utc)}, for the 7 days before`;
    case "monthly": return `On day ${d.schedule_day ?? 1} of each month at ${hour(d.schedule_hour_utc)}, for the month before`;
    case "custom": return `Every ${d.schedule_every_days ?? 7} days at ${hour(d.schedule_hour_utc)}, for the days since`;
    default: return "Not scheduled";
  }
}
