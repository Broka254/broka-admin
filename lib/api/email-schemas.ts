import { z } from "zod";

// Email Reply (POST /admin/email/send). These rules are the BROKA API's own
// (api/core/email.py in the backend): a value this file accepts the backend
// accepts too, so a request that passes here is not refused there for its
// shape. Lengths count UTF-16 units, the backend's count code points, so the
// dashboard is the stricter of the two for an emoji and never the looser.
//
// The request names no sender, Reply-To or HTML, and `.strict()` refuses any
// that a caller adds: the sender is the backend's setting, and the message
// goes out as the plain text written here.

export const EMAIL_RECIPIENT_MAX = 254;
export const EMAIL_SUBJECT_MAX = 200;
export const EMAIL_MESSAGE_MAX = 10_000;

// One plain ASCII address and nothing else: no display name, no list, no
// quoted or bracketed form. Anything the provider could read as a second
// recipient would turn a reply to one person into a mailing.
const ADDRESS_ATOM = "[A-Za-z0-9_+'-]+";
const ADDRESS_LABEL = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?";
const ADDRESS_PATTERN = new RegExp(`^${ADDRESS_ATOM}(?:\\.${ADDRESS_ATOM})*@(?:${ADDRESS_LABEL}\\.)+[A-Za-z]{2,63}$`);
const LOCAL_PART_MAX = 64;

// A subject is one line. A message may break lines and indent, but carries no
// other control characters.
const SUBJECT_CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/;
const MESSAGE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function isValidRecipient(value: string): boolean {
  return value.length <= EMAIL_RECIPIENT_MAX && ADDRESS_PATTERN.test(value) && value.indexOf("@") <= LOCAL_PART_MAX;
}

export const AdminEmailSendInSchema = z.object({
  to: z.string().trim()
    .min(1, "Enter the recipient's email address")
    .max(EMAIL_RECIPIENT_MAX, `The address can be at most ${EMAIL_RECIPIENT_MAX} characters`)
    .refine(isValidRecipient, "Enter a valid email address, such as name@example.com"),
  subject: z.string().trim()
    .min(1, "Enter a subject")
    .max(EMAIL_SUBJECT_MAX, `The subject can be at most ${EMAIL_SUBJECT_MAX} characters`)
    .refine((value) => !SUBJECT_CONTROL.test(value), "The subject must be a single line"),
  message: z.string().trim()
    .min(1, "Write a message")
    .max(EMAIL_MESSAGE_MAX, `The message can be at most ${EMAIL_MESSAGE_MAX.toLocaleString("en-US")} characters`)
    .refine((value) => !MESSAGE_CONTROL.test(value), "The message contains characters that cannot be sent"),
}).strict();
export type AdminEmailSendIn = z.infer<typeof AdminEmailSendInSchema>;

// What the backend answers once the provider has accepted the message. Extra
// fields are tolerated (a new one must not turn a message that WAS sent into
// an error on screen); a missing or mistyped one is not.
export const AdminEmailSendOutSchema = z.object({
  status: z.literal("sent"),
  message_id: z.string().min(1),
  sender: z.string().min(1),
  reply_to: z.string().min(1),
});
export type AdminEmailSendOut = z.infer<typeof AdminEmailSendOutSchema>;

// The codes the backend gives its failures. The proxy relays the fixed
// message that goes with one of these - and only these - even for a 5xx,
// whose bodies it otherwise never passes on. The text is the backend's; the
// provider's own error text, which can echo the recipient, is never part of it.
export const EMAIL_ERROR_CODES = [
  "email_not_configured",
  "email_rejected",
  "email_sender_refused",
  "email_duplicate_request",
  "email_provider_limit",
  "email_provider_unavailable",
] as const;
export type EmailErrorCode = (typeof EMAIL_ERROR_CODES)[number];
