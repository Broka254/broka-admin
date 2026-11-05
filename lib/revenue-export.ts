import type { RevenueResponse } from "@/lib/api/revenue";
import type { DateRangeSelection } from "@/components/dashboard/date-range-picker";
import type { CsvRow } from "@/lib/csv";

/**
 * Export every part of the visible report in one flat, filterable CSV:
 * summary, time buckets, income streams, cost kinds, and finance notes.
 * Monetary values stay in integer minor units to avoid floating-point loss.
 */
export function buildRevenueCsvRows(
  data: RevenueResponse,
  selection: DateRangeSelection,
): CsvRow[] {
  const rows: CsvRow[] = [
    {
      section: "summary",
      from: selection.from,
      through: selection.to,
      bucket: selection.bucket,
      currency: data.currency,
      label: "Platform income",
      amount_minor: data.income.total_minor,
      count: "",
      estimated: false,
      income_minor: data.income.total_minor,
      costs_minor: data.costs.total_minor,
      profit_minor: data.profit_minor,
      margin_pct: data.margin_pct,
    },
    {
      section: "summary",
      from: selection.from,
      through: selection.to,
      bucket: selection.bucket,
      currency: data.currency,
      label: "Estimated costs",
      amount_minor: data.costs.estimated_minor,
      count: "",
      estimated: true,
      income_minor: "",
      costs_minor: "",
      profit_minor: "",
      margin_pct: "",
    },
  ];

  for (const point of data.series) {
    rows.push({
      section: "time_bucket",
      from: selection.from,
      through: selection.to,
      bucket: data.bucket,
      currency: data.currency,
      bucket_start: point.bucket_start,
      income_minor: point.income_minor,
      costs_minor: point.costs_minor,
      profit_minor: point.profit_minor,
    });
  }

  for (const stream of data.income.streams) {
    rows.push({
      section: "income_stream",
      from: selection.from,
      through: selection.to,
      bucket: data.bucket,
      currency: data.currency,
      key: stream.key,
      label: stream.label,
      amount_minor: stream.amount_minor,
      count: stream.count,
      estimated: false,
    });
  }

  for (const kind of data.costs.kinds) {
    rows.push({
      section: "cost_kind",
      from: selection.from,
      through: selection.to,
      bucket: data.bucket,
      currency: data.currency,
      key: kind.key,
      label: kind.label,
      amount_minor: kind.amount_minor,
      count: kind.count,
      estimated: kind.estimated,
    });
  }

  for (const note of data.notes) {
    rows.push({
      section: "finance_note",
      from: selection.from,
      through: selection.to,
      bucket: data.bucket,
      currency: data.currency,
      label: note,
    });
  }

  return rows;
}
