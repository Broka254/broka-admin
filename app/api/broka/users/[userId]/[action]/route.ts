import { NextResponse } from "next/server";

import { refreshAccessToken } from "@/lib/api/auth";
import { isSafeIdSegment, runVerifiedAdminAction, USER_ACTIONS } from "@/lib/api/admin";
import { BrokaApiError } from "@/lib/api/client";
import { expireSessionCookies } from "@/lib/auth/cookies";
import { applyRefreshedCookies, readSessionTokens, type RefreshedTokens } from "@/lib/auth/session-tokens";
import { readBoundedJsonBody } from "@/lib/http/bounded-body";
import { requireSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A reason is at most 500 characters; nothing legitimate is bigger than this.
const MAX_ACTION_BODY_BYTES = 8 * 1024;

function clearSession(response: NextResponse) {
  return expireSessionCookies(response);
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
  // Own keys only: "constructor" or "__proto__" must not resolve to an
  // inherited Object member and reach the upstream call.
  const definition = Object.hasOwn(USER_ACTIONS, action) ? USER_ACTIONS[action] : undefined;
  if (!definition) return NextResponse.json({ code: "action_not_allowlisted", message: "This user action is not allowlisted.", request_id: id }, { status: 404 });
  if (!isSafeIdSegment(userId)) return NextResponse.json({ code: "invalid_id", message: "This is not a valid user id.", request_id: id }, { status: 404 });

  let reason: string | undefined;
  if (request.body) {
    const body = await readBoundedJsonBody(request, MAX_ACTION_BODY_BYTES);
    if (!body.ok) return NextResponse.json({ code: body.code, message: body.message, request_id: id }, { status: body.status });
    const payload = body.value && typeof body.value === "object" && !Array.isArray(body.value) ? (body.value as { reason?: unknown }) : {};
    reason = typeof payload.reason === "string" ? payload.reason.trim() : undefined;
  }
  if (definition.reasonRequired && (!reason || reason.length < 3 || reason.length > 500)) {
    return NextResponse.json({ code: "reason_required", message: "A written reason (3-500 characters) is required for this action.", request_id: id }, { status: 422 });
  }
  if (reason !== undefined && reason.length > 500) {
    return NextResponse.json({ code: "invalid_reason", message: "A reason may be at most 500 characters.", request_id: id }, { status: 422 });
  }

  const session = await readSessionTokens();
  let accessToken = session.accessToken;
  const refreshToken = session.refreshToken;
  if (!accessToken) return NextResponse.json({ code: "unauthorized", message: "Authentication required.", request_id: id }, { status: 401 });

  try {
    let refreshedTokens: RefreshedTokens | undefined = session.refreshed;
    let result;
    try {
      result = await runVerifiedAdminAction(definition, { user_id: userId }, accessToken, { idempotencyKey, reason, requestId: id });
    } catch (error) {
      if (!(error instanceof BrokaApiError) || error.status !== 401 || !refreshToken || session.refreshed) throw error;
      refreshedTokens = await refreshAccessToken(refreshToken);
      accessToken = refreshedTokens.accessToken;
      result = await runVerifiedAdminAction(definition, { user_id: userId }, accessToken, { idempotencyKey, reason, requestId: id });
    }

    return applyRefreshedCookies(NextResponse.json({ ...result, accepted: true, request_id: id }, { headers: { "X-Request-ID": id } }), refreshedTokens);
  } catch (error) {
    const status = error instanceof BrokaApiError && error.status ? error.status : 503;
    const message = error instanceof BrokaApiError && error.code === "invalid" ? "The BROKA API rejected this action. A written reason may be required." : error instanceof BrokaApiError ? error.message : "The BROKA API could not complete this action.";
    const response = NextResponse.json({ code: status === 422 ? "reason_required" : "action_failed", message, request_id: id }, { status, headers: { "X-Request-ID": id } });
    return status === 401 ? clearSession(response) : response;
  }
}
