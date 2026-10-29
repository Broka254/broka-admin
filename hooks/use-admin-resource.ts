"use client";

import { useQuery } from "@tanstack/react-query";

import type { StaticAdminResource } from "@/types/broka";
import type { AdminResourcePayloads } from "@/lib/api/schemas";

const resourcePaths: Record<StaticAdminResource, string> = {
  summary: "admin/summary",
  users: "admin/users",
  aiSavings: "admin/ai-savings",
  ledgerIntegrity: "admin/ledger-integrity",
  auditLogs: "admin/audit-logs",
  fraudEvents: "admin/fraud-events",
  transactions: "admin/transactions",
  workflowVersions: "admin/workflow-versions",
  eventMetrics: "admin/event-metrics",
  eventCatalog: "admin/event-catalog",
  econfirmDiagnostics: "admin/diagnostics/econfirm",
  clientIpDiagnostics: "admin/diagnostics/client-ip",
  health: "health",
  opsSnapshot: "admin/ops-snapshot",
  deals: "admin/deals",
  listings: "admin/listings",
  stores: "admin/stores",
  disputes: "admin/disputes",
  payments: "admin/payments",
  financeIntegrity: "admin/finance-integrity",
  serviceHealth: "admin/health/services",
  zenoActivity: "admin/zeno/activity",
  communications: "admin/communications",
  workerDiagnostics: "admin/communications/diagnostics/worker",
  alerts: "admin/alerts",
  revenue: "admin/revenue",
  timeseries: "admin/analytics/timeseries",
};

export class AdminRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "AdminRequestError";
  }
}

// A 404 from a registered static admin endpoint means the deployed backend
// does not serve it yet (newer dashboard, pre-upgrade API), not that the
// request failed. Views use this to say "backend upgrade required" instead
// of rendering a red error.
export function isEndpointMissing(error: unknown): boolean {
  return error instanceof AdminRequestError && error.status === 404;
}

async function fetchAdminPath<T>(path: string, query?: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const suffix = query?.size ? `?${query.toString()}` : "";
  const response = await fetch(`/api/broka/${path}${suffix}`, { credentials: "same-origin", cache: "no-store", signal });
  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok) throw new AdminRequestError(payload.message ?? "Unable to load BROKA data.", response.status, payload.code);
  return payload as T;
}

// Queries that back always-visible operational chrome (health badge, command
// center, ops snapshot) poll every 30s while the tab is focused.
const SUMMARY_RESOURCES: ReadonlySet<string> = new Set(["summary", "opsSnapshot", "health"]);

export function useAdminResource<K extends StaticAdminResource>(resource: K, query?: URLSearchParams, enabled = true) {
  return useQuery<AdminResourcePayloads[K]>({
    queryKey: ["broka-admin", resource, query?.toString() ?? ""],
    enabled,
    queryFn: ({ signal }) => fetchAdminPath<AdminResourcePayloads[K]>(resourcePaths[resource], query, signal),
    ...(SUMMARY_RESOURCES.has(resource as string)
      ? { refetchInterval: 30_000, refetchIntervalInBackground: false }
      : {}),
  });
}

export function useAdminUsers(query: URLSearchParams, enabled = true) {
  return useQuery<{ rows: AdminResourcePayloads["users"]; total: number | null }>({
    queryKey: ["broka-admin", "users", query.toString()],
    enabled,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/broka/admin/users?${query.toString()}`, { credentials: "same-origin", cache: "no-store", signal });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      if (!response.ok) throw new AdminRequestError(payload.message ?? "Unable to load BROKA data.", response.status, payload.code);
      const rows = payload as AdminResourcePayloads["users"];
      // Absence of the filtered total is "unknown", not the page length.
      const rawTotal = response.headers.get("X-Total-Count")?.trim();
      const total = rawTotal && /^\d+$/.test(rawTotal) ? Number(rawTotal) : null;
      return { rows, total: total !== null && Number.isSafeInteger(total) ? total : null };
    },
  });
}

const DETAIL_PATHS: Record<"userDetail" | "dealDetail" | "listingDetail" | "disputeDetail" | "storeDetail", string> = {
  userDetail: "admin/users",
  dealDetail: "admin/deals",
  listingDetail: "admin/listings",
  disputeDetail: "admin/disputes",
  storeDetail: "admin/stores",
};

export function useAdminDetail<K extends keyof typeof DETAIL_PATHS>(resource: K, id: string, enabled = true) {
  const path = `${DETAIL_PATHS[resource]}/${encodeURIComponent(id)}`;
  return useQuery<AdminResourcePayloads[K]>({
    queryKey: ["broka-admin", resource, id],
    enabled: enabled && Boolean(id),
    queryFn: ({ signal }) => fetchAdminPath<AdminResourcePayloads[K]>(path, undefined, signal),
  });
}

export function useAdminCommunications(query?: URLSearchParams, enabled = true) {
  return useQuery<AdminResourcePayloads["communications"]>({
    queryKey: ["broka-admin", "communications", query?.toString() ?? ""],
    enabled,
    queryFn: ({ signal }) => fetchAdminPath<AdminResourcePayloads["communications"]>("admin/communications", query, signal),
  });
}

export function useAdminCommunicationDetail(id: string, enabled = true) {
  return useQuery<AdminResourcePayloads["communicationDetail"]>({
    queryKey: ["broka-admin", "communicationDetail", id],
    enabled: enabled && Boolean(id),
    queryFn: () => fetchAdminPath<AdminResourcePayloads["communicationDetail"]>(`admin/communications/${encodeURIComponent(id)}`),
  });
}

export function useAdminCommunicationRecipients(id: string, query?: URLSearchParams, enabled = true) {
  return useQuery<AdminResourcePayloads["communicationRecipients"]>({
    queryKey: ["broka-admin", "communicationRecipients", id, query?.toString() ?? ""],
    enabled: enabled && Boolean(id),
    queryFn: () => fetchAdminPath<AdminResourcePayloads["communicationRecipients"]>(`admin/communications/${encodeURIComponent(id)}/recipients`, query),
  });
}

export function useAdminCommunicationStats(id: string, enabled = true) {
  return useQuery<AdminResourcePayloads["communicationStats"]>({
    queryKey: ["broka-admin", "communicationStats", id],
    enabled: enabled && Boolean(id),
    queryFn: () => fetchAdminPath<AdminResourcePayloads["communicationStats"]>(`admin/communications/${encodeURIComponent(id)}/stats`),
  });
}

export function useAdminWorkerDiagnostics(enabled = true) {
  return useQuery<AdminResourcePayloads["workerDiagnostics"]>({
    queryKey: ["broka-admin", "workerDiagnostics"],
    enabled,
    queryFn: () => fetchAdminPath<AdminResourcePayloads["workerDiagnostics"]>("admin/communications/diagnostics/worker"),
  });
}
