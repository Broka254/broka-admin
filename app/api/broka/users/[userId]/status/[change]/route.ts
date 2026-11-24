import { NextResponse } from "next/server";

import { isSafeIdSegment } from "@/lib/api/admin";
import { AccountStatusChangeInSchema, AccountStatusStateSchema } from "@/lib/api/schemas";
import { BrokaApiError, upstreamFetch } from "@/lib/api/client";
import { expireSessionCookies } from "@/lib/auth/cookies";
import { readSessionTokens } from "@/lib/auth/session-tokens";
import { readBoundedJsonBody } from "@/lib/http/bounded-body";
import { requireSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Restricting, suspending and reinstating are the only three account changes
// this dashboard can make. Each maps to one backend route and nothing else.
const CHANGES: ReadonlySet<string> = new Set(["restrict", "suspend", "reinstate"]);
const MAX_BODY_BYTES = 16 * 1024;

function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function json(body: Record<string, unknown>, status: number, id: string) {
  return NextResponse.json(body, { status, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ userId: string; change: string }> }) {
  const csrfFailure = requireSameOrigin(request);
  if (csrfFailure) return csrfFailure;
  const id = requestId(request);
  const { userId, change } = await context.params;
  // Own names only: an inherited property must never be mistaken for a change.
  if (!CHANGES.has(change) || !isSafeIdSegment(userId)) {
    return json({ code: "not_allowlisted", message: "This account change is not allowlisted.", request_id: id }, 404, id);
  }

  const bounded = await readBoundedJsonBody(request, MAX_BODY_BYTES);
  if (!bounded.ok) return json({ code: bounded.code, message: bounded.message, request_id: id }, bounded.status, id);
  const parsed = AccountStatusChangeInSchema.safeParse(bounded.value);
  if (!parsed.success) {
    return json({ code: "validation_failed", message: "The account change did not match the expected fields.", request_id: id }, 422, id);
  }
  const input = parsed.data;
  if (change === "suspend" && input.duration === undefined) {
    return json({ code: "duration_required", message: "Choose how long the suspension lasts, or permanent.", request_id: id }, 422, id);
  }
  if (change !== "suspend" && input.duration !== undefined) {
    return json({ code: "duration_not_applicable", message: "A duration applies only to a suspension.", request_id: id }, 422, id);
  }

  const session = await readSessionTokens();
  if (!session.accessToken) return json({ code: "unauthorized", message: "Authentication required.", request_id: id }, 401, id);

  try {
    const upstream = await upstreamFetch(
      `/admin/users/${encodeURIComponent(userId)}/${change}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Request-ID": id },
        body: JSON.stringify(input),
      },
      session.accessToken,
    );
    if (!upstream.ok) {
      const payload = (await upstream.json().catch(() => ({}))) as { detail?: unknown };
      const detail = typeof payload.detail === "string" && upstream.status < 500 ? payload.detail.slice(0, 300) : "The BROKA API could not apply this account change.";
      const response = json({ code: upstream.status === 401 ? "unauthorized" : upstream.status === 409 ? "conflict" : upstream.status === 403 ? "forbidden" : "action_failed", message: detail, request_id: id }, upstream.status, id);
      return upstream.status === 401 ? expireSessionCookies(response) : response;
    }
    const state = AccountStatusStateSchema.safeParse(await upstream.json().catch(() => null));
    if (!state.success) {
      return json({ code: "contract_validation_failed", message: "The BROKA API returned an account state that does not match the contract.", request_id: id }, 502, id);
    }
    return json({ ...state.data, request_id: id }, 200, id);
  } catch (error) {
    const status = error instanceof BrokaApiError && error.status ? error.status : 503;
    return json({ code: "backend_unavailable", message: error instanceof BrokaApiError ? error.message : "The BROKA API could not be reached.", request_id: id }, status, id);
  }
}
