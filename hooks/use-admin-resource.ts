"use client";

import { useQuery } from "@tanstack/react-query";

import type { ApiResource } from "@/types/broka";
import type { AdminResourcePayloads } from "@/lib/api/schemas";

type StaticAdminResource = Exclude<ApiResource, "userDetail" | "dealDetail">;

const resourcePaths: Record<StaticAdminResource, string> = {
  summary: "admin/summary", users: "admin/users", aiSavings: "admin/ai-savings", ledgerIntegrity: "admin/ledger-integrity",
  auditLogs: "admin/audit-logs", fraudEvents: "admin/fraud-events", transactions: "admin/transactions", workflowVersions: "admin/workflow-versions",
  eventMetrics: "admin/event-metrics", eventCatalog: "admin/event-catalog", econfirmDiagnostics: "admin/diagnostics/econfirm", clientIpDiagnostics: "admin/diagnostics/client-ip", health: "health",
  opsSnapshot: "admin/ops-snapshot", deals: "admin/deals", listings: "admin/listings", stores: "admin/stores",
  disputes: "admin/disputes", payments: "admin/payments", financeIntegrity: "admin/finance-integrity",
  serviceHealth: "admin/health/services", zenoActivity: "admin/zeno/activity",
};

export class AdminRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) { super(message); this.name = "AdminRequestError"; }
}

async function fetchAdminPath<T>(path: string, query?: URLSearchParams): Promise<T> {
  const suffix = query?.size ? `?${query.toString()}` : "";
  const response = await fetch(`/api/broka/${path}${suffix}`, { credentials: "same-origin", cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok) throw new AdminRequestError(payload.message ?? "Unable to load BROKA data.", response.status, payload.code);
  return payload as T;
}

export function useAdminResource<K extends StaticAdminResource>(resource: K, query?: URLSearchParams, enabled = true) {
  return useQuery<AdminResourcePayloads[K]>({
    queryKey: ["broka-admin", resource, query?.toString() ?? ""], enabled,
    queryFn: () => fetchAdminPath<AdminResourcePayloads[K]>(resourcePaths[resource], query),
  });
}

export function useAdminUsers(query: URLSearchParams, enabled = true) {
  return useQuery<{ rows: AdminResourcePayloads["users"]; total: number }>({
    queryKey: ["broka-admin", "users", query.toString()], enabled,
    queryFn: async () => {
      const response = await fetch(`/api/broka/admin/users?${query.toString()}`, { credentials: "same-origin", cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      if (!response.ok) throw new AdminRequestError(payload.message ?? "Unable to load BROKA data.", response.status, payload.code);
      const rows = payload as AdminResourcePayloads["users"];
      const total = Number(response.headers.get("X-Total-Count"));
      return { rows, total: Number.isFinite(total) ? total : rows.length };
    },
  });
}

export function useAdminDetail<K extends "userDetail" | "dealDetail">(resource: K, id: string, enabled = true) {
  const path = resource === "userDetail" ? `admin/users/${encodeURIComponent(id)}` : `admin/deals/${encodeURIComponent(id)}`;
  return useQuery<AdminResourcePayloads[K]>({
    queryKey: ["broka-admin", resource, id], enabled: enabled && Boolean(id),
    queryFn: () => fetchAdminPath<AdminResourcePayloads[K]>(path),
  });
}

