// Payloads shaped exactly as the backend writes them (api/core/report_builder.py,
// api/core/operations.py).

type Row = Record<string, unknown>;

export function kpi(key: string, overrides: Row = {}): Row {
  return {
    key, label: key.replaceAll("_", " "), category: "growth", unit: "count", good: "up", kind: "period",
    value: 30, previous: 50, delta: -20, change_pct: -40.0, available: true, unavailable_reason: null,
    definition: `How ${key} is counted.`, source: "users.created_at", filtered: false, ...overrides,
  };
}

export const specFixture = {
  title: "Weekly business review", categories: ["growth"], metrics: ["new_users", "income_minor", "active_users"],
  date_from: "2025-03-01", date_to: "2025-03-07", last_days: null, comparison: "previous_period",
  filters: { category: null, county: null }, group_by: "day", visualization: "auto",
};

export const payloadFixture = {
  version: 1,
  title: "Weekly business review",
  spec: specFixture,
  period: { from: "2025-03-01T00:00:00Z", to: "2025-03-08T00:00:00Z", label: "1–7 Mar 2025", days: 7.0, timezone: "UTC", in_progress: false },
  comparison: { kind: "previous_period", from: "2025-02-22T00:00:00Z", to: "2025-03-01T00:00:00Z", label: "the period before (22–28 Feb 2025)" },
  generated_at: "2025-03-20T09:00:00Z",
  data_as_of: "2025-03-08T00:00:00Z",
  executive_summary: ["Weekly business review covers 1–7 Mar 2025 (UTC), compared with the period before (22–28 Feb 2025).",
    "1 figure(s) could not be measured for this period: active users."],
  kpis: [
    kpi("new_users", { label: "New users" }),
    kpi("income_minor", { label: "Income", category: "revenue", unit: "kes_minor", value: 1_250_000, previous: 1_000_000, delta: 250_000, change_pct: 25.0, source: "revenue_report" }),
    kpi("active_users", { label: "Active users", category: "engagement", value: null, previous: null, delta: null, change_pct: null,
      available: false, unavailable_reason: "Activity tracking had not started.", source: "user_activity_days" }),
    kpi("liquidity_pct", { label: "Listing liquidity", category: "marketplace", unit: "pct", value: 52.0, previous: 45.0, delta: 7.0, change_pct: null }),
  ],
  sections: [
    { key: "growth", title: "Platform growth", kpis: ["new_users"], series: ["new_users"] },
    { key: "engagement", title: "User engagement", kpis: ["active_users"], series: [] },
    { key: "marketplace", title: "Marketplace performance", kpis: ["liquidity_pct"], series: [] },
    { key: "revenue", title: "Revenue and payments", kpis: ["income_minor"], series: [] },
  ],
  series: [{
    key: "new_users", label: "New users", unit: "count", bucket: "day", visualization: "line",
    points: [
      { t: "2025-03-01T00:00:00Z", v: 4, days: 1 }, { t: "2025-03-02T00:00:00Z", v: null, days: 1 },
      { t: "2025-03-03T00:00:00Z", v: 7, days: 1 },
    ],
    note: "Null means not measured, never zero.",
  }],
  tables: [{
    key: "income_by_stream", title: "Income by stream", visualization: "bar", chart_column: "amount_minor", note: null,
    columns: [{ key: "label", label: "Stream", unit: "text" }, { key: "amount_minor", label: "Income", unit: "kes_minor" },
      { key: "count", label: "Payments", unit: "count" }],
    rows: [{ label: "Listing fees", amount_minor: 900_000, count: 18 }],
  }],
  changes: [{ key: "new_users", label: "New users", unit: "count", value: 30, previous: 50, delta: -20, change_pct: -40.0, direction: "worse" }],
  anomalies: { evaluated_days: 7, from: "2025-03-01T00:00:00Z", to: "2025-03-08T00:00:00Z", total: 1, note: "Each day checked against the same weekday.",
    items: [{ metric: "registrations", label: "New registrations", date: "2025-03-05", direction: "drop", observed: 1, baseline_median: 9,
      z_score: -5.4, pct: -88.9, severity: "medium", impact: "8 fewer than the typical Wednesday", source: "users.created_at",
      suggested_action: "Check the sign-up flow." }] },
  observations: [{ text: "New users fell 40% against the period before: 50 to 30.", action: "Check the sign-up and OTP flow.",
    evidence: [{ metric: "new_users", label: "New users", value: 30, previous: 50, unit: "count", source: "users.created_at" }] }],
  unavailable: [{ key: "active_users", label: "Active users", reason: "Activity tracking had not started." }],
  filters: { category: null, county: null, applies_to: [], note: null },
  definitions: { new_users: "How new_users is counted." },
  sources: { new_users: "users.created_at" },
  notes: ["Dates are whole UTC days (Nairobi is UTC+3); the end day is included."],
};

export const runMetaFixture = {
  id: "run-1", definition_id: null, title: "Weekly business review",
  period_start: "2025-03-01T00:00:00Z", period_end: "2025-03-08T00:00:00Z", period_label: "1–7 Mar 2025",
  comparison_start: "2025-02-22T00:00:00Z", comparison_end: "2025-03-01T00:00:00Z",
  trigger: "manual", regenerated_from: null, generated_by: "admin-1", generated_at: "2025-03-20T09:00:00Z",
  status: "ready", error: null, measured: 3, metrics: 4, delivery: [],
};

export const runDetailFixture = { ...runMetaFixture, spec: specFixture, payload: payloadFixture };

export const definitionFixture = {
  id: "def-1", name: "Monday review", description: null, spec: { ...specFixture, date_from: null, date_to: null },
  schedule: "weekly", schedule_every_days: null, schedule_hour_utc: 5, schedule_weekday: 0, schedule_day: null,
  recipients: ["admin-1"], enabled: true, next_run_at: "2025-03-24T05:00:00Z", last_run_at: null, last_run_id: null,
  last_status: null, last_error: null, created_by: "admin-1", created_at: "2025-03-20T09:00:00Z", updated_by: "admin-1",
  updated_at: "2025-03-20T09:00:00Z", version: 1,
};

export const catalogFixture = {
  categories: [
    { key: "growth", label: "Platform growth", description: "Sign-ups, new sellers and listings.", metrics: ["new_users", "new_listings"] },
    { key: "revenue", label: "Revenue and payments", description: "Income, costs and payment outcomes.", metrics: ["income_minor"] },
    { key: "business", label: "Overall business performance", description: "The headline figures.", metrics: ["new_users", "income_minor"] },
  ],
  metrics: [
    { key: "new_users", label: "New users", category: "growth", unit: "count", good: "up", kind: "period", definition: "Accounts created.", source: "users.created_at", filters: [], series: true },
    { key: "new_listings", label: "New listings", category: "growth", unit: "count", good: "up", kind: "period", definition: "Listings created.", source: "listings.created_at", filters: [], series: true },
    { key: "income_minor", label: "Income", category: "revenue", unit: "kes_minor", good: "up", kind: "period", definition: "Money paid to BROKA.", source: "revenue_report", filters: [], series: true },
  ],
  comparisons: [{ key: "previous_period", label: "The period just before, same length" }, { key: "previous_year", label: "The same dates a year earlier" }, { key: "none", label: "No comparison" }],
  groupings: [{ key: "none", label: "Figures only" }, { key: "day", label: "By day" }, { key: "category", label: "By listing category" }],
  visualizations: [{ key: "auto", label: "Chosen for the grouping" }, { key: "bar", label: "Bar chart" }],
  limits: { max_range_days: 366, timezone: "UTC" },
  definitions: ["Dates are whole UTC days (Nairobi is UTC+3); the end day is included."],
  filter_options: { category: ["Electronics"], county: ["Nairobi"] },
  email: { configured: true, can_send: true, recipients: [{ id: "admin-1", name: "Amina", email_hint: "a…@broka.co.ke" }],
    note: "Scheduled reports are emailed as a plain-text summary with a link to the full report; attachments are not sent." },
};

function metric(key: string, overrides: Row = {}): Row {
  return {
    key, label: key.replaceAll("_", " "), kind: "period", unit: "count", good: "up", value: 10, previous: 8, delta: 2,
    change_pct: 25.0, definition: `How ${key} is counted.`, caption: null, href: null, available: true,
    unavailable_reason: null, ...overrides,
  };
}

const point = (t: string, v: number | null) => ({ t, v });

export function operationsFixture(overrides: Row = {}): Row {
  const unavailable = { value: null, previous: null, delta: null, change_pct: null, available: false,
    unavailable_reason: "No operations sample in this window. Sampling began 2026-11-25T10:00:00Z." };
  return {
    generated_at: "2026-11-25T12:00:00Z",
    window: { from: "2026-11-24T12:00:00Z", to: "2026-11-25T12:00:00Z", hours: 24, previous_from: "2026-11-23T12:00:00Z", previous_to: "2026-11-24T12:00:00Z" },
    coverage: { sampling_started_at: "2026-11-25T10:00:00Z", samples: 240, instances_in_window: 2, instances_reporting: 2,
      sample_seconds: 60, truncated: false, this_instance: "srv-1-42" },
    sections: [
      { key: "api", title: "API", metrics: [metric("requests", { label: "Requests answered", good: "neutral" }),
        metric("error_rate", { label: "Server error rate", unit: "percent", good: "down", value: 1.5, previous: 0.5, delta: 1.0, change_pct: null }),
        metric("p95_ms", { label: "Latency p95", unit: "ms", good: "down", value: 420, previous: 380, delta: 40, change_pct: 10.5 })],
        endpoints: { busiest: [{ route: "GET /listings/{listing_id}", requests: 80, server_errors: 2, client_errors: 1, error_rate: 2.5, avg_ms: 90, p95_ms: 250, max_ms: 400 }],
          slowest: [], failing: [], note: "Each process records its 25 busiest routes a minute." } },
      { key: "database", title: "Database", metrics: [metric("slow_queries", { label: "Slow statements", good: "down", value: 2 })],
        unavailable_by_kind: { pool_timeout: 1 }, live: { checked_out: 2, max_connections: 5, size: 3, overflow: 0, timeout_s: 10 },
        live_note: "This process's pool at this moment; other processes have their own." },
      { key: "payments", title: "Payments", metrics: [metric("payment_success_rate", { label: "Payment success rate", unit: "percent", value: 66.67, previous: null, delta: null, change_pct: null })],
        providers: [{ source: "mpesa", success: 3, failed: 1, pending: 0, success_pct: 75.0 }],
        errors: [{ source: "mpesa", pattern: "The balance is insufficient for the transaction #", count: 1 }] },
      { key: "notifications", title: "Notifications", metrics: [metric("push_accepted", { label: "Accepted by FCM", good: "neutral",
        definition: "FCM took the push for a phone. That is not delivery: nothing confirms the phone showed it." }),
        metric("push_failed", { label: "Refused or failed", good: "down", ...unavailable })],
        failure_codes: [{ code: "UNAVAILABLE", count: 2 }] },
      { key: "calls", title: "Calls", metrics: [metric("calls", { label: "Calls", good: "neutral", value: 4 })],
        outcomes: [{ outcome: "completed", count: 2, previous: 1 }, { outcome: "failed_to_connect", count: 1, previous: 0 }] },
      { key: "background", title: "Background processing", metrics: [metric("stale_loops", { label: "Stale loops", good: "down", value: 1, kind: "point", previous: null, delta: null, change_pct: null })],
        loops: [
          { name: "periodic", label: "Five-minute sweep (deal timers, reconciliation, reports)", interval_seconds: 300, status: "ok", alive_at: "2026-11-25T11:59:00Z",
            last_pass_finished_at: "2026-11-25T11:58:00Z", last_pass_age_seconds: 120, last_pass_ms: 1200, passes: 3, failures: 1,
            failing_tasks: [{ task: "deal_timer_check", count: 1 }] },
          { name: "nudge", label: "One-minute sweep (availability nudges, auctions)", interval_seconds: 60, status: "stale", alive_at: "2026-11-25T11:59:00Z",
            last_pass_finished_at: "2026-11-25T11:00:00Z", last_pass_age_seconds: 3600, last_pass_ms: 40, passes: 0, failures: 0, failing_tasks: [] },
        ],
        queues: [{ name: "notifications", depth: 2, done: 5, failed: 1, dropped: 0 }],
        item_failures: [{ item: "auction_close", count: 1 }] },
    ],
    series: { bucket_seconds: 1800, requests: [point("2026-11-25T10:00:00Z", 100), point("2026-11-25T10:30:00Z", null)],
      error_rate: [point("2026-11-25T10:00:00Z", 1.0), point("2026-11-25T10:30:00Z", null)],
      p95_ms: [point("2026-11-25T10:00:00Z", 400), point("2026-11-25T10:30:00Z", null)],
      push_failed: [point("2026-11-25T10:00:00Z", 2), point("2026-11-25T10:30:00Z", null)],
      task_failures: [point("2026-11-25T10:00:00Z", 1), point("2026-11-25T10:30:00Z", null)] },
    live: { instance: "srv-1-42", requests: { window_seconds: 900 } },
    not_instrumented: [{ metric: "call_connection_delay", reason: "No per-call timing between answering and connecting is stored." }],
    definitions: { latency: "Estimated from histogram buckets.", pool_utilization: "Checked out / maximum at each sample.",
      payment_success: "Successful / (successful + failed).", push_accepted: "FCM took the push for a phone.",
      message_delivered: "The app confirmed it had the chat message.", calls: "Call cards written when a call ends.",
      loop: "A background loop is stale when it has not finished a pass for three of its intervals." },
    ...overrides,
  };
}
