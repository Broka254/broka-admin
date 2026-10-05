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
