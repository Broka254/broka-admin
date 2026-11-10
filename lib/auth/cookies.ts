import type { NextResponse } from "next/server";

export function sessionCookieOptions(maxAge = 60 * 60 * 8) {
  const secure = process.env.BROKA_COOKIE_SECURE !== "false";
  return {
    httpOnly: true,
    secure,
    // HTTPS Preview and production require None for the cross-site iframe.
    // Plain HTTP local development must use Lax because browsers reject None without Secure.
    sameSite: secure ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge,
  };
}

export const SESSION_COOKIE_NAMES = ["broka_admin_access", "broka_admin_refresh"] as const;

// Expire the session with the same attributes it was set with. A bare
// cookies.delete() sends neither SameSite=None nor Secure, and inside the
// cross-site iframe the browser treats that Set-Cookie as SameSite=Lax and
// ignores it - the session survived logout and every forced sign-out.
export function expireSessionCookies<T extends NextResponse>(response: T): T {
  for (const name of SESSION_COOKIE_NAMES) response.cookies.set(name, "", sessionCookieOptions(0));
  return response;
}
