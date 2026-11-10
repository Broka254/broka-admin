import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { refreshAccessToken } from "@/lib/api/auth";
import { hasDotSegment, isSafeAdminPath, isStreamPath, resourceForPath, validateAdminResource } from "@/lib/api/admin";
import { BrokaApiError, parseUnknownJson, publicErrorMessage, upstreamFetch, upstreamStream } from "@/lib/api/client";
import { expireSessionCookies } from "@/lib/auth/cookies";
import { applyRefreshedCookies, readSessionTokens, type RefreshedTokens } from "@/lib/auth/session-tokens";
import { readBoundedJsonBody } from "@/lib/http/bounded-body";
import { requireSameOrigin } from "@/lib/security/csrf";
import {
  AlertAcknowledgeInSchema,
  AlertCreateInSchema,
  AlertSchema,
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
  ProductionCostEntryInSchema,
  ProductionCostEntryPatchSchema,
  ProductionCostEntryMutationResponseSchema,
  ProductionCostPricingInSchema,
  ProductionCostPricingPatchSchema,
  ProductionCostPricingMutationResponseSchema,
} from "@/lib/api/schemas";
import {
  FeedbackAdminItemSchema,
  FeedbackTriageInSchema,
  ReportDetailSchema,
  ReportGenerateInSchema,
} from "@/lib/api/intelligence-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAYLOAD_BYTES = 512 * 1024; // 512KB

function clearSession(response: NextResponse) {
  return expireSessionCookies(response);
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
    pattern: /^admin\/alerts$/,
    requestSchema: AlertCreateInSchema,
    responseSchema: AlertSchema,
    requiresIdempotencyKey: false,
  },
  {
    method: "POST",
    pattern: /^admin\/alerts\/([A-Za-z0-9._-]+)\/acknowledge$/,
    requestSchema: AlertAcknowledgeInSchema,
    responseSchema: AlertSchema,
    requiresIdempotencyKey: true,
  },
  {
    method: "POST",
    pattern: /^admin\/alerts\/([A-Za-z0-9._-]+)\/resolve$/,
    requestSchema: null,
    responseSchema: AlertSchema,
    requiresIdempotencyKey: true,
  },
  {
    method: "POST",
    pattern: /^admin\/communications$/,
    requestSchema: CommunicationCreateInSchema,
    responseSchema: CommunicationOutSchema,
  },
  {
    method: "POST",
    pattern: /^admin\/revenue\/costs\/entries$/,
    requestSchema: ProductionCostEntryInSchema,
    responseSchema: ProductionCostEntryMutationResponseSchema,
  },
  {
    method: "PATCH",
    pattern: /^admin\/revenue\/costs\/entries\/(\d+)$/,
    requestSchema: ProductionCostEntryPatchSchema,
    responseSchema: ProductionCostEntryMutationResponseSchema,
  },
  {
    method: "POST",
    pattern: /^admin\/revenue\/costs\/pricing$/,
    requestSchema: ProductionCostPricingInSchema,
    responseSchema: ProductionCostPricingMutationResponseSchema,
  },
  {
    method: "PATCH",
    pattern: /^admin\/revenue\/costs\/pricing\/(\d+)$/,
    requestSchema: ProductionCostPricingPatchSchema,
    responseSchema: ProductionCostPricingMutationResponseSchema,
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
  // Complaint triage: status and/or a reply the user sees (and is pushed).
  // Setting a state is naturally idempotent, so no key is demanded.
  {
    method: "PATCH",
    pattern: /^admin\/feedback\/([A-Za-z0-9-]+)$/,
    requestSchema: FeedbackTriageInSchema,
    responseSchema: FeedbackAdminItemSchema,
  },
  // Build or rebuild one closed period's founder report: an upsert.
  {
    method: "POST",
    pattern: /^admin\/reports\/generate$/,
    requestSchema: ReportGenerateInSchema,
    responseSchema: ReportDetailSchema,
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
  // SSE streams pass the upstream body through unbuffered as
  // text/event-stream. Never JSON-parse or buffer it here.
  if (isStreamPath(requestedPath.slice(1))) {
    const session = await readSessionTokens();
    const accessToken = session.accessToken;
    if (!accessToken) {
      return NextResponse.json(
        { code: "unauthorized", message: "Authentication required.", request_id: id },
        { status: 401, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
      );
    }
    const sourceUrl = new URL(request.url);
    const upstreamPath = `${requestedPath}${sourceUrl.search}`;
    const forwardHeaders: Record<string, string> = { "X-Request-ID": id };
    const lastEventId = request.headers.get("last-event-id")?.trim();
    if (lastEventId && lastEventId.length <= 256) forwardHeaders["Last-Event-ID"] = lastEventId;
    try {
      const upstream = await upstreamStream(upstreamPath, { headers: forwardHeaders }, accessToken);
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json(
          {
            code: upstream.status === 401 ? "unauthorized" : "upstream_error",
            message: publicErrorMessage(upstream),
            request_id: id,
          },
          { status: upstream.status, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
        );
      }
      // NextResponse (not Response) so a refresh made for this request can
      // set its cookies on the stream response too.
      return applyRefreshedCookies(new NextResponse(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
          "X-Request-ID": id,
          "X-Accel-Buffering": "no",
        },
      }), session.refreshed);
    } catch (error) {
      const status = error instanceof BrokaApiError && error.status ? error.status : 503;
      const message = error instanceof BrokaApiError ? error.message : "The BROKA API could not be reached.";
      console.error(JSON.stringify({ event: "admin_proxy_stream_failure", request_id: id, path: requestedPath, status }));
      return NextResponse.json({ code: "backend_unavailable", message, request_id: id }, { status, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } });
    }
  }
  const resource = resourceForPath(requestedPath);
  if (!resource) {
    return NextResponse.json(
      { code: "contract_not_registered", message: "This admin endpoint has no registered response contract.", request_id: id },
      { status: 502, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
    );
  }

  const session = await readSessionTokens();
  let accessToken = session.accessToken;
  const refreshToken = session.refreshToken;
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
    let refreshedTokens: RefreshedTokens | undefined = session.refreshed;
    if (upstream.status === 401 && refreshToken && !session.refreshed) {
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
    return applyRefreshedCookies(NextResponse.json(validated, { headers }), refreshedTokens);
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

  // Find explicit allowed operation. A dot segment is never an id: fetch()
  // would resolve it out of the allowlisted prefix.
  const operation = hasDotSegment(pathWithoutLeadingSlash) ? null : findMutationOperation(method, pathWithoutLeadingSlash);
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
  if (operation.requiresIdempotencyKey && !idempotencyKey) {
    return NextResponse.json(
      { code: "idempotency_key_required", message: "This operation requires an X-Idempotency-Key header.", request_id: id },
      { status: 400, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }
    );
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
  const session = await readSessionTokens();
  let accessToken = session.accessToken;
  const refreshToken = session.refreshToken;
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

  // Mutations carry their input in the validated body only. The browser's
  // query string used to be appended unchecked, a side channel past the
  // strict request schemas.
  const upstreamPath = requestedPath;

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

    let refreshedTokens: RefreshedTokens | undefined = session.refreshed;
    if (upstream.status === 401 && refreshToken && !session.refreshed) {
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

    // An empty success has nothing to validate; parsing it threw, and the
    // catch below then failed again building a 204 with a JSON body.
    if (upstream.status === 204) {
      return applyRefreshedCookies(
        new NextResponse(null, { status: 204, headers: { "X-Request-ID": id, "Cache-Control": "no-store" } }),
        refreshedTokens,
      );
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

    return applyRefreshedCookies(NextResponse.json(parsedResponse.data, {
      status: upstream.status,
      headers: { "X-Request-ID": id, "Cache-Control": "no-store" },
    }), refreshedTokens);
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
