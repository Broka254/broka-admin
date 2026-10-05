import { NextResponse } from "next/server";

/**
 * Cookie-authenticated POSTs must originate from this application. This is a
 * defense-in-depth CSRF control for the embedded HTTPS Preview and production
 * deployment; the FastAPI service must still enforce its own CSRF/origin policy.
 */
export function requireSameOrigin(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
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
