"use client";

import { useQuery } from "@tanstack/react-query";

import type { ApiResource } from "@/types/broka";
import type { AdminResourcePayloads } from "@/lib/api/schemas";

const resourcePaths: Record<ApiResource, string> = {
  summary: "admin/summary", users: "admin/users", aiSavings: "admin/ai-savings", ledgerIntegrity: "admin/ledger-integrity",
  auditLogs: "admin/audit-logs", fraudEvents: "admin/fraud-events", transactions: "admin/transactions", workflowVersions: "admin/workflow-versions",
  eventMetrics: "admin/event-metrics", eventCatalog: "admin/event-catalog", econfirmDiagnostics: "admin/diagnostics/econfirm", clientIpDiagnostics: "admin/diagnostics/client-ip", health: "health",
};

export class AdminRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) { super(message); this.name = "AdminRequestError"; }
}

export function useAdminResource<K extends ApiResource>(resource: K, query?: URLSearchParams, enabled = true) {
  return useQuery<AdminResourcePayloads[K]>({
    queryKey: ["broka-admin", resource, query?.toString() ?? ""], enabled,
    queryFn: async (): Promise<AdminResourcePayloads[K]> => {
      const suffix = query?.size ? `?${query.toString()}` : "";
      const response = await fetch(`/api/broka/${resourcePaths[resource]}${suffix}`, { credentials: "same-origin", cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      if (!response.ok) throw new AdminRequestError(payload.message ?? "Unable to load BROKA data.", response.status, payload.code);
      return payload as AdminResourcePayloads[K];
    },
  });
}
