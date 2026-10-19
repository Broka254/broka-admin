import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { refreshAccessToken } from "@/lib/api/auth";
import { FRAUD_EVENT_ACTIONS, runVerifiedAdminAction } from "@/lib/api/admin";
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

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const csrfFailure = requireSameOrigin(request);
  if (csrfFailure) return csrfFailure;
  const id = requestId(request);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return NextResponse.json({ code: "idempotency_key_required", message: "A unique idempotency key is required for this administrative mutation.", request_id: id }, { status: 400 });
  }

  const { eventId } = await context.params;
  const definition = FRAUD_EVENT_ACTIONS.resolve;
  const payload = (await request.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : undefined;
  if (reason && (reason.length < 3 || reason.length > 500)) {
    return NextResponse.json({ code: "invalid_reason", message: "A review note must be 3-500 characters when supplied.", request_id: id }, { status: 422 });
  }

  const store = await cookies();
  let accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ code: "unauthorized", message: "Authentication required.", request_id: id }, { status: 401 });

  try {
    let refreshedTokens: Awaited<ReturnType<typeof refreshAccessToken>> | undefined;
    let result;
    try {
      result = await runVerifiedAdminAction(definition, { event_id: eventId }, accessToken, { idempotencyKey, reason, requestId: id });
    } catch (error) {
      if (!(error instanceof BrokaApiError) || error.status !== 401 || !refreshToken) throw error;
      refreshedTokens = await refreshAccessToken(refreshToken);
      accessToken = refreshedTokens.accessToken;
      result = await runVerifiedAdminAction(definition, { event_id: eventId }, accessToken, { idempotencyKey, reason, requestId: id });
    }

    const response = NextResponse.json({ ...result, accepted: true, request_id: id }, { headers: { "X-Request-ID": id } });
    if (refreshedTokens) {
      response.cookies.set(ACCESS_COOKIE, refreshedTokens.accessToken, sessionCookieOptions());
      if (refreshedTokens.refreshToken) response.cookies.set(REFRESH_COOKIE, refreshedTokens.refreshToken, sessionCookieOptions(60 * 60 * 24 * 14));
    }
    return response;
  } catch (error) {
    const status = error instanceof BrokaApiError && error.status ? error.status : 503;
    const message = error instanceof BrokaApiError ? error.message : "The BROKA API could not complete this action.";
    const response = NextResponse.json({ code: "action_failed", message, request_id: id }, { status, headers: { "X-Request-ID": id } });
    return status === 401 ? clearSession(response) : response;
  }
}
