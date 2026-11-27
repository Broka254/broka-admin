import "server-only";

import { NextResponse } from "next/server";

import type { ApiResource } from "@/types/broka";

// The server side of Jarvis Mode's proxy rules. The route calls into this
// module for three things:
//
// 1. Query strings. A Jarvis read accepts only the parameters its endpoint
//    documents, each a single integer inside a fixed range. Anything else is
//    refused before the request leaves the dashboard.
// 2. Failures. The backend reports Jarvis failures as a stable code under
//    `detail.code` (FastAPI nests it). Only the codes listed below are passed
//    on, and each carries a message written here. Backend text, provider
//    errors and stack traces are never relayed.
// 3. Retry-After, which is passed on for rate limits only, and only as a
//    bounded integer.

type QueryRule = { min: number; max: number };

const READ_QUERY_RULES: Partial<Record<ApiResource, Record<string, QueryRule>>> = {
  zenoStatus: {},
  zenoBriefing: { window_days: { min: 1, max: 30 } },
  zenoConversations: { limit: { min: 1, max: 50 }, offset: { min: 0, max: 10000 } },
  zenoConversationDetail: { limit: { min: 1, max: 40 }, offset: { min: 0, max: 10000 } },
};

export function isZenoResource(resource: ApiResource): boolean {
  return Object.prototype.hasOwnProperty.call(READ_QUERY_RULES, resource);
}

export type ZenoQueryResult = { ok: true; search: string } | { ok: false };

/**
 * Validates a Jarvis read's query string and rebuilds it from the validated
 * values only. Duplicate, unknown or out-of-range parameters fail, and the
 * rebuilt query string never includes anything the browser sent that was not
 * checked.
 */
export function zenoReadQuery(resource: ApiResource, params: URLSearchParams): ZenoQueryResult {
  const rules = READ_QUERY_RULES[resource];
  if (!rules) return { ok: false };

  const keys = Array.from(params.keys());
  if (new Set(keys).size !== keys.length) return { ok: false };
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(rules, key)) return { ok: false };
  }

  const pairs: string[] = [];
  for (const name of Object.keys(rules)) {
    const values = params.getAll(name);
    if (values.length === 0) continue;
    const rule = rules[name];
    const raw = values[0];
    if (!/^\d{1,5}$/.test(raw)) return { ok: false };
    const value = Number(raw);
    if (value < rule.min || value > rule.max) return { ok: false };
    pairs.push(`${name}=${value}`);
  }
  return { ok: true, search: pairs.length ? `?${pairs.join("&")}` : "" };
}

/** The approved, user-facing text for each Jarvis failure code the backend defines. */
const APPROVED_BACKEND_CODES = new Map<string, string>([
  ["ADMIN_ZENO_DISABLED", "Jarvis Mode is not enabled on this deployment."],
  [
    "MODEL_CONTEXT_UNSAFE",
    "This question could not be prepared safely for the model. Remove personal details or ask about aggregate figures.",
  ],
  ["MODEL_UNAVAILABLE", "The intelligence model is unavailable. No answer was generated."],
  ["INVESTIGATION_TIMEOUT", "The investigation took too long. Try a narrower question."],
]);

/** Text for failures the backend reports by status, with no Jarvis-specific code. */
const STATUS_MESSAGES = {
  unauthorized: "Your session is no longer valid. Please sign in again.",
  forbidden: "Your BROKA account is not authorized for Jarvis Mode.",
  conversationNotFound: "This investigation is no longer available. Start a new one.",
  endpointUnavailable: "This BROKA API does not provide Jarvis Mode yet. It may require a backend upgrade.",
  validationFailed: "The request was not accepted. Check the question and try again.",
  rateLimited: "Too many questions in a short time. Wait a minute and try again.",
  backendUnavailable: "The BROKA API is temporarily unavailable. Please retry shortly.",
  upstreamError: "The BROKA API could not complete this request.",
  invalidQuery: "This request includes a parameter that Jarvis Mode does not accept.",
} as const;

/** The backend's exact text for a missing conversation, used only to classify the 404. */
const BACKEND_CONVERSATION_NOT_FOUND = "Conversation not found";

const MAX_ERROR_BYTES = 8 * 1024;

export type ZenoFailure = {
  status: number;
  code: string;
  message: string;
  retryAfterSeconds: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRetryAfter(value: string | null): number | null {
  if (!value || !/^\d{1,5}$/.test(value.trim())) return null;
  const seconds = Number(value.trim());
  return seconds > 0 && seconds <= 3600 ? seconds : null;
}

async function readBackendDetail(upstream: Response): Promise<{ code?: string; text?: string }> {
  let raw: string;
  try {
    raw = (await upstream.text()).slice(0, MAX_ERROR_BYTES);
  } catch {
    return {};
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return {};
  }
  const detail = isRecord(body) ? body.detail : undefined;
  if (typeof detail === "string") return { text: detail };
  if (isRecord(detail) && typeof detail.code === "string") return { code: detail.code };
  return {};
}

/**
 * Classifies a failed upstream reply into the response the browser receives.
 * The HTTP status is kept, because the caller uses 401 to end the session.
 */
export async function classifyZenoFailure(upstream: Response): Promise<ZenoFailure> {
  const status = upstream.status >= 400 ? upstream.status : 502;
  const detail = await readBackendDetail(upstream);

  if (detail.code && APPROVED_BACKEND_CODES.has(detail.code)) {
    return {
      status,
      code: detail.code,
      message: APPROVED_BACKEND_CODES.get(detail.code) as string,
      retryAfterSeconds: null,
    };
  }

  const fail = (code: string, message: string, retryAfterSeconds: number | null = null): ZenoFailure => ({
    status,
    code,
    message,
    retryAfterSeconds,
  });

  if (status === 401) return fail("unauthorized", STATUS_MESSAGES.unauthorized);
  if (status === 403) return fail("forbidden", STATUS_MESSAGES.forbidden);
  if (status === 404) {
    return detail.text === BACKEND_CONVERSATION_NOT_FOUND
      ? fail("conversation_not_found", STATUS_MESSAGES.conversationNotFound)
      : fail("endpoint_unavailable", STATUS_MESSAGES.endpointUnavailable);
  }
  if (status === 422) return fail("validation_failed", STATUS_MESSAGES.validationFailed);
  if (status === 429) {
    return fail(
      "rate_limited",
      STATUS_MESSAGES.rateLimited,
      parseRetryAfter(upstream.headers.get("retry-after")),
    );
  }
  if (status >= 500) return fail("backend_unavailable", STATUS_MESSAGES.backendUnavailable);
  return fail("upstream_error", STATUS_MESSAGES.upstreamError);
}

/** The JSON response for a Jarvis failure. The same shape as every other proxy error. */
export async function zenoFailureResponse(upstream: Response, requestId: string): Promise<NextResponse> {
  const failure = await classifyZenoFailure(upstream);
  const headers: Record<string, string> = { "X-Request-ID": requestId, "Cache-Control": "no-store" };
  if (failure.retryAfterSeconds !== null) headers["Retry-After"] = String(failure.retryAfterSeconds);
  return NextResponse.json(
    { code: failure.code, message: failure.message, request_id: requestId },
    { status: failure.status, headers },
  );
}

/** A Jarvis read whose query string was refused. Nothing is sent upstream. */
export function zenoInvalidQueryResponse(requestId: string): NextResponse {
  return NextResponse.json(
    { code: "invalid_query", message: STATUS_MESSAGES.invalidQuery, request_id: requestId },
    { status: 422, headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" } },
  );
}
