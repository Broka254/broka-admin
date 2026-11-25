// Formatting and comparison rules for the Command Center's figures
// (GET /admin/command-center). A null is a value the backend did not measure;
// nothing here turns it into a zero.

import { formatDuration } from "@/lib/activity-format";
import type { CommandMetric } from "@/lib/api/schemas";
import { formatKES } from "@/lib/format";

const DASH = "—";

export type TrendTone = "good" | "bad" | "neutral";
export type Trend = {
  direction: "up" | "down" | "flat" | "none";
  tone: TrendTone;
  /** "+12.5%", "-3.1 pp", "+4", or why there is no comparison. */
  text: string;
};

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatMetricValue(unit: string, value: number | null | undefined): string {
  if (!isNumber(value)) return DASH;
  switch (unit) {
    case "kes_minor":
      return formatKES(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "ms":
      return `${value.toLocaleString("en-KE", { maximumFractionDigits: 1 })} ms`;
    case "seconds":
      return formatDuration(value);
    default:
      return Math.round(value).toLocaleString("en-KE");
  }
}

function signed(text: string, value: number): string {
  return value > 0 ? `+${text}` : value < 0 ? `-${text}` : text;
}

/** The change shown beside a figure, and whether it is good news. */
export function metricTrend(metric: Pick<CommandMetric, "available" | "value" | "previous" | "delta" | "change_pct" | "unit" | "good" | "kind">): Trend {
  if (!metric.available) return { direction: "none", tone: "neutral", text: "Not measured" };
  if (!isNumber(metric.value) || !isNumber(metric.previous) || !isNumber(metric.delta)) {
    const text = metric.kind === "point_in_time" ? "Point in time" : metric.kind === "live" ? "Live reading" : "No earlier figure";
    return { direction: "none", tone: "neutral", text };
  }
  const delta = metric.delta;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  let text: string;
  if (metric.unit === "percent") {
    // A rate compares in percentage points: 40% to 50% is +10 pp, not +25%.
    text = signed(`${Math.abs(delta).toFixed(1)} pp`, delta);
  } else if (isNumber(metric.change_pct)) {
    text = signed(`${Math.abs(metric.change_pct).toFixed(1)}%`, metric.change_pct);
  } else {
    // From zero (or an unknown base) a percentage would be infinite: say the amount.
    text = signed(formatMetricValue(metric.unit, Math.abs(delta)), delta);
  }
  if (direction === "flat" || metric.good === "neutral") return { direction, tone: "neutral", text };
  const better = metric.good === "down" ? direction === "down" : direction === "up";
  return { direction, tone: better ? "good" : "bad", text };
}

export type AttentionCounts = { critical: number; warning: number; total: number };

/** How many decisions need someone: critical and warning, not opportunities or good news. */
export function attentionCounts(decisions: { insights: Array<{ severity: string }> } | undefined): AttentionCounts {
  const critical = decisions?.insights.filter((d) => d.severity === "critical").length ?? 0;
  const warning = decisions?.insights.filter((d) => d.severity === "warning").length ?? 0;
  return { critical, warning, total: critical + warning };
}
