import { AdminRequestError } from "@/hooks/use-admin-resource";
import type {
  AudienceIn,
  AudiencePreviewOut,
  CommunicationCreateIn,
  CommunicationUpdateIn,
  CommunicationOut,
  PublishOut,
  RetryOut,
} from "@/lib/api/schemas";

async function postMutation<T>(
  path: string,
  body?: unknown,
  idempotencyKey?: string,
  method: "POST" | "PATCH" = "POST",
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
  }

  const response = await fetch(`/api/broka/${path}`, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok) {
    throw new AdminRequestError(
      payload.message ?? "The requested communication operation could not be completed.",
      response.status,
      payload.code
    );
  }
  return payload as T;
}

export async function previewAudience(audience: AudienceIn, signal?: AbortSignal): Promise<AudiencePreviewOut> {
  return postMutation<AudiencePreviewOut>("admin/communications/preview", { audience }, undefined, "POST", signal);
}

export async function createCommunication(input: CommunicationCreateIn, idempotencyKey?: string): Promise<CommunicationOut> {
  return postMutation<CommunicationOut>("admin/communications", input, idempotencyKey, "POST");
}

export async function updateCommunication(id: string, input: CommunicationUpdateIn, idempotencyKey?: string): Promise<CommunicationOut> {
  return postMutation<CommunicationOut>(`admin/communications/${encodeURIComponent(id)}`, input, idempotencyKey, "PATCH");
}

export async function scheduleCommunication(id: string, scheduledAt: string, idempotencyKey?: string): Promise<CommunicationOut> {
  return postMutation<CommunicationOut>(`admin/communications/${encodeURIComponent(id)}/schedule`, { scheduled_at: scheduledAt }, idempotencyKey, "POST");
}

export async function publishCommunication(id: string, idempotencyKey?: string): Promise<PublishOut> {
  return postMutation<PublishOut>(`admin/communications/${encodeURIComponent(id)}/publish`, undefined, idempotencyKey, "POST");
}

export async function cancelCommunication(id: string, reason?: string, idempotencyKey?: string): Promise<CommunicationOut> {
  return postMutation<CommunicationOut>(`admin/communications/${encodeURIComponent(id)}/cancel`, { reason }, idempotencyKey, "POST");
}

export async function completeCommunication(id: string, reason?: string, idempotencyKey?: string): Promise<CommunicationOut> {
  return postMutation<CommunicationOut>(`admin/communications/${encodeURIComponent(id)}/complete`, { reason }, idempotencyKey, "POST");
}

/**
 * Queues an explicit set of recipients for another delivery attempt. The
 * backend treats an omitted `recipient_ids` list as "retry every eligible
 * recipient", so this helper refuses to send a request without an explicit,
 * non-empty selection.
 */
export async function retryRecipients(id: string, recipientIds: string[], idempotencyKey?: string): Promise<RetryOut> {
  if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
    throw new AdminRequestError(
      "A targeted retry requires an explicit list of retry-eligible recipients.",
      400,
      "empty_retry_selection",
    );
  }
  return postMutation<RetryOut>(`admin/communications/${encodeURIComponent(id)}/recipients/retry`, { recipient_ids: recipientIds }, idempotencyKey, "POST");
}
