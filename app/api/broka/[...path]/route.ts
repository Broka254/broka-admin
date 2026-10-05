import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { refreshAccessToken } from "@/lib/api/auth";
import { resourceForPath, SAFE_ADMIN_PATHS, validateAdminResource } from "@/lib/api/admin";
import { ACCESS_COOKIE, BrokaApiError, REFRESH_COOKIE, parseUnknownJson, publicErrorMessage, upstreamFetch } from "@/lib/api/client";
import { sessionCookieOptions } from "@/lib/auth/cookies";

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

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const id = requestId(request);
  const { path: segments } = await context.params;
  const requestedPath = `/${segments.join("/")}`;
  if (!SAFE_ADMIN_PATHS.has(requestedPath.slice(1))) return NextResponse.json({ code: "path_not_allowlisted", message: "This admin endpoint is not allowlisted by the dashboard.", request_id: id }, { status: 404, headers: { "X-Request-ID": id } });
  const resource = resourceForPath(requestedPath);
  if (!resource) return NextResponse.json({ code: "contract_not_registered", message: "This admin endpoint has no registered response contract.", request_id: id }, { status: 502, headers: { "X-Request-ID": id } });

  const tokenStore = await cookies();
  let accessToken = tokenStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = tokenStore.get(REFRESH_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ code: "unauthorized", message: "Authentication required.", request_id: id }, { status: 401, headers: { "X-Request-ID": id } });

  const sourceUrl = new URL(request.url);
  const upstreamPath = `${requestedPath}${sourceUrl.search}`;
  try {
    let upstream = await upstreamFetch(upstreamPath, { method: "GET", headers: { "X-Request-ID": id } }, accessToken);
    let refreshedTokens: Awaited<ReturnType<typeof refreshAccessToken>> | undefined;
    if (upstream.status === 401 && refreshToken) {
      refreshedTokens = await refreshAccessToken(refreshToken);
      accessToken = refreshedTokens.accessToken;
      upstream = await upstreamFetch(upstreamPath, { method: "GET", headers: { "X-Request-ID": id } }, accessToken);
    }
    if (!upstream.ok) {
      const response = NextResponse.json({ code: upstream.status === 403 ? "forbidden" : upstream.status === 401 ? "unauthorized" : "upstream_error", message: publicErrorMessage(upstream), request_id: id }, { status: upstream.status, headers: { "X-Request-ID": id } });
      return upstream.status === 401 ? clearSession(response) : response;
    }

    const validated = validateAdminResource(resource, await parseUnknownJson(upstream));
    const response = NextResponse.json(validated, { headers: { "X-Request-ID": id } });
    if (refreshedTokens) {
      response.cookies.set(ACCESS_COOKIE, refreshedTokens.accessToken, sessionCookieOptions());
      if (refreshedTokens.refreshToken) response.cookies.set(REFRESH_COOKIE, refreshedTokens.refreshToken, sessionCookieOptions(60 * 60 * 24 * 14));
    }
    return response;
  } catch (error) {
    const status = error instanceof BrokaApiError && error.status ? error.status : 503;
    const code = error instanceof BrokaApiError && error.code === "invalid-response" ? "contract_validation_failed" : status === 401 ? "unauthorized" : "backend_unavailable";
    const message = error instanceof BrokaApiError ? error.message : "The BROKA API could not be reached.";
    console.error(JSON.stringify({ event: "admin_proxy_failure", request_id: id, resource, status, code }));
    const response = NextResponse.json({ code, message, request_id: id }, { status, headers: { "X-Request-ID": id } });
    return status === 401 ? clearSession(response) : response;
  }
}
