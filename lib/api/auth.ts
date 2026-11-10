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

// A failed sign-in is about the credentials, not a session: the generic 401
// text ("Your session is no longer valid") told an administrator who typed
// the wrong password that their session had expired.
function loginErrorMessage(response: Response): string {
  if (response.status === 401 || response.status === 400 || response.status === 422) return "The phone number or password is incorrect.";
  if (response.status === 429) return "Too many sign-in attempts. Wait a few minutes and try again.";
  return publicErrorMessage(response);
}

export async function login(input: LoginInput) {
  const response = await upstreamFetch("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new BrokaApiError(loginErrorMessage(response), response.status, "upstream");
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

// One refresh per refresh token at a time. A dashboard page fires several
// reads at once; when the access token expires they all get a 401 together,
// and each used to spend the same refresh token. The backend rotates a
// refresh token once it is a week old and lets the old one work only as a
// short recovery window, so parallel refreshes could leave one request with
// a rotated-away token, a 401, and a cleared session: the administrator was
// signed out by their own dashboard. Concurrent callers now share one call,
// and its result is kept for a few seconds for requests that just missed it.
const REFRESH_REUSE_MS = 10_000;
const refreshes = new Map<string, Promise<TokenEnvelope>>();

async function requestRefresh(refreshToken: string): Promise<TokenEnvelope> {
  const response = await upstreamFetch("/auth/token/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }) });
  if (!response.ok) throw new BrokaApiError(publicErrorMessage(response), response.status, "unauthorized");
  return extractTokenEnvelope(await parseUnknownJson(response));
}

export function refreshAccessToken(refreshToken: string): Promise<TokenEnvelope> {
  const pending = refreshes.get(refreshToken);
  if (pending) return pending;
  const attempt = requestRefresh(refreshToken);
  refreshes.set(refreshToken, attempt);
  attempt.then(
    () => { setTimeout(() => refreshes.delete(refreshToken), REFRESH_REUSE_MS); },
    () => { refreshes.delete(refreshToken); },
  );
  return attempt;
}

export async function revokeRefreshToken(refreshToken: string) {
  const response = await upstreamFetch("/auth/token/revoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }) });
  return response.ok;
}
