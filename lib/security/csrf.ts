import { NextResponse } from "next/server";

/**
 * Cookie-authenticated POSTs must originate from this application. This is a
 * defense-in-depth CSRF control for the embedded HTTPS Preview and production
 * deployment; the FastAPI service must still enforce its own CSRF/origin policy.
 */
export function requireSameOrigin(request: Request) {
  // Railway and other reverse proxies may forward the request to the Node
  // process over HTTP even though the browser used HTTPS. Prefer the public
  // forwarded host/protocol when they are present so a legitimate same-origin
  // browser request is not rejected at the proxy boundary.
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestUrl = new URL(request.url);
  const expectedOrigin = forwardedHost
    ? `${forwardedProto === "https" ? "https" : requestUrl.protocol.replace(":", "")}://${forwardedHost}`
    : requestUrl.origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const suppliedOrigin = origin ?? (referer ? new URL(referer).origin : null);

  if (suppliedOrigin !== expectedOrigin) {
    return NextResponse.json(
      { code: "csrf_origin_mismatch", message: "This state-changing request did not originate from the BROKA Admin application." },
      { status: 403 },
    );
  }
  return null;
}
