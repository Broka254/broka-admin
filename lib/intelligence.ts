import { formatKES } from "@/lib/format";
import type { InsightSeverity } from "@/lib/api/intelligence-schemas";

// Presentation rules for the founder-intelligence, complaint and report
// views. Pure functions only, so the wording and colour of every number is
// tested once here instead of in each component.

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";
export type GoodDirection = "up" | "down" | "neutral";

const EMPTY = "—";

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return Math.round(value).toLocaleString("en-KE");
}

export function formatPctValue(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return `${value.toFixed(digits).replace(/\.0+$/, "")}%`;
}

/** Relative change, signed. `null` means the previous value was zero or unknown. */
export function formatChange(change: number | null | undefined): string {
  if (change === null || change === undefined || !Number.isFinite(change)) return EMPTY;
  if (change === 0) return "0%";
  const magnitude = Math.abs(change) >= 100 ? Math.round(Math.abs(change)).toString() : Math.abs(change).toFixed(1).replace(/\.0$/, "");
  return `${change > 0 ? "+" : "−"}${magnitude}%`;
}

/** Colour of a change: green when it moves the way the business wants. */
export function changeTone(change: number | null | undefined, good: GoodDirection = "up"): Tone {
  if (change === null || change === undefined || !Number.isFinite(change) || change === 0 || good === "neutral") return "neutral";
  const better = good === "up" ? change > 0 : change < 0;
  return better ? "success" : "danger";
}

/** Hours as a short duration: 45m, 5h, 2d 3h. */
export function formatDuration(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return EMPTY;
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.round(totalMinutes / 60);
  if (totalHours < 48) return `${totalHours}h`;
  const days = Math.floor(totalHours / 24);
  const rest = totalHours % 24;
  return rest ? `${days}d ${rest}h` : `${days}d`;
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return EMPTY;
  return formatDuration(minutes / 60);
}

/** A value in the unit the backend names (count, kes_minor, pct, hours). */
export function formatUnitValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  if (unit === "kes_minor") return formatKES(value);
  if (unit === "pct") return formatPctValue(value);
  if (unit === "hours") return formatDuration(value);
  if (unit === "minutes") return formatMinutes(value);
  return formatCount(value);
}

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return EMPTY;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return EMPTY;
  const hours = (now - at) / 3_600_000;
  if (Math.abs(hours) < 1 / 60) return "just now";
  return hours >= 0 ? `${formatDuration(hours)} ago` : `in ${formatDuration(-hours)}`;
}

export function humanizeKey(key: string): string {
  const words = key.replace(/_minor$/, "").replace(/_pct$/, " %").replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Only links inside this dashboard become client-side navigation. */
export function isInternalHref(href: string | null | undefined): href is string {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && !href.includes("\\");
}

// ── Insights ────────────────────────────────────────────────────────────────

export const SEVERITY_ORDER: InsightSeverity[] = ["critical", "warning", "opportunity", "info", "positive"];

export const SEVERITY_META: Record<InsightSeverity, { label: string; tone: Tone; text: string; bar: string; glow: string }> = {
  critical: { label: "Act now", tone: "danger", text: "text-rose-200", bar: "bg-rose-400", glow: "shadow-[0_0_24px_rgba(251,113,133,0.35)]" },
  warning: { label: "Watch", tone: "warning", text: "text-amber-200", bar: "bg-amber-300", glow: "shadow-[0_0_24px_rgba(252,211,77,0.25)]" },
  opportunity: { label: "Opportunity", tone: "info", text: "text-[#ded8ff]", bar: "bg-[#8b75ff]", glow: "shadow-[0_0_24px_rgba(139,117,255,0.35)]" },
  info: { label: "Context", tone: "neutral", text: "text-slate-200", bar: "bg-slate-400", glow: "" },
  positive: { label: "Working", tone: "success", text: "text-emerald-200", bar: "bg-emerald-400", glow: "shadow-[0_0_24px_rgba(52,211,153,0.25)]" },
};

export const AREA_LABELS: Record<string, string> = {
  liquidity: "Liquidity",
  growth: "Growth",
  supply: "Supply",
  demand: "Demand",
  sellers: "Sellers",
  trust: "Trust",
  money: "Money",
  targets: "Targets",
};

export function areaLabel(area: string): string {
  return AREA_LABELS[area] ?? humanizeKey(area);
}

export type EvidenceEntry = { key: string; label: string; value: string };

function evidenceValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") {
    if (key.endsWith("_minor")) return formatKES(value);
    if (key.endsWith("_pct") || key === "rate_pct") return formatPctValue(value);
    if (key.endsWith("_hours")) return formatDuration(value);
    if (key.endsWith("_minutes")) return formatMinutes(value);
    return formatCount(value);
  }
  if (typeof value === "string") {
    // Ids are evidence for the record, not for reading.
    if (/(^|_)id$/.test(key) && value.length > 12) return `${value.slice(0, 8)}…`;
    return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  }
  if (Array.isArray(value)) {
    const items = value.filter((item) => ["string", "number"].includes(typeof item)).map((item) => humanizeKey(String(item)));
    return items.length ? items.join(", ") : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const { current, previous, change_pct: change, rate_pct: rate } = record;
    // A metric: {current, previous, change_pct}.
    if (typeof current === "number") {
      const parts = [evidenceValue(key, current)];
      if (typeof previous === "number") parts.push(`prev ${evidenceValue(key, previous)}`);
      if (typeof change === "number") parts.push(formatChange(change));
      return parts.filter(Boolean).join(" · ");
    }
    if (typeof rate === "number") return formatPctValue(rate);
    return null;
  }
  return null;
}

/** The evidence an insight was drawn from, as at most `limit` readable chips. */
export function evidenceEntries(evidence: Record<string, unknown> | null | undefined, limit = 4): EvidenceEntry[] {
  if (!evidence) return [];
  const out: EvidenceEntry[] = [];
  for (const [key, raw] of Object.entries(evidence)) {
    const value = evidenceValue(key, raw);
    if (value === null || value === "") continue;
    out.push({ key, label: humanizeKey(key), value });
    if (out.length >= limit) break;
  }
  return out;
}

// ── Categories ──────────────────────────────────────────────────────────────

export const SIGNAL_META: Record<string, { label: string; tone: Tone; color: string; rank: number }> = {
  unserved: { label: "Unserved demand", tone: "danger", color: "#fb7185", rank: 0 },
  undersupplied: { label: "Undersupplied", tone: "warning", color: "#dbb75d", rank: 1 },
  oversupplied: { label: "Oversupplied", tone: "info", color: "#54d7e9", rank: 2 },
  healthy: { label: "Healthy", tone: "success", color: "#34d399", rank: 3 },
  developing: { label: "Developing", tone: "neutral", color: "#8b75ff", rank: 4 },
};

export function signalMeta(signal: string) {
  return SIGNAL_META[signal] ?? { label: humanizeKey(signal), tone: "neutral" as Tone, color: "#9ba4bc", rank: 9 };
}

// ── Complaints & feedback ───────────────────────────────────────────────────

export const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  bug: "Something is broken",
  suggestion: "Suggestion",
  compliment: "Compliment",
  account: "Account",
  payments: "Payments",
  listing: "A listing",
  seller_conduct: "Seller conduct",
  buyer_conduct: "Buyer conduct",
  delivery: "Delivery",
  safety: "Safety",
  other: "Other",
};

export function feedbackCategoryLabel(category: string): string {
  return FEEDBACK_CATEGORY_LABELS[category] ?? humanizeKey(category);
}

export const FEEDBACK_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  open: { label: "New", tone: "warning" },
  acknowledged: { label: "Acknowledged", tone: "info" },
  in_progress: { label: "In progress", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

export function feedbackStatusMeta(status: string) {
  return FEEDBACK_STATUS_META[status] ?? { label: humanizeKey(status), tone: "neutral" as Tone };
}

export const FEEDBACK_SEVERITY_META: Record<string, { label: string; tone: Tone; rank: number }> = {
  urgent: { label: "Urgent", tone: "danger", rank: 0 },
  high: { label: "High", tone: "warning", rank: 1 },
  normal: { label: "Normal", tone: "neutral", rank: 2 },
  low: { label: "Low", tone: "neutral", rank: 3 },
};

export function feedbackSeverityMeta(severity: string) {
  return FEEDBACK_SEVERITY_META[severity] ?? { label: humanizeKey(severity), tone: "neutral" as Tone, rank: 9 };
}

/** The reference the app shows the reporter ("#3F2A9C"), so support can match a quote. */
export function feedbackReference(id: string): string {
  const compact = id.replaceAll("-", "").toUpperCase();
  return `#${compact.slice(0, 6)}`;
}

const OPEN_STATUSES = new Set(["open", "acknowledged", "in_progress"]);

export function isOpenFeedback(status: string): boolean {
  return OPEN_STATUSES.has(status);
}

/**
 * Where a submission stands against its first-reply deadline. Mirrors the
 * backend rule: only an open, unanswered complaint can be overdue.
 */
export function slaSummary(item: {
  kind: string; status: string; responded_at: string | null; age_hours: number; sla_hours: number; sla_breached: boolean;
}): { label: string; tone: Tone; overdue: boolean } {
  if (!isOpenFeedback(item.status)) return { label: feedbackStatusMeta(item.status).label, tone: "success", overdue: false };
  if (item.responded_at) return { label: "Replied", tone: "info", overdue: false };
  if (item.kind !== "complaint") return { label: `Waiting ${formatDuration(item.age_hours)}`, tone: "neutral", overdue: false };
  const remaining = item.sla_hours - item.age_hours;
  if (item.sla_breached || remaining <= 0) return { label: `Overdue by ${formatDuration(Math.max(0, -remaining))}`, tone: "danger", overdue: true };
  return { label: `Reply due in ${formatDuration(remaining)}`, tone: remaining <= item.sla_hours * 0.25 ? "warning" : "neutral", overdue: false };
}

/** What the reporter's phone was told, from the triage response. */
export function notificationOutcome(notified: number | null | undefined): string | null {
  if (notified === null || notified === undefined) return null;
  if (notified <= 0) return "No device was reachable; the reply is waiting in the app's Feedback & complaints screen.";
  return `Pushed to ${notified} device${notified === 1 ? "" : "s"}. The reply is also in the app's Feedback & complaints screen.`;
}

// ── Time of day (client only) ───────────────────────────────────────────────

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
