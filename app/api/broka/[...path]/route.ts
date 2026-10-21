import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ZodType } from "zod";

import { refreshAccessToken } from "@/lib/api/auth";
import { isSafeAdminPath, resourceForPath, validateAdminResource } from "@/lib/api/admin";
import { ACCESS_COOKIE, BrokaApiError, REFRESH_COOKIE, parseUnknownJson, publicErrorMessage, upstreamFetch } from "@/lib/api/client";
import { sessionCookieOptions } from "@/lib/auth/cookies";
import { readBoundedJsonBody } from "@/lib/http/bounded-body";
import { requireSameOrigin } from "@/lib/security/csrf";
import {
  AudiencePreviewInSchema,
  AudiencePreviewOutSchema,
  CommunicationCreateInSchema,
  CommunicationUpdateInSchema,
  ScheduleInSchema,
  ReasonInSchema,
  RetryInSchema,
  CommunicationOutSchema,
  PublishOutSchema,
  RetryOutSchema,
} from "@/lib/api/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAYLOAD_BYTES = 512 * 1024; // 512KB

function clearSession(response: NextResponse) {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function totalCount(response: Response): string | null {
  const value = response.headers.get("x-total-count")?.trim();
  if (!value || !/^\d+$/.test(value)) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) ? String(count) : null;
}

type MutationOperation = {
  method: "POST" | "PATCH";
  pattern: RegExp;
  requestSchema: ZodType | null;
  responseSchema: ZodType;
  requiresIdempotencyKey?: boolean;
};

const MUTATION_OPERATIONS: MutationOperation[] = [
  {
    method: "POST",
    pattern: /^admin\/communications\/preview$/,
    requestSchema: AudiencePreviewInSchema,
    responseSchema: AudiencePreviewOutSchema,
  },
  {
    method: "POST",
    pattern: /^admin\/communications$/,
    requestSchema: CommunicationCreateInSchema,
    responseSchema: CommunicationOutSchema,
  },
  {
    method: "PATCH",
    pattern: /^admin\/communications\/([A-Za-z0-9._-]+)$/,
    requestSchema: CommunicationUpdateInSchema,
    responseSchema: CommunicationOutSchema,
  },
  {
    method: "POST",
    pattern: /^admin\/communications\/([A-Za-z0-9._-]+)\/schedule$/,
    requestSchema: ScheduleInSchema,
    responseSchema: CommunicationOutSchema,
  },
  {
    method: "POST",
    pattern: /^admin\/communications\/([A-Za-z0-9._-]+)\/publish$/,
    requestSchema: null,
    responseSchema: PublishOutSchema,
  },
  {
    method: "POST",
    pattern: /^admin\/communications\/([A-Za-z0-9._-]+)\/cancel$/,
    requestSchema: ReasonInSchema,
    responseSchema: CommunicationOutSchema,
  },
  {
    method: "POST",
    pattern: /^admin\/communications\/([A-Za-z0-9._-]+)\/complete$/,
    requestSchema: ReasonInSchema,
    responseSchema: CommunicationOutSchema,
  },
  {
    method: "POST",
    pattern: /^admin\/communications\/([A-Za-z0-9._-]+)\/recipients\/retry$/,
    requestSchema: RetryInSchema,
    responseSchema: RetryOutSchema,
  },
];

function findMutationOperation(method: string, pathWithoutLeadingSlash: string): MutationOperation | null {
  return MUTATION_OPERATIONS.find(
    (op) => op.method === method && op.pattern.test(pathWithoutLeadingSlash)
  ) ?? null;
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const id = requestId(request);
  const { path: segments } = await context.params;
  const requestedPath = `/${segments.join("/")}`;
  if (!isSafeAdminPath(requestedPath.slice(1))) {
    return NextResponse.json(
      { code: "path_not_allowlisted", message: "This admin endpoint is not allowlisted by the dashboard.", request_id: id },
      { status: 404, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
    );
  }
  const resource = resourceForPath(requestedPath);
  if (!resource) {
    return NextResponse.json(
      { code: "contract_not_registered", message: "This admin endpoint has no registered response contract.", request_id: id },
      { status: 502, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
    );
  }

  const tokenStore = await cookies();
  let accessToken = tokenStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = tokenStore.get(REFRESH_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json(
      { code: "unauthorized", message: "Authentication required.", request_id: id },
      { status: 401, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
    );
  }

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
      const response = NextResponse.json(
        {
          code: upstream.status === 403 ? "forbidden" : upstream.status === 401 ? "unauthorized" : "upstream_error",
          message: publicErrorMessage(upstream),
          request_id: id,
        },
        { status: upstream.status, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
      );
      return upstream.status === 401 ? clearSession(response) : response;
    }

    const validated = validateAdminResource(resource, await parseUnknownJson(upstream));
    const headers: Record<string, string> = { "X-Request-ID": id, "Cache-Control": "no-store" };
    // /admin/users reports its filtered total only through this header. The
    // browser needs it to distinguish "50 rows on this page" from the total
    // number of matching records; never synthesise it when it is absent.
    const total = totalCount(upstream);
    if (total !== null) headers["X-Total-Count"] = total;
    const response = NextResponse.json(validated, { headers });
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
    const response = NextResponse.json({ code, message, request_id: id }, { status, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } });
    return status === 401 ? clearSession(response) : response;
  }
}

async function handleMutation(
  method: "POST" | "PATCH",
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const csrfFailure = requireSameOrigin(request);
  if (csrfFailure) return csrfFailure;

  const id = requestId(request);
  const { path: segments } = await context.params;
  const pathWithoutLeadingSlash = segments.join("/");
  const requestedPath = `/${pathWithoutLeadingSlash}`;

  // Find explicit allowed operation
  const operation = findMutationOperation(method, pathWithoutLeadingSlash);
  if (!operation) {
    return NextResponse.json(
      { code: "mutation_not_allowlisted", message: `The ${method} operation for this path is not allowlisted.`, request_id: id },
      { status: 404, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
    );
  }

  // Idempotency key extraction & validation
  const rawIdempotency = request.headers.get("x-idempotency-key")?.trim() || request.headers.get("idempotency-key")?.trim();
  let idempotencyKey: string | undefined;
  if (rawIdempotency) {
    if (rawIdempotency.length < 8 || rawIdempotency.length > 128) {
      return NextResponse.json(
        { code: "invalid_idempotency_key", message: "Idempotency key must be between 8 and 128 characters.", request_id: id },
        { status: 400, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
      );
    }
    idempotencyKey = rawIdempotency;
  }

  // Validate incoming request body if required
  let validatedBody: unknown = undefined;
  if (operation.requestSchema) {
    const bodyResult = await readBoundedJsonBody(request, MAX_PAYLOAD_BYTES);
    if (!bodyResult.ok) {
      return NextResponse.json(
        { code: bodyResult.code, message: bodyResult.message, request_id: id },
        { status: bodyResult.status, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
      );
    }
    const parseResult = operation.requestSchema.safeParse(bodyResult.value);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          code: "validation_failed",
          message: "Request payload did not match the expected schema.",
          errors: parseResult.error.flatten(),
          request_id: id,
        },
        { status: 422, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
      );
    }
    validatedBody = parseResult.data;
  }

  // Authorization check
  const tokenStore = await cookies();
  let accessToken = tokenStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = tokenStore.get(REFRESH_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json(
      { code: "unauthorized", message: "Authentication required.", request_id: id },
      { status: 401, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
    );
  }

  const upstreamHeaders: Record<string, string> = {
    "X-Request-ID": id,
    Accept: "application/json",
  };
  if (idempotencyKey) upstreamHeaders["X-Idempotency-Key"] = idempotencyKey;
  if (validatedBody !== undefined) upstreamHeaders["Content-Type"] = "application/json";

  const sourceUrl = new URL(request.url);
  const upstreamPath = `${requestedPath}${sourceUrl.search}`;

  try {
    let upstream = await upstreamFetch(
      upstreamPath,
      {
        method,
        headers: upstreamHeaders,
        body: validatedBody !== undefined ? JSON.stringify(validatedBody) : undefined,
      },
      accessToken
    );

    let refreshedTokens: Awaited<ReturnType<typeof refreshAccessToken>> | undefined;
    if (upstream.status === 401 && refreshToken) {
      refreshedTokens = await refreshAccessToken(refreshToken);
      accessToken = refreshedTokens.accessToken;
      upstream = await upstreamFetch(
        upstreamPath,
        {
          method,
          headers: upstreamHeaders,
          body: validatedBody !== undefined ? JSON.stringify(validatedBody) : undefined,
        },
        accessToken
      );
    }

    if (!upstream.ok) {
      // Only a client-error body is relayed to the browser, and only after it
      // is length-capped. A 5xx body can contain an upstream stack trace or
      // internal payload, so it is replaced with a generic message.
      let upstreamErrDetail: string | undefined;
      if (upstream.status < 500) {
        try {
          const errJson = (await upstream.json()) as { detail?: string; message?: string };
          const detail = errJson.detail || errJson.message;
          if (typeof detail === "string" && detail.trim() !== "") {
            upstreamErrDetail = detail.trim().slice(0, 300);
          }
        } catch {
          upstreamErrDetail = undefined;
        }
      }
      const code =
        upstream.status === 409
          ? "conflict"
          : upstream.status === 422
          ? "validation_failed"
          : upstream.status === 403
          ? "forbidden"
          : upstream.status === 401
          ? "unauthorized"
          : upstream.status === 404
          ? "endpoint_unavailable"
          : "upstream_error";
      const message =
        upstream.status === 404
          ? "The BROKA API does not serve this endpoint. It may require a backend upgrade."
          : upstreamErrDetail || publicErrorMessage(upstream);

      const response = NextResponse.json(
        { code, message, request_id: id },
        { status: upstream.status, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
      );
      return upstream.status === 401 ? clearSession(response) : response;
    }

    // Parse and runtime-validate response payload
    const rawResponse = await parseUnknownJson(upstream);
    const parsedResponse = operation.responseSchema.safeParse(rawResponse);
    if (!parsedResponse.success) {
      console.error(
        JSON.stringify({
          event: "admin_contract_validation_failed",
          path: requestedPath,
          method,
          request_id: id,
          issues: parsedResponse.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
        })
      );
      return NextResponse.json(
        {
          code: "contract_validation_failed",
          message: "The BROKA API returned data that does not match the verified response contract.",
          request_id: id,
        },
        { status: 502, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
      );
    }

    const response = NextResponse.json(parsedResponse.data, {
      status: upstream.status,
      headers: { "X-Request-ID": id, "Cache-Control": "no-store" },
    });
    if (refreshedTokens) {
      response.cookies.set(ACCESS_COOKIE, refreshedTokens.accessToken, sessionCookieOptions());
      if (refreshedTokens.refreshToken) {
        response.cookies.set(REFRESH_COOKIE, refreshedTokens.refreshToken, sessionCookieOptions(60 * 60 * 24 * 14));
      }
    }
    return response;
  } catch (error) {
    const status = error instanceof BrokaApiError && error.status ? error.status : 503;
    const code =
      error instanceof BrokaApiError && error.code === "invalid-response"
        ? "contract_validation_failed"
        : status === 401
        ? "unauthorized"
        : "backend_unavailable";
    const message = error instanceof BrokaApiError ? error.message : "The BROKA API could not be reached.";
    console.error(JSON.stringify({ event: "admin_proxy_mutation_failure", request_id: id, path: requestedPath, method, status, code }));
    const response = NextResponse.json(
      { code, message, request_id: id },
      { status, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
    );
    return status === 401 ? clearSession(response) : response;
  }
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handleMutation("POST", request, context);
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handleMutation("PATCH", request, context);
}
