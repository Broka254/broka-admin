// Payloads shaped exactly as the backend writes them (api/core/intelligence.py,
// api/core/insights.py, api/core/admin_reports.py, api/domains/feedback/router.py).

const metric = (current: number, previous: number | null, change: number | null) => ({ current, previous, change_pct: change });

const cohort = (eligible: number, contacted: number, rate: number | null) => ({
  cohort_from: "2026-10-27T00:00:00Z",
  cohort_to: "2026-11-03T00:00:00Z",
  eligible,
  with_buyer_contact: contacted,
  rate_pct: rate,
  median_hours_to_first_contact: rate === null ? null : 5.5,
});

const revenue = (income: number) => ({
  income_minor: income,
  costs_minor: 30_000,
  estimated_costs_minor: 0,
  profit_minor: income - 30_000,
  streams: [{ key: "listing_fees", label: "Listing fees", amount_minor: income, count: 4 }],
});

export const complaintsOverview = {
  open: 3,
  open_feedback: 1,
  open_by_severity: { urgent: 1, normal: 2 },
  unanswered: 2,
  sla_breached: 1,
  sla_breached_urgent: 1,
  oldest_unanswered_hours: 30.2,
  filed: metric(4, 2, 100),
  feedback_filed: 1,
  by_category: { seller_conduct: 3, payments: 1 },
  median_response_hours_90d: 6.5,
  repeat_reported_users: [{ user_id: "user-7", name: "Repeat Trader", complaints_90d: 3 }],
  sla_hours: { urgent: 4, high: 24, normal: 72, low: 120 },
};

export const pulseFixture = {
  generated_at: "2026-11-10T08:00:00Z",
  window: {
    from: "2026-11-03T08:00:00Z", to: "2026-11-10T08:00:00Z",
    previous_from: "2026-10-27T08:00:00Z", previous_to: "2026-11-03T08:00:00Z", days: 7.0,
  },
  metrics: {
    new_users: metric(42, 30, 40),
    new_sellers: metric(6, 6, 0),
    new_listings: metric(18, 30, -40),
    live_listings: { current: 120, previous: null, change_pct: null },
    active_buyers: metric(60, 50, 20),
    active_sellers: metric(20, 18, 11.1),
    conversations_started: metric(75, 70, 7.1),
    messages: metric(400, 380, 5.3),
    zeno_conversations: metric(12, 10, 20),
    zeno_user_turns: metric(80, 60, 33.3),
    deals_agreed: metric(3, 0, null),
    sold_out_reports: metric(2, 1, 100),
    buy_agent_requests: metric(9, 5, 80),
    buy_agent_unmet_open: { current: 4, previous: null, change_pct: null },
    disputes_opened: metric(1, 1, 0),
    fraud_flags: metric(0, 2, -100),
    income_minor: metric(250_000, 100_000, 150),
    costs_minor: metric(30_000, 30_000, 0),
    profit_minor: metric(220_000, 70_000, 214.3),
    complaints_filed: metric(4, 2, 100),
  },
  liquidity: { target_pct: 50.0, current: cohort(20, 9, 45.0), previous: cohort(18, 10, 55.6) },
  seller_response: {
    target_pct: 50.0,
    current: { eligible: 40, replied_24h: 30, rate_pct: 75.0, median_reply_minutes: 42.0 },
    previous: { eligible: 35, replied_24h: 20, rate_pct: 57.1, median_reply_minutes: 90.0 },
    truncated: false,
  },
  balance: { active_buyers: 60, active_sellers: 20, buyers_per_seller: 3.0 },
  complaints: complaintsOverview,
  revenue: { current: revenue(250_000), previous: revenue(100_000), trailing_30d: revenue(600_000) },
  targets: [
    { key: "live_listings", label: "Live listings", target: 150, actual: 120, unit: "count", progress_pct: 80.0, met: false },
    { key: "paying_customers_30d", label: "Paying customers (30 days)", target: 5, actual: 6, unit: "count", progress_pct: 100.0, met: true },
    { key: "collected_30d_minor", label: "Collected (30 days)", target: 1_000_000, actual: 600_000, unit: "kes_minor", progress_pct: 60.0, met: false },
    { key: "deals_agreed_30d", label: "Deals agreed (30 days)", target: 10, actual: 3, unit: "count", progress_pct: 30.0, met: false },
  ],
  break_even: {
    fixed_monthly_cost_minor: 77_300, income_30d_minor: 600_000, costs_30d_minor: 30_000,
    net_30d_minor: 570_000, coverage_pct: 737.4, gap_minor: 0,
  },
  monetisation: { listing_fees_enabled: true, premium_enabled: false, store_billing_enabled: false, in_app_payments_enabled: false },
  staff_excluded: true,
  definitions: {
    liquidity: "Share of listings that got buyer contact within 7 days of posting.",
    targets: "Day-30 targets, measured over the trailing 30 days.",
  },
};

export const insightsFixture = {
  generated_at: "2026-11-10T08:00:00Z",
  window_days: 7,
  insights: [
    {
      id: "complaints_sla", severity: "critical", area: "trust",
      title: "1 complaint past the first-reply deadline",
      detail: "A complaint without a reply is the one users repeat to other people.",
      action: { label: "Answer complaints", href: "/complaints?queue=overdue" },
      evidence: { sla_breached: 1, urgent: 1, oldest_unanswered_hours: 30.2 },
    },
    {
      id: "listings_drop", severity: "warning", area: "supply",
      title: "New listings fell 40% this week",
      detail: "18 against 30 the week before.",
      action: { label: "Growth funnel", href: "/growth" },
      evidence: { current: 18, previous: 30, change_pct: -40 },
    },
    {
      id: "category_unserved_phones", severity: "opportunity", area: "demand",
      title: "Phones: buyers are asking and nothing is listed",
      detail: "Recruit sellers here first.",
      action: { label: "Phones", href: "/intelligence?category=phones" },
      evidence: { demand: 7, supply_live: 0, median_price_kes: null },
    },
    {
      id: "sellers_fast", severity: "positive", area: "sellers",
      title: "Sellers answered 75% of buyers within 24h",
      detail: "Above the 50% target.",
      action: null,
      evidence: { replied: { eligible: 40, replied_24h: 30, rate_pct: 75.0, median_reply_minutes: 42.0 } },
    },
  ],
  counts: { critical: 1, warning: 1, opportunity: 1, info: 0, positive: 1 },
};

export const reporter = {
  id: "user-1", name: "Wanjiru Reporter", phone: "+254700000001", account_type: "buyer",
  trust_score: 92, is_flagged: false, created_at: "2026-09-01T10:00:00Z",
};

export const feedbackItemFixture = {
  id: "3f2a9c11-1111-4222-8333-444455556666",
  kind: "complaint",
  category: "seller_conduct",
  severity: "urgent",
  subject: "Seller asked me to pay outside the app",
  body: "He wanted M-Pesa to his own number before showing the phone.",
  related_listing_id: "listing-9",
  related_deal_id: null,
  related_user_id: "user-7",
  status: "open",
  admin_response: null,
  responded_at: null,
  resolved_at: null,
  created_at: "2026-11-10T02:00:00Z",
  updated_at: "2026-11-10T02:00:00Z",
  user_id: "user-1",
  responded_by_id: null,
  reporter,
  age_hours: 6.0,
  sla_hours: 4,
  sla_breached: true,
};

export const feedbackDetailFixture = {
  ...feedbackItemFixture,
  related_listing: { id: "listing-9", name: "iPhone 13 128GB", status: "active", category: "phones", price: 65000, seller_id: "user-7" },
  related_user: { id: "user-7", name: "Repeat Trader", phone: "+254700000007", trust_score: 40, is_flagged: false, complaints_against_total: 3, complaints_against_open: 2 },
  related_deal: null,
  reporter_history: { submissions: 2, complaints: 1 },
  timeline: [],
};

export const feedbackStatsFixture = {
  total: 5,
  by_status: { open: 3, resolved: 2 },
  by_kind: { complaint: 4, feedback: 1 },
  open_complaints: 3,
  generated_at: "2026-11-10T08:00:00Z",
  by_category: { seller_conduct: 3, payments: 1, suggestion: 1 },
  by_severity: { urgent: 1, normal: 4 },
  open_by_severity: { urgent: 1, normal: 2 },
  unanswered: 2,
  sla_breached: 1,
  sla_breached_urgent: 1,
  oldest_unanswered_hours: 30.2,
  filed_last_7d: 4,
  filed_previous_7d: 2,
  median_response_hours_90d: 6.5,
  repeat_reported_users: [{ user_id: "user-7", name: "Repeat Trader", complaints_90d: 3 }],
  sla_hours: { urgent: 4, high: 24, normal: 72, low: 120 },
};

const kpi = (key: string, label: string, unit: string, good: string, value: number | null, previous: number | null, change: number | null) => ({
  key, label, unit, good_direction: good, value, previous, change_pct: change,
});

export const reportDetailFixture = {
  id: "rep-1",
  kind: "weekly",
  title: "Weekly founder report · 3–9 Nov 2026",
  headline: "This week: 42 new users, 18 new listings, 75 buyer conversations, 45% liquidity. Top concern: 1 complaint past the first-reply deadline.",
  period_start: "2026-11-02T21:00:00Z",
  period_end: "2026-11-09T21:00:00Z",
  period_label: "3–9 Nov 2026",
  generated_at: "2026-11-09T21:05:00Z",
  generated_by: "system",
  insight_counts: { critical: 1, warning: 1, opportunity: 1, info: 0, positive: 1 },
  stored: true,
  payload: {
    version: 1,
    kind: "weekly",
    title: "Weekly founder report · 3–9 Nov 2026",
    period: { from: "2026-11-02T21:00:00Z", to: "2026-11-09T21:00:00Z", label: "3–9 Nov 2026", timezone: "EAT (UTC+3)", in_progress: false },
    headline: "This week: 42 new users, 18 new listings, 75 buyer conversations, 45% liquidity.",
    summary: ["Growth: 42 new users (+40%), 6 new sellers, 18 new listings (-40%); 120 listings live now."],
    kpis: [
      kpi("liquidity_pct", "Liquidity (7-day buyer contact)", "pct", "up", 45.0, 55.6, null),
      kpi("new_users", "New users", "count", "up", 42, 30, 40),
      kpi("complaints_filed", "Complaints filed", "count", "down", 4, 2, 100),
      kpi("income_minor", "Income", "kes_minor", "up", 250_000, 100_000, 150),
    ],
    insights: insightsFixture.insights,
    insight_counts: insightsFixture.counts,
    targets: pulseFixture.targets,
    break_even: pulseFixture.break_even,
    liquidity: pulseFixture.liquidity,
    seller_response: pulseFixture.seller_response,
    complaints: complaintsOverview,
    revenue: revenue(250_000),
    categories: {
      top_demand: [{ key: "phones", label: "Phones", demand: 7, supply_live: 0, new_listings: 0, liquidity_pct: null, signal: "unserved" }],
      undersupplied: [{ key: "phones", label: "Phones", demand: 7, supply_live: 0, new_listings: 0, liquidity_pct: null, signal: "unserved" }],
      oversupplied: [],
    },
    sellers: {
      waiting_total: 5,
      sellers_with_waiting_buyers: 2,
      top_waiting: [{ seller_id: "user-7", name: "Repeat Trader", waiting: 3, oldest_wait_hours: 50.5 }],
      stale_total: 4,
    },
    generated_at: "2026-11-09T21:05:00Z",
  },
  markdown: "# Weekly founder report\n",
};
