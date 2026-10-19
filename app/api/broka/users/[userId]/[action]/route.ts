import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { refreshAccessToken } from "@/lib/api/auth";
import { runVerifiedAdminAction, USER_ACTIONS } from "@/lib/api/admin";
import { ACCESS_COOKIE, BrokaApiError, REFRESH_COOKIE } from "@/lib/api/client";
import { sessionCookieOptions } from "@/lib/auth/cookies";
import { requireSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearSession(response: NextResponse) {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export async function POST(request: Request, context: { params: Promise<{ userId: string; action: string }> }) {
  const csrfFailure = requireSameOrigin(request);
  if (csrfFailure) return csrfFailure;
  const id = requestId(request);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return NextResponse.json({ code: "idempotency_key_required", message: "A unique idempotency key is required for this administrative mutation.", request_id: id }, { status: 400 });
  }

  const { userId, action } = await context.params;
  const definition = USER_ACTIONS[action];
  if (!definition) return NextResponse.json({ code: "action_not_allowlisted", message: "This user action is not allowlisted.", request_id: id }, { status: 404 });

  let reason: string | undefined;
  if (definition.reasonRequired || request.headers.get("content-type")?.includes("application/json")) {
    const payload = (await request.json().catch(() => ({}))) as { reason?: unknown };
    reason = typeof payload.reason === "string" ? payload.reason.trim() : undefined;
    if (definition.reasonRequired && (!reason || reason.length < 3 || reason.length > 500)) {
      return NextResponse.json({ code: "reason_required", message: "A written reason (3-500 characters) is required for this action.", request_id: id }, { status: 422 });
    }
  }

  const store = await cookies();
  let accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ code: "unauthorized", message: "Authentication required.", request_id: id }, { status: 401 });

  try {
    let refreshedTokens: Awaited<ReturnType<typeof refreshAccessToken>> | undefined;
    let result;
    try {
      result = await runVerifiedAdminAction(definition, { user_id: userId }, accessToken, { idempotencyKey, reason, requestId: id });
    } catch (error) {
      if (!(error instanceof BrokaApiError) || error.status !== 401 || !refreshToken) throw error;
      refreshedTokens = await refreshAccessToken(refreshToken);
      accessToken = refreshedTokens.accessToken;
      result = await runVerifiedAdminAction(definition, { user_id: userId }, accessToken, { idempotencyKey, reason, requestId: id });
    }

    const response = NextResponse.json({ ...result, accepted: true, request_id: id }, { headers: { "X-Request-ID": id } });
    if (refreshedTokens) {
      response.cookies.set(ACCESS_COOKIE, refreshedTokens.accessToken, sessionCookieOptions());
      if (refreshedTokens.refreshToken) response.cookies.set(REFRESH_COOKIE, refreshedTokens.refreshToken, sessionCookieOptions(60 * 60 * 24 * 14));
    }
    return response;
  } catch (error) {
    const status = error instanceof BrokaApiError && error.status ? error.status : 503;
    const message = error instanceof BrokaApiError && error.code === "invalid" ? "The BROKA API rejected this action. A written reason may be required." : error instanceof BrokaApiError ? error.message : "The BROKA API could not complete this action.";
    const response = NextResponse.json({ code: status === 422 ? "reason_required" : "action_failed", message, request_id: id }, { status, headers: { "X-Request-ID": id } });
    return status === 401 ? clearSession(response) : response;
  }
}
