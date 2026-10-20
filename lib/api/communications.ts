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

async function postMutation<T>(path: string, body?: unknown, idempotencyKey?: string, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const response = await fetch(`/api/broka/${path}`, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
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

export async function previewAudience(audience: AudienceIn): Promise<AudiencePreviewOut> {
  return postMutation<AudiencePreviewOut>("admin/communications/preview", { audience });
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

export async function retryRecipients(id: string, recipientIds?: string[], idempotencyKey?: string): Promise<RetryOut> {
  return postMutation<RetryOut>(`admin/communications/${encodeURIComponent(id)}/recipients/retry`, { recipient_ids: recipientIds }, idempotencyKey, "POST");
}
