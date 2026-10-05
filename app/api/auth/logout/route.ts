import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { revokeRefreshToken } from "@/lib/api/auth";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/api/client";
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

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}
