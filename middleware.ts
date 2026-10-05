import { NextRequest, NextResponse } from "next/server";

import { sessionCookieOptions } from "@/lib/auth/cookies";

const ACCESS_COOKIE = "broka_admin_access";
const REFRESH_COOKIE = "broka_admin_refresh";

function loginRedirect(request: NextRequest, reason: "restricted" | "forbidden" | "session") {
  const url = new URL("/login", request.url);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

function baseUrl() {
  return process.env.BROKA_API_URL?.replace(/\/$/, "");
}

async function requestMe(api: string, accessToken: string) {
  const response = await fetch(`${api}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const data = response.ok ? await response.json().catch(() => null) : null;
  return { response, data };
}

function isAdmin(payload: unknown) {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && (payload as Record<string, unknown>).is_admin === true);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const api = baseUrl();
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!api || !accessToken) return loginRedirect(request, "restricted");

  try {
    let validation = await requestMe(api, accessToken);
    let updatedAccessToken: string | undefined;
    let updatedRefreshToken: string | undefined;

    if (validation.response.status === 401 && refreshToken) {
      const refreshed = await fetch(`${api}/auth/token/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      });
      const tokens = refreshed.ok ? await refreshed.json().catch(() => null) : null;
      const tokenRecord = tokens && typeof tokens === "object" && !Array.isArray(tokens) ? (tokens as Record<string, unknown>) : null;
      if (typeof tokenRecord?.access_token !== "string") {
        const response = loginRedirect(request, "session");
        response.cookies.delete(ACCESS_COOKIE);
        response.cookies.delete(REFRESH_COOKIE);
        return response;
      }
      updatedAccessToken = tokenRecord.access_token;
      updatedRefreshToken = typeof tokenRecord.refresh_token === "string" ? tokenRecord.refresh_token : undefined;
      validation = await requestMe(api, updatedAccessToken);
    }

    if (!validation.response.ok) {
      const response = loginRedirect(request, validation.response.status === 403 ? "forbidden" : "session");
      if (validation.response.status === 401) {
        response.cookies.delete(ACCESS_COOKIE);
        response.cookies.delete(REFRESH_COOKIE);
      }
      return response;
    }

    if (!isAdmin(validation.data)) {
      return loginRedirect(request, "forbidden");
    }

    const response = NextResponse.next();
    if (updatedAccessToken) response.cookies.set(ACCESS_COOKIE, updatedAccessToken, sessionCookieOptions());
    if (updatedRefreshToken) response.cookies.set(REFRESH_COOKIE, updatedRefreshToken, sessionCookieOptions(60 * 60 * 24 * 14));
    return response;
  } catch {
    // Fail closed when the authorization service cannot be confirmed.
    return loginRedirect(request, "session");
  }
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|brand|manus-routes.json).*)"],
};
