import "server-only";

import type { ApiResource, UnknownApiRecord } from "@/types/broka";
import { BrokaApiError, parseUnknownJson, publicErrorMessage, upstreamFetch } from "@/lib/api/client";
import { parseAdminResource, AdminActionResultSchema, type AdminResourcePayloads } from "@/lib/api/schemas";
import { ZodError } from "zod";

export const ADMIN_ENDPOINTS: Record<ApiResource, string> = {
  summary: "/admin/summary",
  users: "/admin/users",
  aiSavings: "/admin/ai-savings",
  ledgerIntegrity: "/admin/ledger-integrity",
  auditLogs: "/admin/audit-logs",
  fraudEvents: "/admin/fraud-events",
  transactions: "/admin/transactions",
  workflowVersions: "/admin/workflow-versions",
  eventMetrics: "/admin/event-metrics",
  eventCatalog: "/admin/event-catalog",
  econfirmDiagnostics: "/admin/diagnostics/econfirm",
  clientIpDiagnostics: "/admin/diagnostics/client-ip",
  health: "/health",
};

export const SAFE_ADMIN_PATHS = new Set(Object.values(ADMIN_ENDPOINTS).map((path) => path.slice(1)));
const RESOURCE_BY_PATH = new Map(Object.entries(ADMIN_ENDPOINTS).map(([resource, path]) => [path, resource as ApiResource]));

export function resourceForPath(path: string): ApiResource | null {
  return RESOURCE_BY_PATH.get(path) ?? null;
}

export function validateAdminResource(resource: ApiResource, payload: unknown): AdminResourcePayloads[typeof resource] {
  try {
    return parseAdminResource(resource, payload);
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(JSON.stringify({ event: "admin_contract_validation_failed", resource, issues: error.issues.map((issue) => ({ path: issue.path, code: issue.code })) }));
      throw new BrokaApiError("The BROKA API returned data that does not match the verified admin contract.", 502, "invalid-response");
    }
    throw error;
  }
}

export async function getAdminResource<K extends ApiResource>(resource: K, accessToken: string): Promise<AdminResourcePayloads[K]> {
  const response = await upstreamFetch(ADMIN_ENDPOINTS[resource], { method: "GET" }, accessToken);
  if (!response.ok) {
    const code = response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "upstream";
    throw new BrokaApiError(publicErrorMessage(response), response.status, code);
  }
  return validateAdminResource(resource, await parseUnknownJson(response)) as AdminResourcePayloads[K];
}

export type AdminAction =
  | { path: "/admin/users/{user_id}/promote-admin"; method: "POST" }
  | { path: "/admin/users/{user_id}/flag"; method: "POST" }
  | { path: "/admin/users/{user_id}/unflag"; method: "POST" }
  | { path: "/admin/users/{user_id}/recompute-trust"; method: "POST" };

export async function runVerifiedAdminAction(action: AdminAction, userId: string, accessToken: string, idempotencyKey?: string): Promise<UnknownApiRecord> {
  const path = action.path.replace("{user_id}", encodeURIComponent(userId));
  const response = await upstreamFetch(path, { method: action.method, headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined }, accessToken);
  if (!response.ok) {
    const code = response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "upstream";
    throw new BrokaApiError(publicErrorMessage(response), response.status, code);
  }
  const payload = AdminActionResultSchema.safeParse(await parseUnknownJson(response));
  if (!payload.success) {
    console.error(JSON.stringify({ event: "admin_contract_validation_failed", action: action.path, issues: payload.error.issues.map((issue) => ({ path: issue.path, code: issue.code })) }));
    throw new BrokaApiError("The BROKA API returned an invalid administrative action result.", 502, "invalid-response");
  }
  return payload.data;
}
