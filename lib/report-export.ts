import { downloadCSV, type CsvRow } from "@/lib/csv";
import type { ReportDetail } from "@/lib/api/intelligence-schemas";

/** Hours east of UTC in a label such as "EAT (UTC+3)" or "UTC-5". */
function utcOffsetHours(label: string | undefined): number {
  const match = label?.match(/UTC([+-]\d{1,2})/);
  return match ? Number(match[1]) : 0;
}

type FilenameSource = Pick<ReportDetail, "kind" | "period_start" | "stored"> & { payload?: { period?: { timezone?: string } } };

/**
 * broka-weekly-2026-11-03.md: kind and the period's first local day. The
 * stored start is UTC (21:00 the evening before, in EAT), so it is shifted
 * by the report's timezone to match the period label.
 */
export function reportFilename(report: FilenameSource, extension: "md" | "csv"): string {
  const start = Date.parse(report.period_start);
  const offset = utcOffsetHours(report.payload?.period?.timezone);
  const day = Number.isFinite(start) ? new Date(start + offset * 3_600_000).toISOString().slice(0, 10) : "period";
  return `broka-${report.kind}-${day}${report.stored ? "" : "-to-date"}.${extension}`;
}

/** The report's KPIs as spreadsheet rows; money stays in KES, not cents. */
export function reportKpiRows(report: ReportDetail): CsvRow[] {
  return report.payload.kpis.map((kpi) => {
    const money = kpi.unit === "kes_minor";
    const scale = (value: number | null) => (value === null ? null : money ? value / 100 : value);
    return {
      metric: kpi.label,
      unit: money ? "KES" : kpi.unit,
      value: scale(kpi.value),
      previous: scale(kpi.previous),
      change_pct: kpi.change_pct,
      better_when: kpi.good_direction,
    };
  });
}

/** Plain-text digest for chat apps: headline, then one line per finding. */
export function reportDigest(report: ReportDetail): string {
  const lines = [`${report.title}`, "", report.payload.headline, ""];
  for (const line of report.payload.summary) lines.push(`• ${line}`);
  return lines.join("\n").trim();
}

export function downloadText(filename: string, text: string, type = "text/markdown;charset=utf-8"): void {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadReportMarkdown(report: ReportDetail): void {
  downloadText(reportFilename(report, "md"), report.markdown);
}

export function downloadReportCsv(report: ReportDetail): void {
  downloadCSV(reportFilename(report, "csv"), reportKpiRows(report));
}
