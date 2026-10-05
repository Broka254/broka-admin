import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { fetchAdminIdentity, refreshAccessToken } from "@/lib/api/auth";
import { ACCESS_COOKIE, BrokaApiError, REFRESH_COOKIE } from "@/lib/api/client";
import { sessionCookieOptions } from "@/lib/auth/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  try {
    const admin = await fetchAdminIdentity(accessToken);
    return NextResponse.json({ admin: { name: admin.displayName, role: admin.roleLabel } });
  } catch (error) {
    if (!(error instanceof BrokaApiError) || error.status !== 401 || !refreshToken) {
      const message = error instanceof BrokaApiError ? error.message : "Unable to validate the session.";
      return NextResponse.json({ message }, { status: error instanceof BrokaApiError && error.status ? error.status : 502 });
    }

    try {
      const tokens = await refreshAccessToken(refreshToken);
      const admin = await fetchAdminIdentity(tokens.accessToken);
      const response = NextResponse.json({ admin: { name: admin.displayName, role: admin.roleLabel } });
      response.cookies.set(ACCESS_COOKIE, tokens.accessToken, sessionCookieOptions());
      if (tokens.refreshToken) response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, sessionCookieOptions(60 * 60 * 24 * 14));
      return response;
    } catch {
      const response = NextResponse.json({ message: "Your session is no longer valid. Please sign in again." }, { status: 401 });
      response.cookies.delete(ACCESS_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
      return response;
    }
  }
}
