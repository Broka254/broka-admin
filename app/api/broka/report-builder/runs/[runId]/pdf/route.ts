import { NextResponse } from "next/server";

import { refreshAccessToken } from "@/lib/api/auth";
import { isSafeIdSegment } from "@/lib/api/admin";
import { BrokaApiError, publicErrorMessage, upstreamFetch } from "@/lib/api/client";
import { expireSessionCookies } from "@/lib/auth/cookies";
import { applyRefreshedCookies, readSessionTokens, type RefreshedTokens } from "@/lib/auth/session-tokens";

// GET /api/broka/report-builder/runs/{id}/pdf: a stored report run as a PDF.
// The catch-all proxy only relays JSON it can validate against a contract;
// this route relays exactly one binary read, checks it is a PDF of a bounded
// size, and passes only a file name it recognises.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const FILE_NAME = /^attachment; filename="broka-[a-z0-9-]{1,80}\.pdf"$/;

function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function failure(code: string, message: string, status: number, id: string) {
  return NextResponse.json({ code, message, request_id: id }, { status, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } });
}

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const id = requestId(request);
  const { runId } = await context.params;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(runId) || !isSafeIdSegment(runId)) {
    return failure("invalid_id", "This is not a valid report id.", 404, id);
  }

  const session = await readSessionTokens();
  let accessToken = session.accessToken;
  const refreshToken = session.refreshToken;
  if (!accessToken) {
    const response = failure("unauthorized", "Authentication required.", 401, id);
    return session.refreshRejected ? expireSessionCookies(response) : response;
  }

  const path = `/admin/report-builder/runs/${encodeURIComponent(runId)}/pdf`;
  try {
    let refreshedTokens: RefreshedTokens | undefined = session.refreshed;
    let upstream = await upstreamFetch(path, { method: "GET", headers: { "X-Request-ID": id } }, accessToken);
    if (upstream.status === 401 && refreshToken && !session.refreshed) {
      refreshedTokens = await refreshAccessToken(refreshToken);
      accessToken = refreshedTokens.accessToken;
      upstream = await upstreamFetch(path, { method: "GET", headers: { "X-Request-ID": id } }, accessToken);
    }
    if (!upstream.ok) {
      const message = upstream.status === 404 ? "This report is not in the archive."
        : upstream.status === 409 ? "This report failed to build; regenerate it first."
          : publicErrorMessage(upstream);
      const response = failure(upstream.status === 401 ? "unauthorized" : "upstream_error", message, upstream.status, id);
      return upstream.status === 401 ? expireSessionCookies(response) : response;
    }
    const type = upstream.headers.get("content-type") ?? "";
    const declared = Number(upstream.headers.get("content-length") ?? "0");
    if (!type.startsWith("application/pdf") || declared > MAX_PDF_BYTES) {
      return failure("invalid_response", "The BROKA API did not return a PDF.", 502, id);
    }
    const body = await upstream.arrayBuffer();
    const head = new Uint8Array(body.slice(0, 5));
    if (body.byteLength > MAX_PDF_BYTES || String.fromCharCode(...head) !== "%PDF-") {
      return failure("invalid_response", "The BROKA API did not return a PDF.", 502, id);
    }
    const disposition = upstream.headers.get("content-disposition") ?? "";
    return applyRefreshedCookies(new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": FILE_NAME.test(disposition) ? disposition : 'attachment; filename="broka-report.pdf"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-ID": id,
      },
    }), refreshedTokens);
  } catch (error) {
    const status = error instanceof BrokaApiError && error.status ? error.status : 503;
    const message = error instanceof BrokaApiError ? error.message : "The BROKA API could not be reached.";
    const response = failure("backend_unavailable", message, status, id);
    return status === 401 ? expireSessionCookies(response) : response;
  }
}
