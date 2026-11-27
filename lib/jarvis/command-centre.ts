import type { AdminResourcePayloads } from "@/lib/api/schemas";
import { formatKES } from "@/lib/format";
import {
  changeTone,
  formatChange,
  formatCount,
  formatPctValue,
  SEVERITY_ORDER,
  type GoodDirection,
  type Tone,
} from "@/lib/intelligence";

// Selectors and formatting for the Command Centre's figures. Every value comes
// from the backend's command-centre payload, the same one the Zeno briefing is
// built from. A metric the backend did not send, or marked unavailable, is
// reported as such. It is never shown as zero.

export type CommandCentre = AdminResourcePayloads["commandCenter"];
export type CommandMetric = CommandCentre["groups"][number]["metrics"][number];
export type CommandInsight = CommandCentre["decisions"]["insights"][number];
export type Timeseries = AdminResourcePayloads["timeseries"];

export type DomainKey = "finance" | "growth" | "users" | "marketplace" | "trust" | "operations";

export type DomainDefinition = {
  key: DomainKey;
  title: string;
  /** The Jarvis page that hosts this panel. */
  href: string;
  summary: string;
  /** The figures this domain shows, in order. Each one is looked up by group and key. */
  metrics: ReadonlyArray<{ group: string; key: string }>;
  /** The backend's insight areas this domain explains. */
  insightAreas: readonly string[];
  /** Time-series the domain can chart from the analytics endpoint. */
  series: ReadonlyArray<{ key: string; label: string }>;
  /** Questions offered as suggested investigations. They fill the input; they are not sent. */
  questions: readonly string[];
};

export const DOMAINS: Record<DomainKey, DomainDefinition> = {
  finance: {
    key: "finance",
    title: "Finance",
    href: "/assistant/business",
    summary: "Platform income, recorded payments and refunds.",
    metrics: [
      { group: "financial", key: "revenue" },
      { group: "financial", key: "listing_fee_revenue" },
      { group: "financial", key: "successful_payments" },
      { group: "financial", key: "failed_payments" },
      { group: "financial", key: "payment_success_rate" },
      { group: "financial", key: "refunds" },
    ],
    insightAreas: ["money"],
    series: [{ key: "gmv_minor", label: "Agreed deal value" }],
    questions: ["How did platform revenue move against the previous window?", "What is driving failed payments?"],
  },
  growth: {
    key: "growth",
    title: "Growth",
    href: "/assistant/business",
    summary: "Progress against the founder's targets for this window.",
    metrics: [{ group: "growth", key: "registration_growth" }],
    insightAreas: ["growth", "targets"],
    series: [],
    questions: ["Which growth targets are behind, and what explains the gap?"],
  },
  users: {
    key: "users",
    title: "Users and sellers",
    href: "/assistant/marketplace",
    summary: "Who signs up, who returns and how quickly sellers reply.",
    metrics: [
      { group: "growth", key: "registered_users" },
      { group: "growth", key: "new_registrations" },
      { group: "growth", key: "active_users" },
      { group: "growth", key: "returning_users" },
      { group: "marketplace", key: "seller_reply_rate" },
    ],
    insightAreas: ["sellers"],
    series: [{ key: "active_users", label: "Active users" }],
    questions: ["Which sellers are slowest to reply, and does it match the drop in replies?"],
  },
  marketplace: {
    key: "marketplace",
    title: "Marketplace",
    href: "/assistant/marketplace",
    summary: "Listings, the views and conversations they earn, and the deals they become.",
    metrics: [
      { group: "marketplace", key: "total_listings" },
      { group: "marketplace", key: "live_listings" },
      { group: "marketplace", key: "new_listings" },
      { group: "marketplace", key: "first_listing_views" },
      { group: "marketplace", key: "saves_and_likes" },
      { group: "marketplace", key: "conversations_started" },
      { group: "marketplace", key: "unavailable_reports" },
    ],
    insightAreas: ["liquidity", "supply", "demand"],
    series: [
      { key: "listings_created", label: "Listings created" },
      { key: "deals_agreed", label: "Deals agreed" },
    ],
    questions: ["Which categories show unserved demand or undersupply?", "Which listings are not converting?"],
  },
  trust: {
    key: "trust",
    title: "Trust and safety",
    href: "/assistant/trust",
    summary: "Accounts, disputes, fraud events and the complaints queue.",
    metrics: [
      { group: "trust", key: "flagged_accounts" },
      { group: "trust", key: "suspended_accounts" },
      { group: "trust", key: "open_disputes" },
      { group: "trust", key: "open_fraud_events" },
      { group: "trust", key: "fraud_flags" },
      { group: "trust", key: "scam_reports" },
      { group: "trust", key: "complaints_filed" },
    ],
    insightAreas: ["trust"],
    series: [{ key: "disputes_opened", label: "Disputes opened" }],
    questions: ["Which trust signals need review first?", "Are complaints slipping past their deadline?"],
  },
  operations: {
    key: "operations",
    title: "Operations",
    href: "/assistant/operations",
    summary: "Service availability, latency and the background work behind them.",
    metrics: [
      { group: "operations", key: "api_availability" },
      { group: "operations", key: "api_error_rate" },
      { group: "operations", key: "api_latency_p95" },
      { group: "operations", key: "database_round_trip" },
      { group: "operations", key: "scheduled_work" },
      { group: "operations", key: "payments_waiting" },
      { group: "operations", key: "messages_confirmed" },
    ],
    insightAreas: [],
    series: [],
    questions: ["Which operational figures are outside their normal range?", "Is API latency rising?"],
  },
};

export const DOMAIN_ORDER: readonly DomainKey[] = ["finance", "growth", "users", "marketplace", "trust", "operations"];

/** A row of a domain panel. `metric` is null when the backend did not send that figure in this snapshot. */
export type MetricRow = { group: string; key: string; metric: CommandMetric | null };

export function findMetric(centre: CommandCentre | undefined, group: string, key: string): CommandMetric | null {
  if (!centre) return null;
  const match = centre.groups.find((item) => item.key === group)?.metrics.find((metric) => metric.key === key);
  return match ?? null;
}

export function metricRows(centre: CommandCentre | undefined, domain: DomainDefinition): MetricRow[] {
  return domain.metrics.map(({ group, key }) => ({ group, key, metric: findMetric(centre, group, key) }));
}

/** The figure as text, or null when it cannot be shown (unavailable, or not sent). Never zero. */
export function formatMetric(metric: CommandMetric | null): string | null {
  if (!metric || !metric.available || metric.value === null || !Number.isFinite(metric.value)) return null;
  const value = metric.value;
  switch (metric.unit) {
    case "kes_minor":
      return formatKES(value);
    case "percent":
      return formatPctValue(value);
    case "ms":
      return `${formatCount(value)} ms`;
    case "seconds":
      return `${formatCount(value)} s`;
    default:
      return formatCount(value);
  }
}

export function goodDirection(value: string): GoodDirection {
  return value === "down" || value === "neutral" ? value : "up";
}

/** The change against the previous window as the backend computed it. Null means no comparison. */
export function metricComparison(metric: CommandMetric | null): { change: number | null; tone: Tone; text: string } {
  const change = metric && Number.isFinite(metric.change_pct ?? Number.NaN) ? (metric.change_pct as number) : null;
  return {
    change,
    tone: changeTone(change, goodDirection(metric?.good ?? "up")),
    text: formatChange(change),
  };
}

/** The six figures the Command Centre leads with. */
export const HEADLINE_METRICS: ReadonlyArray<{ group: string; key: string; label: string }> = [
  { group: "financial", key: "revenue", label: "Platform revenue" },
  { group: "growth", key: "new_registrations", label: "New registrations" },
  { group: "growth", key: "active_users", label: "Active users" },
  { group: "marketplace", key: "live_listings", label: "Live listings" },
  { group: "financial", key: "payment_success_rate", label: "Payment success" },
  { group: "operations", key: "api_availability", label: "API availability" },
];

export function insightsFor(centre: CommandCentre | undefined, areas: readonly string[]): CommandInsight[] {
  if (!centre || areas.length === 0) return [];
  return sortInsights(centre.decisions.insights.filter((insight) => areas.includes(insight.area)));
}

export function sortInsights(insights: readonly CommandInsight[]): CommandInsight[] {
  const rank = (severity: string) => {
    const index = SEVERITY_ORDER.indexOf(severity as (typeof SEVERITY_ORDER)[number]);
    return index === -1 ? SEVERITY_ORDER.length : index;
  };
  return [...insights].sort((a, b) => rank(a.severity) - rank(b.severity));
}

/** Insights that need an administrator's attention now. */
export function attentionInsights(centre: CommandCentre | undefined): CommandInsight[] {
  return sortInsights((centre?.decisions.insights ?? []).filter((insight) => insight.severity === "critical" || insight.severity === "warning"));
}

/** Insights that show something working: a positive result or an opportunity. */
export function opportunityInsights(centre: CommandCentre | undefined): CommandInsight[] {
  return sortInsights((centre?.decisions.insights ?? []).filter((insight) => insight.severity === "positive" || insight.severity === "opportunity"));
}

/** How many of a domain's signals need attention now. Null while the snapshot is not loaded. */
export function domainAttention(centre: CommandCentre | undefined, domain: DomainDefinition): number | null {
  if (!centre) return null;
  return attentionInsights(centre).filter((insight) => domain.insightAreas.includes(insight.area)).length;
}

export function severityTone(severity: string): Tone {
  switch (severity) {
    case "critical":
      return "danger";
    case "warning":
      return "warning";
    case "opportunity":
    case "info":
      return "info";
    case "positive":
      return "success";
    default:
      return "neutral";
  }
}

export function severityLabel(severity: string): string {
  switch (severity) {
    case "critical":
      return "Act now";
    case "warning":
      return "Watch";
    case "opportunity":
      return "Opportunity";
    case "positive":
      return "Working";
    case "info":
      return "Context";
    default:
      return severity;
  }
}

/** The inclusive calendar days ending on `now` (UTC), for the analytics request. */
export function lastDaysRange(days: number, now: Date): { from: string; to: string } {
  const toMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const fromMs = toMs - (days - 1) * 86_400_000;
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { from: day(fromMs), to: day(toMs) };
}

export type TrendPoint = { t: string; v: number | null };

/**
 * A series as the chart needs it. Null means the backend did not measure that
 * bucket; it stays null so the chart leaves a gap there.
 */
export function trendFor(series: Timeseries | undefined, key: string): TrendPoint[] | null {
  const points = series?.series?.[key];
  if (!points) return null;
  return points.map((point) => ({ t: point.t, v: point.v }));
}

/** A target's actual or goal value in the unit the backend names. Callers pass finite numbers only. */
export function formatTargetValue(value: number, unit: string): string {
  if (unit === "kes_minor") return formatKES(value);
  if (unit === "percent") return formatPctValue(value);
  return formatCount(value);
}

/**
 * A server timestamp as milliseconds. The backend writes naive UTC datetimes
 * without an offset; read without one, a browser would take them as local
 * time, so a Z is added first.
 */
export function parseServerTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  const time = Date.parse(withZone);
  return Number.isFinite(time) ? time : null;
}

/** The same instant as canonical UTC ISO text, for components that format time themselves. */
export function serverInstantIso(value: string | null | undefined): string | null {
  const time = parseServerTime(value);
  return time === null ? null : new Date(time).toISOString();
}

/** A server timestamp shown in UTC with its zone, so it never reads as local time. */
const UTC_STAMP = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatServerInstant(value: string | null | undefined): string {
  const time = parseServerTime(value);
  return time === null ? "—" : `${UTC_STAMP.format(new Date(time))} UTC`;
}
