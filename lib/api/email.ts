import { AdminRequestError } from "@/hooks/use-admin-resource";
import { AdminEmailSendOutSchema, type AdminEmailSendIn, type AdminEmailSendOut } from "@/lib/api/email-schemas";

/**
 * Sends one email from the BROKA admin address through the same-origin proxy.
 *
 * The idempotency key is required: an email cannot be recalled, so the same
 * key must go with every retry of the same message, and a retry after "no
 * answer" is then answered with the first result instead of a second email.
 *
 * A failure with no answer from the server at all (status 0) is the case the
 * caller must treat as "may have been sent".
 */
export async function sendAdminEmail(
  input: AdminEmailSendIn,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminEmailSendOut> {
  let response: Response;
  try {
    response = await fetch("/api/broka/admin/email/send", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminRequestError(
      "The dashboard could not reach the server, so this message may not have been sent. Retrying is safe: the same request is never sent twice.",
      0,
      "network",
    );
  }

  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok) {
    throw new AdminRequestError(
      payload.message ?? "The email could not be sent.",
      response.status,
      payload.code,
    );
  }
  const parsed = AdminEmailSendOutSchema.safeParse(payload);
  if (!parsed.success) {
    // The proxy has already checked this shape, so this is only reachable if
    // it is bypassed. The message may have gone out; say so rather than
    // invent a confirmation.
    throw new AdminRequestError(
      "The server's answer was not understood, so it is not known whether this message was sent. Retrying is safe: the same request is never sent twice.",
      response.status,
      "invalid_response",
    );
  }
  return parsed.data;
}
