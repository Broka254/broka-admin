import "server-only";

import type { ApiResource } from "@/types/broka";
import { BrokaApiError, parseUnknownJson, publicErrorMessage, upstreamFetch } from "@/lib/api/client";
import { parseAdminResource, AdminActionResultSchema, type AdminActionResult, type AdminResourcePayloads } from "@/lib/api/schemas";
import { ZodError } from "zod";

export type StaticAdminResource = Exclude<ApiResource, "userDetail" | "dealDetail">;

export const ADMIN_ENDPOINTS: Record<StaticAdminResource, string> = {
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
  opsSnapshot: "/admin/ops-snapshot",
  deals: "/admin/deals",
  listings: "/admin/listings",
  stores: "/admin/stores",
  disputes: "/admin/disputes",
  payments: "/admin/payments",
  financeIntegrity: "/admin/finance-integrity",
  serviceHealth: "/admin/health/services",
  zenoActivity: "/admin/zeno/activity",
};

const DETAIL_PATTERNS: Array<{ pattern: RegExp; resource: "userDetail" | "dealDetail" }> = [
  { pattern: /^admin\/users\/([^/]+)$/, resource: "userDetail" },
  { pattern: /^admin\/deals\/([^/]+)$/, resource: "dealDetail" },
];

const RESOURCE_BY_PATH = new Map(Object.entries(ADMIN_ENDPOINTS).map(([resource, path]) => [path.slice(1), resource as ApiResource]));

// The proxy route hands over a path without a leading slash; callers that
// pass the request path keep it. Normalise here so both work.
function normalizePath(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

export function resourceForPath(path: string): ApiResource | null {
  const normalized = normalizePath(path);
  const direct = RESOURCE_BY_PATH.get(normalized);
  if (direct) return direct;
  return DETAIL_PATTERNS.find((entry) => entry.pattern.test(normalized))?.resource ?? null;
}

export function isSafeAdminPath(path: string): boolean {
  const normalized = normalizePath(path);
  return RESOURCE_BY_PATH.has(normalized) || DETAIL_PATTERNS.some((entry) => entry.pattern.test(normalized));
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

export async function getAdminResource<K extends StaticAdminResource>(resource: K, accessToken: string, query?: URLSearchParams): Promise<AdminResourcePayloads[K]> {
  const suffix = query?.size ? `?${query.toString()}` : "";
  const response = await upstreamFetch(`${ADMIN_ENDPOINTS[resource]}${suffix}`, { method: "GET" }, accessToken);
  if (!response.ok) {
    const code = response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "upstream";
    throw new BrokaApiError(publicErrorMessage(response), response.status, code);
  }
  return validateAdminResource(resource, await parseUnknownJson(response)) as AdminResourcePayloads[K];
}

export type AdminAction = {
  path: string;
  method: "POST";
  reasonRequired: boolean;
};

export const USER_ACTIONS: Record<string, AdminAction> = {
  flag: { path: "/admin/users/{user_id}/flag", method: "POST", reasonRequired: true },
  unflag: { path: "/admin/users/{user_id}/unflag", method: "POST", reasonRequired: false },
  "recompute-trust": { path: "/admin/users/{user_id}/recompute-trust", method: "POST", reasonRequired: false },
  "promote-admin": { path: "/admin/users/{user_id}/promote-admin", method: "POST", reasonRequired: true },
};

export const FRAUD_EVENT_ACTIONS: Record<string, AdminAction> = {
  resolve: { path: "/admin/fraud-events/{event_id}/resolve", method: "POST", reasonRequired: false },
};

function fillPath(template: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((path, [key, value]) => path.replace(`{${key}}`, encodeURIComponent(value)), template);
}

export async function runVerifiedAdminAction(
  action: AdminAction,
  params: Record<string, string>,
  accessToken: string,
  options: { idempotencyKey?: string; reason?: string; requestId?: string } = {},
): Promise<AdminActionResult> {
  const path = fillPath(action.path, params);
  const headers: Record<string, string> = {};
  // The backend idempotency guard reads X-Idempotency-Key; sending only
  // Idempotency-Key silently disables replay protection.
  if (options.idempotencyKey) headers["X-Idempotency-Key"] = options.idempotencyKey;
  // Forward our request id so the backend audit row correlates with the
  // request_id the dashboard echoes back to the operator.
  if (options.requestId) headers["X-Request-ID"] = options.requestId;
  const reason = options.reason?.trim();
  if (reason) headers["Content-Type"] = "application/json";
  const response = await upstreamFetch(path, {
    method: action.method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: reason ? JSON.stringify({ reason }) : undefined,
  }, accessToken);
  if (!response.ok) {
    const code = response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : response.status === 422 ? "invalid" : "upstream";
    throw new BrokaApiError(publicErrorMessage(response), response.status, code);
  }
  const payload = AdminActionResultSchema.safeParse(await parseUnknownJson(response));
  if (!payload.success) {
    console.error(JSON.stringify({ event: "admin_contract_validation_failed", action: action.path, issues: payload.error.issues.map((issue) => ({ path: issue.path, code: issue.code })) }));
    throw new BrokaApiError("The BROKA API returned an invalid administrative action result.", 502, "invalid-response");
  }
  return payload.data;
}

