import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { revokeRefreshToken } from "@/lib/api/auth";
import { REFRESH_COOKIE } from "@/lib/api/client";
import { expireSessionCookies } from "@/lib/auth/cookies";
import { requireSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrfFailure = requireSameOrigin(request);
  if (csrfFailure) return csrfFailure;
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch {
      // Clear local cookies even if the upstream token was already invalid or offline.
    }
  }

  // Expire with the attributes the cookies were set with (SameSite=None;
  // Secure in the embedded deployment); a bare delete is ignored there and
  // the session outlived the sign-out.
  return expireSessionCookies(NextResponse.json({ ok: true }));
}
