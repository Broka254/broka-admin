import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { refreshAccessToken } from "@/lib/api/auth";
import { runVerifiedAdminAction, type AdminAction } from "@/lib/api/admin";
import { ACCESS_COOKIE, BrokaApiError, REFRESH_COOKIE } from "@/lib/api/client";
import { sessionCookieOptions } from "@/lib/auth/cookies";
import { requireSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actions: Record<string, AdminAction> = {
  flag: { path: "/admin/users/{user_id}/flag", method: "POST" },
  unflag: { path: "/admin/users/{user_id}/unflag", method: "POST" },
  "recompute-trust": { path: "/admin/users/{user_id}/recompute-trust", method: "POST" },
  "promote-admin": { path: "/admin/users/{user_id}/promote-admin", method: "POST" },
};

function clearSession(response: NextResponse) {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

export async function POST(request: Request, context: { params: Promise<{ userId: string; action: string }> }) {
  const csrfFailure = requireSameOrigin(request);
  if (csrfFailure) return csrfFailure;
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return NextResponse.json({ code: "idempotency_key_required", message: "A unique idempotency key is required for this administrative mutation." }, { status: 400 });
  }

  const { userId, action } = await context.params;
  const definition = actions[action];
  if (!definition) return NextResponse.json({ message: "This user action is not allowlisted." }, { status: 404 });

  const store = await cookies();
  let accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  try {
    let refreshedTokens: Awaited<ReturnType<typeof refreshAccessToken>> | undefined;
    try {
      await runVerifiedAdminAction(definition, userId, accessToken, idempotencyKey);
    } catch (error) {
      if (!(error instanceof BrokaApiError) || error.status !== 401 || !refreshToken) throw error;
      refreshedTokens = await refreshAccessToken(refreshToken);
      accessToken = refreshedTokens.accessToken;
      await runVerifiedAdminAction(definition, userId, accessToken, idempotencyKey);
    }

    const response = NextResponse.json({ accepted: true, message: "BROKA accepted the action. Audit response fields are not rendered until documented." });
    if (refreshedTokens) {
      response.cookies.set(ACCESS_COOKIE, refreshedTokens.accessToken, sessionCookieOptions());
      if (refreshedTokens.refreshToken) response.cookies.set(REFRESH_COOKIE, refreshedTokens.refreshToken, sessionCookieOptions(60 * 60 * 24 * 14));
    }
    return response;
  } catch (error) {
    const status = error instanceof BrokaApiError && error.status ? error.status : 503;
    const message = error instanceof BrokaApiError ? error.message : "The BROKA API could not complete this action.";
    const response = NextResponse.json({ message }, { status });
    return status === 401 ? clearSession(response) : response;
  }
}
