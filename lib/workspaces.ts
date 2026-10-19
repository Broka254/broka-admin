export const DETAIL_PREFIXES = ["listings", "users", "disputes", "deals"] as const;
export type DetailPrefix = (typeof DETAIL_PREFIXES)[number];

export function isDetailPrefix(value: string): value is DetailPrefix {
  return DETAIL_PREFIXES.some((prefix) => prefix === value);
}

export const WORKSPACE_ROUTES = new Set([
  "listings", "deals", "stores", "users", "fraud", "disputes", "reports", "transactions", "payments",
  "finance-integrity", "service-health", "escrow", "commissions",
  "zeno/activity", "zeno/negotiations", "zeno/savings", "analytics/platform", "analytics/marketplace", "analytics/users",
  "audit-logs", "diagnostics", "diagnostics/client-ip", "events", "workflow-versions", "settings",
]);

export function isKnownWorkspaceRoute(slug: string[]) {
  return WORKSPACE_ROUTES.has(slug.join("/"));
}
