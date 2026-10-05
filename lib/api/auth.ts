import "server-only";

import type { AdminIdentity, LoginInput, TokenEnvelope } from "@/types/broka";
import { BrokaApiError, parseUnknownJson, publicErrorMessage, upstreamFetch } from "@/lib/api/client";
import { AuthMeSchema, TokenEnvelopeSchema } from "@/lib/api/schemas";

function invalidResponse(message: string): never { throw new BrokaApiError(message, 502, "invalid-response"); }

export function extractTokenEnvelope(payload: unknown): TokenEnvelope {
  const parsed = TokenEnvelopeSchema.safeParse(payload);
  if (!parsed.success) return invalidResponse("The BROKA authentication response did not match the verified bearer-token contract.");
  return { accessToken: parsed.data.access_token, ...(parsed.data.refresh_token ? { refreshToken: parsed.data.refresh_token } : {}) };
}

export function asAdminIdentity(payload: unknown): AdminIdentity {
  const parsed = AuthMeSchema.safeParse(payload);
  if (!parsed.success) return invalidResponse("The BROKA current-admin response did not match the verified identity contract.");
  if (parsed.data.is_admin !== true) throw new BrokaApiError("This BROKA account is not authorized to access the Admin Control Center.", 403, "forbidden");
  return { isAdmin: true, displayName: parsed.data.name.trim() || "Administrator", roleLabel: parsed.data.account_type === "admin" ? "Administrator" : "Admin" };
}

export async function login(input: LoginInput) {
  const response = await upstreamFetch("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new BrokaApiError(publicErrorMessage(response), response.status, "upstream");
  return extractTokenEnvelope(await parseUnknownJson(response));
}

export async function fetchAdminIdentity(accessToken: string) {
  const response = await upstreamFetch("/auth/me", { method: "GET" }, accessToken);
  if (!response.ok) {
    const code = response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "upstream";
    throw new BrokaApiError(publicErrorMessage(response), response.status, code);
  }
  return asAdminIdentity(await parseUnknownJson(response));
}

export async function refreshAccessToken(refreshToken: string) {
  const response = await upstreamFetch("/auth/token/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }) });
  if (!response.ok) throw new BrokaApiError(publicErrorMessage(response), response.status, "unauthorized");
  return extractTokenEnvelope(await parseUnknownJson(response));
}

export async function revokeRefreshToken(refreshToken: string) {
  const response = await upstreamFetch("/auth/token/revoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }) });
  return response.ok;
}
