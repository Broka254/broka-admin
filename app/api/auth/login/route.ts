import { NextResponse } from "next/server";

import { fetchAdminIdentity, login } from "@/lib/api/auth";
import { ACCESS_COOKIE, BrokaApiError, REFRESH_COOKIE } from "@/lib/api/client";
import { sessionCookieOptions } from "@/lib/auth/cookies";
import { requireSameOrigin } from "@/lib/security/csrf";
import type { LoginInput } from "@/types/broka";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLoginInput(value: unknown): value is LoginInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.phone === "string" && typeof candidate.password === "string";
}

export async function POST(request: Request) {
  const csrfFailure = requireSameOrigin(request);
  if (csrfFailure) return csrfFailure;
  try {
    const input = await request.json();
    if (!isLoginInput(input)) {
      return NextResponse.json({ message: "Phone number and password are required." }, { status: 400 });
    }

    const tokens = await login(input);
    const admin = await fetchAdminIdentity(tokens.accessToken);
    const response = NextResponse.json({ admin: { name: admin.displayName, role: admin.roleLabel } });
    response.cookies.set(ACCESS_COOKIE, tokens.accessToken, sessionCookieOptions());
    if (tokens.refreshToken) response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, sessionCookieOptions(60 * 60 * 24 * 14));
    return response;
  } catch (error) {
    const message = error instanceof BrokaApiError ? error.message : "Unable to sign in to BROKA.";
    const status = error instanceof BrokaApiError && error.status ? error.status : 502;
    return NextResponse.json({ message }, { status });
  }
}
