import { NextResponse } from "next/server";

import { refreshAccessToken } from "@/lib/api/auth";
import { FRAUD_EVENT_ACTIONS, isSafeIdSegment, runVerifiedAdminAction } from "@/lib/api/admin";
import { BrokaApiError } from "@/lib/api/client";
import { expireSessionCookies } from "@/lib/auth/cookies";
import { applyRefreshedCookies, readSessionTokens, type RefreshedTokens } from "@/lib/auth/session-tokens";
import { readBoundedJsonBody } from "@/lib/http/bounded-body";
import { requireSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ACTION_BODY_BYTES = 8 * 1024;

function clearSession(response: NextResponse) {
  return expireSessionCookies(response);
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
  if (!isSafeIdSegment(eventId)) return NextResponse.json({ code: "invalid_id", message: "This is not a valid fraud event id.", request_id: id }, { status: 404 });
  const definition = FRAUD_EVENT_ACTIONS.resolve;

  let reason: string | undefined;
  if (request.body) {
    const body = await readBoundedJsonBody(request, MAX_ACTION_BODY_BYTES);
    if (!body.ok) return NextResponse.json({ code: body.code, message: body.message, request_id: id }, { status: body.status });
    const payload = body.value && typeof body.value === "object" && !Array.isArray(body.value) ? (body.value as { reason?: unknown }) : {};
    reason = typeof payload.reason === "string" ? payload.reason.trim() : undefined;
  }
  if (reason && (reason.length < 3 || reason.length > 500)) {
    return NextResponse.json({ code: "invalid_reason", message: "A review note must be 3-500 characters when supplied.", request_id: id }, { status: 422 });
  }

  const session = await readSessionTokens();
  let accessToken = session.accessToken;
  const refreshToken = session.refreshToken;
  if (!accessToken) return NextResponse.json({ code: "unauthorized", message: "Authentication required.", request_id: id }, { status: 401 });

  try {
    let refreshedTokens: RefreshedTokens | undefined = session.refreshed;
    let result;
    try {
      result = await runVerifiedAdminAction(definition, { event_id: eventId }, accessToken, { idempotencyKey, reason, requestId: id });
    } catch (error) {
      if (!(error instanceof BrokaApiError) || error.status !== 401 || !refreshToken || session.refreshed) throw error;
      refreshedTokens = await refreshAccessToken(refreshToken);
      accessToken = refreshedTokens.accessToken;
      result = await runVerifiedAdminAction(definition, { event_id: eventId }, accessToken, { idempotencyKey, reason, requestId: id });
    }

    return applyRefreshedCookies(NextResponse.json({ ...result, accepted: true, request_id: id }, { headers: { "X-Request-ID": id } }), refreshedTokens);
  } catch (error) {
    const status = error instanceof BrokaApiError && error.status ? error.status : 503;
    const message = error instanceof BrokaApiError ? error.message : "The BROKA API could not complete this action.";
    const response = NextResponse.json({ code: "action_failed", message, request_id: id }, { status, headers: { "X-Request-ID": id } });
    return status === 401 ? clearSession(response) : response;
  }
}
