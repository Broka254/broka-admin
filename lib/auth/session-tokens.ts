import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { refreshAccessToken } from "@/lib/api/auth";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/api/client";
import { sessionCookieOptions } from "@/lib/auth/cookies";

export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

export type RefreshedTokens = Awaited<ReturnType<typeof refreshAccessToken>>;
export type SessionTokens = { accessToken?: string; refreshToken?: string; refreshed?: RefreshedTokens };

/**
 * The session cookies, refreshed up front when only the refresh token is
 * left. The access cookie lives 8 hours and the refresh cookie 14 days;
 * once the browser dropped the expired access cookie, every request used
 * to answer 401 without trying the refresh token it still held, so an
 * administrator was signed out every working day.
 */
export async function readSessionTokens(): Promise<SessionTokens> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (accessToken || !refreshToken) return { accessToken, refreshToken };
  try {
    const refreshed = await refreshAccessToken(refreshToken);
    return { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken ?? refreshToken, refreshed };
  } catch {
    return { refreshToken };
  }
}

/** Persist tokens a refresh produced during this request. */
export function applyRefreshedCookies<T extends NextResponse>(response: T, refreshed?: RefreshedTokens): T {
  if (!refreshed) return response;
  response.cookies.set(ACCESS_COOKIE, refreshed.accessToken, sessionCookieOptions());
  if (refreshed.refreshToken) response.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, sessionCookieOptions(REFRESH_COOKIE_MAX_AGE));
  return response;
}
