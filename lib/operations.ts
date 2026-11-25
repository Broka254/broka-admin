import type { Tone } from "@/lib/intelligence";
import { formatChange, formatCount, formatPctValue } from "@/lib/intelligence";

// Presentation rules for the operations workspace (GET /admin/operations).

export const OPERATION_WINDOWS = [
  { value: "1", label: "1 hour" },
  { value: "6", label: "6 hours" },
  { value: "24", label: "24 hours" },
  { value: "168", label: "7 days" },
] as const;
export type OperationWindow = (typeof OPERATION_WINDOWS)[number]["value"];

/** A value in the unit the backend names; null is "not measured", never zero. */
export function formatOpsValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (unit === "percent" || unit === "pct") return formatPctValue(value);
  if (unit === "ms") return `${Math.round(value).toLocaleString("en-KE")} ms`;
  if (unit === "seconds") return `${value.toFixed(1).replace(/\.0$/, "")} s`;
  if (unit === "minutes") return `${value.toFixed(1).replace(/\.0$/, "")} min`;
  return formatCount(value);
}

/** The change against the window before: points for a rate, a percentage otherwise. */
export function opsChange(metric: { unit: string; previous: number | null; delta: number | null; change_pct: number | null }): string | null {
  if (metric.previous === null || metric.delta === null) return null;
  if (metric.unit === "percent") {
    const sign = metric.delta > 0 ? "+" : metric.delta < 0 ? "−" : "";
    return `${sign}${Math.abs(metric.delta).toFixed(1)} pts`;
  }
  return metric.change_pct === null ? (metric.delta === 0 ? "0%" : "new") : formatChange(metric.change_pct);
}

/** Green when the change is what the business wants for this figure. */
export function opsChangeTone(metric: { good: string; delta: number | null }): Tone {
  if (metric.delta === null || metric.delta === 0 || metric.good === "neutral") return "neutral";
  const better = metric.good === "down" ? metric.delta < 0 : metric.delta > 0;
  return better ? "success" : "danger";
}

export const LOOP_STATUS: Record<string, { label: string; tone: Tone }> = {
  ok: { label: "Running", tone: "success" },
  stale: { label: "Stale", tone: "danger" },
  no_pass: { label: "No pass recorded", tone: "warning" },
  unknown: { label: "Not sampled", tone: "neutral" },
};

/** "2m", "1h 5m": how long ago a loop last finished. */
export function formatAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

/** Bucket labels on a time axis: clock time for short windows, the day for a week. */
export function bucketLabel(iso: string, hours: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  if (hours > 48) return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", timeZone: "UTC" }).format(date);
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(date);
}
