"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import { sendAdminEmail } from "@/lib/api/email";
import { AdminEmailSendInSchema, type AdminEmailSendIn, type AdminEmailSendOut } from "@/lib/api/email-schemas";
import { IdempotencyKeyLedger, operationFingerprint, SingleFlight } from "@/lib/communications/idempotency";

/**
 * True when a failed send may still have reached the recipient: there was no
 * answer at all, the server or the provider failed after taking the request,
 * a request with this key is still in flight (409), or the answer could not
 * be read. A refusal that says the message was not accepted (a rejected
 * address, a limit, a missing permission) is not one of these.
 */
export function mayHaveBeenSent(error: AdminRequestError): boolean {
  return error.status === 0 || error.status >= 500 || error.status === 409 || error.code === "invalid_response";
}

/**
 * Sends one email. The same message keeps the same idempotency key across
 * retries, so a retry of a send that may have gone out is answered with the
 * first result and never becomes a second email. A different message, or a
 * retry after a refusal that sent nothing, starts a new key.
 *
 * `send` resolves with the result, or undefined when it did not send: the
 * failure is on `error`, and a second call made while one is in flight is
 * ignored (Enter and a click in the same tick would otherwise both start).
 */
export function useSendAdminEmail() {
  const [ledger] = useState(() => new IdempotencyKeyLedger());
  const [flight] = useState(() => new SingleFlight());

  const mutation = useMutation<AdminEmailSendOut, AdminRequestError, AdminEmailSendIn>({
    mutationFn: async (input) => {
      const parsed = AdminEmailSendInSchema.safeParse(input);
      if (!parsed.success) {
        throw new AdminRequestError(parsed.error.issues[0]?.message ?? "Check the message and try again.", 422, "validation_failed");
      }
      const key = ledger.keyFor(operationFingerprint("admin-email-send", parsed.data));
      return sendAdminEmail(parsed.data, key);
    },
  });

  const { mutateAsync, reset } = mutation;
  const send = useCallback(
    async (input: AdminEmailSendIn): Promise<AdminEmailSendOut | undefined> => {
      if (!flight.tryBegin()) return undefined;
      try {
        const result = await mutateAsync(input);
        ledger.reset();
        return result;
      } catch (error) {
        if (error instanceof AdminRequestError && !mayHaveBeenSent(error)) ledger.reset();
        return undefined;
      } finally {
        flight.end();
      }
    },
    [flight, ledger, mutateAsync],
  );

  return { send, isPending: mutation.isPending, error: mutation.error, reset };
}
