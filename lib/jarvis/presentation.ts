import { formatKES } from "@/lib/format";
import { formatCount, formatDuration, formatMinutes, formatPctValue } from "@/lib/intelligence";
import type { ZenoBriefingSeverity, ZenoConfidence, ZenoEvidence, ZenoPeriod } from "@/lib/api/jarvis-schemas";
import { dashboardLink, type DashboardLink } from "@/lib/jarvis/dashboard-links";

// Presentation rules for Jarvis Mode. Pure functions, so the rules that keep
// unavailable figures from looking like zero are tested once, here.

export const TURN_PAGE_SIZE = 40;
export const CONVERSATION_PAGE_SIZE = 20;

// ── Confidence ───────────────────────────────────────────────────────────────

export const CONFIDENCE_META: Record<ZenoConfidence, { label: string; hint: string; chip: string }> = {
  measured: {
    label: "Measured",
    hint: "Read directly from a BROKA record.",
    chip: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  },
  derived: {
    label: "Derived",
    hint: "Calculated by BROKA from measured records.",
    chip: "border-[#8b75ff]/30 bg-[#8b75ff]/10 text-[#ded8ff]",
  },
  estimated: {
    label: "Estimated",
    hint: "Modelled or approximated. Treat as indicative.",
    chip: "border-amber-300/30 border-dashed bg-amber-300/5 text-amber-100",
  },
  hypothesis: {
    label: "Hypothesis",
    hint: "A possible explanation. Not verified by the figures.",
    chip: "border-white/15 border-dashed bg-transparent text-slate-300 italic",
  },
  unavailable: {
    label: "Unavailable",
    hint: "Not measured. Shown without a figure.",
    chip: "border-white/12 border-dashed bg-transparent text-slate-500",
  },
};

// ── Briefing severity ────────────────────────────────────────────────────────

export type BriefingGroup = "priority" | "warnings" | "positive" | "context";

export const SEVERITY_META: Record<
  ZenoBriefingSeverity,
  { label: string; group: BriefingGroup; chip: string; railTone: "danger" | "warning" | "success" | "info" }
> = {
  critical: { label: "Critical", group: "priority", chip: "border-rose-400/35 bg-rose-400/10 text-rose-200", railTone: "danger" },
  high: { label: "High", group: "priority", chip: "border-rose-400/25 bg-rose-400/5 text-rose-200", railTone: "danger" },
  warning: { label: "Warning", group: "warnings", chip: "border-amber-300/30 bg-amber-300/10 text-amber-100", railTone: "warning" },
  positive: { label: "Positive", group: "positive", chip: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200", railTone: "success" },
  info: { label: "Context", group: "context", chip: "border-white/12 bg-white/[0.04] text-slate-300", railTone: "info" },
};

export const GROUP_TITLES: Record<BriefingGroup, string> = {
  priority: "Critical and high priority",
  warnings: "Warnings and anomalies",
  positive: "Positive developments",
  context: "Context",
};

export const BRIEFING_GROUP_ORDER: BriefingGroup[] = ["priority", "warnings", "positive", "context"];

export const AREA_LABELS: Record<string, string> = {
  business: "Business",
  marketplace: "Marketplace",
  operations: "Operations",
  finance: "Finance",
  trust: "Trust and safety",
  growth: "Growth",
};

export function areaLabel(area: string): string {
  return AREA_LABELS[area] ?? (area.charAt(0).toUpperCase() + area.slice(1).replaceAll("_", " "));
}

// ── Units and values ─────────────────────────────────────────────────────────

const UNIT_NAMES: Record<string, string> = {
  count: "Count",
  kes_minor: "Kenya shillings (stored in minor units, shown as KES)",
  percentage: "Percent",
  boolean: "Yes or no",
  z_score: "Z-score (standard deviations from the baseline)",
  score: "Score",
  hours: "Hours",
  minutes: "Minutes",
  ms: "Milliseconds",
};

export function unitName(unit: string): string {
  return UNIT_NAMES[unit] ?? unit;
}

const UNIT_SHORT: Record<string, string> = {
  count: "count",
  kes_minor: "KES",
  percentage: "%",
  boolean: "yes or no",
  z_score: "z-score",
  score: "score",
  hours: "hours",
  minutes: "minutes",
  ms: "ms",
};

/** A short unit label for beside a value. The full name is in the details. */
export function unitShort(unit: string): string {
  return UNIT_SHORT[unit] ?? unit;
}

/** A number in the unit the backend names. Callers pass only finite numbers. */
export function formatEvidenceNumber(value: number, unit: string): string {
  switch (unit) {
    case "kes_minor":
      return formatKES(value);
    case "percentage":
      return formatPctValue(value);
    case "z_score":
      return `z ${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
    case "hours":
      return formatDuration(value);
    case "minutes":
      return formatMinutes(value);
    case "ms":
      return `${formatCount(value)} ms`;
    case "score":
      return Number.isInteger(value) ? formatCount(value) : value.toFixed(1);
    default:
      return Number.isInteger(value) ? formatCount(value) : value.toLocaleString("en-KE", { maximumFractionDigits: 2 });
  }
}

export type EvidenceValue =
  | { kind: "value"; text: string }
  | { kind: "missing" }
  | { kind: "structured" };

/**
 * The displayable form of an evidence value. A null, a missing key and a
 * non-finite number are all "missing", and none of them is ever shown as 0.
 */
export function describeValue(value: unknown, unit: string): EvidenceValue {
  if (value === null || value === undefined) return { kind: "missing" };
  if (typeof value === "boolean") return { kind: "value", text: value ? "Yes" : "No" };
  if (typeof value === "number") {
    return Number.isFinite(value) ? { kind: "value", text: formatEvidenceNumber(value, unit) } : { kind: "missing" };
  }
  if (typeof value === "string") {
    if (value.trim() === "") return { kind: "missing" };
    return { kind: "value", text: value.length > 200 ? `${value.slice(0, 197)}…` : value };
  }
  return { kind: "structured" };
}

// ── Dates ────────────────────────────────────────────────────────────────────

const UTC_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** An instant shown in UTC, always labelled as UTC. */
export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "—";
  return `${UTC_FORMAT.format(new Date(time))} UTC`;
}

export function periodText(period: ZenoPeriod): string {
  if (period.start && period.end) return `${formatUtc(period.start)} to ${formatUtc(period.end)}`;
  if (period.end) return `As of ${formatUtc(period.end)}`;
  if (period.start) return `From ${formatUtc(period.start)}`;
  return "Period not stated";
}

// ── Evidence view ────────────────────────────────────────────────────────────

export type EvidenceState = "value" | "unavailable" | "missing" | "structured";

export type EvidenceView = {
  id: string;
  label: string;
  metricKey: string;
  state: EvidenceState;
  valueText: string | null;
  unavailableReason: string | null;
  previousText: string | null;
  unit: string;
  unitShort: string;
  unitLabel: string;
  periodText: string;
  source: string;
  definition: string;
  generatedText: string;
  confidence: ZenoConfidence;
  confidenceMeta: (typeof CONFIDENCE_META)[ZenoConfidence];
  href: DashboardLink | null;
};

/**
 * Turns one backend evidence object into what the administrator sees. An
 * evidence item marked unavailable shows its reason and no figure, even when
 * the backend sent a value.
 */
export function describeEvidence(evidence: ZenoEvidence): EvidenceView {
  const unavailable = !evidence.available || evidence.confidence === "unavailable";
  const current = unavailable ? { kind: "missing" as const } : describeValue(evidence.value, evidence.unit);
  const previous = unavailable ? { kind: "missing" as const } : describeValue(evidence.previous_value, evidence.unit);
  const state: EvidenceState = unavailable
    ? "unavailable"
    : current.kind === "value"
      ? "value"
      : current.kind === "structured"
        ? "structured"
        : "missing";
  return {
    id: evidence.id,
    label: evidence.label,
    metricKey: evidence.metric_key,
    state,
    valueText: current.kind === "value" ? current.text : null,
    unavailableReason: unavailable ? evidence.unavailable_reason ?? "Not measured for this period." : null,
    previousText: previous.kind === "value" ? previous.text : null,
    unit: evidence.unit,
    unitShort: unitShort(evidence.unit),
    unitLabel: unitName(evidence.unit),
    periodText: periodText(evidence.period),
    source: evidence.source,
    definition: evidence.definition,
    generatedText: formatUtc(evidence.generated_at),
    confidence: evidence.confidence,
    confidenceMeta: CONFIDENCE_META[evidence.confidence],
    href: dashboardLink(evidence.href),
  };
}

// ── Stored investigation turns ───────────────────────────────────────────────

/** The backend stores an answer as "headline", a blank line, then the summary. */
export function splitStoredAnswer(content: string): { headline: string; summary: string } {
  const index = content.indexOf("\n\n");
  if (index === -1) return { headline: content.trim(), summary: "" };
  return { headline: content.slice(0, index).trim(), summary: content.slice(index + 2).trim() };
}

export type TurnPage = { offset: number; limit: number };

/**
 * The turn pages to load, oldest first. The newest turns come first in the
 * request order, so the latest 40 are always shown and earlier pages are
 * loaded on demand. When the total is unknown, the first page is requested.
 */
export function turnPageSpecs(total: number | null, earlierPages: number): TurnPage[] {
  if (total === null) return [{ offset: 0, limit: TURN_PAGE_SIZE }];
  const pages: TurnPage[] = [];
  for (let page = 0; page <= earlierPages; page += 1) {
    const end = total - page * TURN_PAGE_SIZE;
    if (end <= 0) break;
    const start = Math.max(0, end - TURN_PAGE_SIZE);
    pages.push({ offset: start, limit: end - start });
  }
  return pages.reverse();
}

export function hasEarlierTurns(total: number | null, earlierPages: number): boolean {
  return total !== null && total > TURN_PAGE_SIZE * (earlierPages + 1);
}

// ── Freshness ────────────────────────────────────────────────────────────────

const FRESHNESS_LABELS: Array<{ key: string; label: string }> = [
  { key: "period_start", label: "Briefing window starts" },
  { key: "period_end", label: "Briefing window ends" },
  { key: "activity_coverage_started_on", label: "Activity tracking began" },
  { key: "operations_sampling_started_at", label: "Operations sampling began" },
  { key: "ops_evaluated_day", label: "Operations anomalies judged on" },
  { key: "market_evaluated_day", label: "Marketplace anomalies judged on" },
];

/** Known freshness facts that are present as text. Absent keys are omitted, never filled in. */
export function freshnessRows(data: Record<string, unknown>): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  for (const { key, label } of FRESHNESS_LABELS) {
    const raw = data[key];
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const isInstant = /T\d{2}:\d{2}/.test(raw);
    rows.push({ label, value: isInstant ? formatUtc(raw) : raw });
  }
  return rows;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export type JarvisErrorKind =
  | "disabled"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "model_unavailable"
  | "context_unsafe"
  | "timeout"
  | "not_found"
  | "endpoint_unavailable"
  | "validation"
  | "invalid_response"
  | "unavailable"
  | "error";

/** Maps a proxy error code (or a network failure) to the state the page shows. */
export function jarvisErrorKind(code: string | undefined, status: number): JarvisErrorKind {
  switch (code) {
    case "ADMIN_ZENO_DISABLED":
      return "disabled";
    case "unauthorized":
      return "unauthorized";
    case "forbidden":
      return "forbidden";
    case "rate_limited":
      return "rate_limited";
    case "MODEL_UNAVAILABLE":
      return "model_unavailable";
    case "MODEL_CONTEXT_UNSAFE":
      return "context_unsafe";
    case "INVESTIGATION_TIMEOUT":
      return "timeout";
    case "conversation_not_found":
      return "not_found";
    case "endpoint_unavailable":
      return "endpoint_unavailable";
    case "validation_failed":
    case "invalid_query":
      return "validation";
    case "contract_validation_failed":
    case "invalid_response":
      return "invalid_response";
    case "backend_unavailable":
    case "network":
      return "unavailable";
    default:
      break;
  }
  if (status === 0 || status === 503 || status === 504) return "unavailable";
  return "error";
}

export const ERROR_COPY: Record<JarvisErrorKind, { title: string; body: string }> = {
  disabled: {
    title: "Jarvis Mode is not enabled",
    body: "Administrative Zeno is switched off for this deployment. A platform engineer needs to enable it.",
  },
  unauthorized: {
    title: "Your session has ended",
    body: "Sign in again to continue with Jarvis Mode.",
  },
  forbidden: {
    title: "Access is restricted",
    body: "Your BROKA account does not have permission to use Jarvis Mode.",
  },
  rate_limited: {
    title: "Too many questions",
    body: "Jarvis Mode limits how many questions can be asked in a short time.",
  },
  model_unavailable: {
    title: "The model is unavailable",
    body: "No answer was generated. Your question is still in the box, so you can send it again.",
  },
  context_unsafe: {
    title: "The question could not be prepared safely",
    body: "Remove personal details such as names, phone numbers or addresses, or ask about aggregate figures.",
  },
  timeout: {
    title: "The investigation took too long",
    body: "Try a narrower question, such as one metric or a shorter period.",
  },
  not_found: {
    title: "This investigation is no longer available",
    body: "It may have expired or been deleted. Start a new investigation.",
  },
  endpoint_unavailable: {
    title: "Backend upgrade required",
    body: "This BROKA API does not provide Jarvis Mode yet.",
  },
  validation: {
    title: "The request was not accepted",
    body: "Check the question and try again.",
  },
  invalid_response: {
    title: "The response could not be verified",
    body: "Nothing from that response was shown. Try again shortly.",
  },
  unavailable: {
    title: "BROKA cannot be reached right now",
    body: "Zeno could not reach the BROKA API. Try again shortly.",
  },
  error: {
    title: "Something went wrong",
    body: "Jarvis Mode could not complete this request. Try again.",
  },
};

// ── Model readiness ──────────────────────────────────────────────────────────

const LAST_ERROR_LABELS: Record<string, string> = {
  providers_unavailable: "No model provider answered",
};

/** A readable description of the last failure category. Unknown categories are shown as a generic note. */
export function lastErrorLabel(category: string | null): string {
  if (!category) return "None recorded";
  return LAST_ERROR_LABELS[category] ?? "A recent model request failed";
}

// ── Guidance ─────────────────────────────────────────────────────────────────

export const STARTER_QUESTIONS: ReadonlyArray<{ area: string; question: string }> = [
  { area: "Business", question: "How did the business perform this window compared with the previous one?" },
  { area: "Marketplace", question: "Which categories show unserved demand or undersupply?" },
  { area: "Operations", question: "Which operational figures are outside their normal range?" },
  { area: "Finance", question: "How do platform income and recorded costs compare this window?" },
  { area: "Trust", question: "Which trust and safety signals need an administrator's attention?" },
  { area: "Growth", question: "Which growth targets are behind, and what explains the gap?" },
];

export const WINDOW_OPTIONS: ReadonlyArray<number> = Array.from({ length: 30 }, (_, index) => index + 1);

export function windowLabel(days: number): string {
  return days === 1 ? "Last 1 day" : `Last ${days} days`;
}
