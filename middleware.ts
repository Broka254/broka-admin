import { NextRequest, NextResponse } from "next/server";

import { expireSessionCookies, sessionCookieOptions } from "@/lib/auth/cookies";

const ACCESS_COOKIE = "broka_admin_access";
const REFRESH_COOKIE = "broka_admin_refresh";
const AUTH_TIMEOUT_MS = 5000;
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

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
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  });
  const data = response.ok ? await response.json().catch(() => null) : null;
  return { response, data };
}

async function requestRefresh(api: string, refreshToken: string): Promise<{ access: string; refresh?: string } | null> {
  const refreshed = await fetch(`${api}/auth/token/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  });
  const tokens = refreshed.ok ? await refreshed.json().catch(() => null) : null;
  const record = tokens && typeof tokens === "object" && !Array.isArray(tokens) ? (tokens as Record<string, unknown>) : null;
  if (typeof record?.access_token !== "string") return null;
  return { access: record.access_token, refresh: typeof record.refresh_token === "string" ? record.refresh_token : undefined };
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
  // The access cookie expires after 8 hours and the browser drops it; the
  // 14-day refresh cookie is still a session, so only no tokens at all
  // sends the administrator back to sign in.
  if (!api || (!accessToken && !refreshToken)) return loginRedirect(request, "restricted");

  try {
    let updated: { access: string; refresh?: string } | null = null;
    let validation = accessToken ? await requestMe(api, accessToken) : null;

    if ((!validation || validation.response.status === 401) && refreshToken) {
      updated = await requestRefresh(api, refreshToken);
      if (!updated) return expireSessionCookies(loginRedirect(request, "session"));
      validation = await requestMe(api, updated.access);
    }

    if (!validation || !validation.response.ok) {
      const response = loginRedirect(request, validation?.response.status === 403 ? "forbidden" : "session");
      return validation?.response.status === 401 ? expireSessionCookies(response) : response;
    }

    if (!isAdmin(validation.data)) {
      return loginRedirect(request, "forbidden");
    }

    if (!updated) return NextResponse.next();
    // Server components in this same request read the request cookies, not
    // the response: forward the new tokens on the request, or the layout's
    // session check sees the expired token and redirects to sign in anyway.
    request.cookies.set(ACCESS_COOKIE, updated.access);
    if (updated.refresh) request.cookies.set(REFRESH_COOKIE, updated.refresh);
    const response = NextResponse.next({ request: { headers: request.headers } });
    response.cookies.set(ACCESS_COOKIE, updated.access, sessionCookieOptions());
    if (updated.refresh) response.cookies.set(REFRESH_COOKIE, updated.refresh, sessionCookieOptions(REFRESH_COOKIE_MAX_AGE));
    return response;
  } catch {
    // Fail closed when the authorization service cannot be confirmed.
    return loginRedirect(request, "session");
  }
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|brand|manus-routes.json).*)"],
};
