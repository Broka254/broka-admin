import { describe, expect, it } from "vitest";

import {
  AdminEmailSendInSchema,
  AdminEmailSendOutSchema,
  EMAIL_ERROR_CODES,
  EMAIL_MESSAGE_MAX,
  EMAIL_SUBJECT_MAX,
  isValidRecipient,
} from "@/lib/api/email-schemas";

// The same cases as the backend's rules for the recipient
// (backend/tests/test_admin_email.py in the BROKA API repository): the two
// sides must agree on what an address is.
const VALID = [
  "a@b.co",
  "first.last@example.com",
  "o'brien@example.co.ke",
  "user+tag@sub.example.org",
  "A_B-C@x-y.example.com",
  `x@${"a".repeat(63)}.com`,
];
const INVALID = [
  "", "no-at-sign", "a@b", "a@b.c", "a@@b.com", "a b@c.com", "a@b .com",
  "a@b.com,c@d.com", "a@b.com;c@d.com", "Name <a@b.com>", "<a@b.com>", '"a b"@c.com',
  "a@b.com\r\nBcc: x@y.com", "a@b\n.com", "a\n@b.com", "a@b.com\u0000",
  ".a@b.com", "a.@b.com", "a..b@c.com", "a@-b.com", "a@b-.com", "a@b..com", "a@b.com.",
  "a@[127.0.0.1]", "a@localhost", "a%b@c.com", "a!b@c.com", "a/b@c.com",
  "\u00fc@example.com", "a@ex\u00e4mple.com",
  `${"x".repeat(65)}@example.com`, `a@${"a".repeat(64)}.com`, `a@b.${"c".repeat(64)}`, `${"a".repeat(250)}@b.com`,
];

const good = { to: "wanjiru@example.com", subject: "Re: your complaint", message: "Hello Wanjiru" };

describe("email recipient rule", () => {
  it.each(VALID)("accepts %s", (address) => expect(isValidRecipient(address)).toBe(true));
  it.each(INVALID)("refuses %j", (address) => expect(isValidRecipient(address)).toBe(false));
});

describe("AdminEmailSendInSchema", () => {
  it("trims the three fields and passes them on unchanged otherwise", () => {
    expect(AdminEmailSendInSchema.parse({ to: "  Wanjiru@Example.com\n", subject: "  Hi  ", message: "  Hello\r\nthere\tfriend  " }))
      .toEqual({ to: "Wanjiru@Example.com", subject: "Hi", message: "Hello\r\nthere\tfriend" });
  });

  it.each(["a@b.com\n", "\n a@b.com", "\ta@b.com \r\n"])("accepts surrounding whitespace around an address (%j)", (to) => {
    expect(AdminEmailSendInSchema.safeParse({ ...good, to }).success).toBe(true);
  });

  it.each([
    [{ to: "" }, "recipient"],
    [{ to: "   " }, "recipient"],
    [{ to: "not-an-address" }, "recipient"],
    [{ to: "a@b.com, c@d.com" }, "two recipients"],
    [{ subject: "" }, "blank subject"],
    [{ subject: "line one\nBcc: x@y.com" }, "a header smuggled through the subject"],
    [{ subject: "a\u2028b" }, "a line separator in the subject"],
    [{ subject: "x".repeat(EMAIL_SUBJECT_MAX + 1) }, "long subject"],
    [{ message: "  \n " }, "blank message"],
    [{ message: "a\u0000b" }, "a NUL byte"],
    [{ message: "x".repeat(EMAIL_MESSAGE_MAX + 1) }, "long message"],
  ])("refuses %j (%s)", (patch) => {
    expect(AdminEmailSendInSchema.safeParse({ ...good, ...patch }).success).toBe(false);
  });

  it("allows a subject and message of exactly the limit, and line breaks and tabs in the message", () => {
    expect(AdminEmailSendInSchema.safeParse({ ...good, subject: "x".repeat(EMAIL_SUBJECT_MAX), message: "x".repeat(EMAIL_MESSAGE_MAX) }).success).toBe(true);
    expect(AdminEmailSendInSchema.safeParse({ ...good, message: "one\n\ttwo\r\nthree" }).success).toBe(true);
  });

  it.each([
    { from: "ceo@broka.co.ke" },
    { sender: "ceo@broka.co.ke" },
    { reply_to: "attacker@example.com" },
    { html: "<script>alert(1)</script>" },
    { cc: "x@y.com" },
    { bcc: "x@y.com" },
    { headers: { "X-Evil": "1" } },
  ])("refuses a request that names %j: the sender and markup are not the browser's to set", (extra) => {
    expect(AdminEmailSendInSchema.safeParse({ ...good, ...extra }).success).toBe(false);
  });

  it.each(["to", "subject", "message"] as const)("requires %s", (field) => {
    const without = Object.fromEntries(Object.entries(good).filter(([key]) => key !== field));
    expect(Object.keys(without)).toHaveLength(2);
    expect(AdminEmailSendInSchema.safeParse(without).success).toBe(false);
  });

  it("never repeats what was typed in its messages", () => {
    const result = AdminEmailSendInSchema.safeParse({ ...good, to: "secret-typed-value" });
    expect(result.success).toBe(false);
    if (!result.success) expect(JSON.stringify(result.error.flatten())).not.toContain("secret-typed-value");
  });
});

describe("AdminEmailSendOutSchema", () => {
  const sent = { status: "sent", message_id: "re_1", sender: "Broka Admin <admin@broka.co.ke>", reply_to: "admin@broka.co.ke" };

  it("accepts the backend's answer and tolerates a field it does not know", () => {
    expect(AdminEmailSendOutSchema.safeParse(sent).success).toBe(true);
    const parsed = AdminEmailSendOutSchema.parse({ ...sent, delivered_at: "later" });
    expect(Object.keys(parsed).sort()).toEqual(["message_id", "reply_to", "sender", "status"]);
  });

  it.each([{ status: "queued" }, { message_id: "" }, { message_id: 3 }, { sender: undefined }, { reply_to: "" }])(
    "refuses an answer that does not confirm a send (%j)",
    (patch) => expect(AdminEmailSendOutSchema.safeParse({ ...sent, ...patch }).success).toBe(false),
  );
});

describe("EMAIL_ERROR_CODES", () => {
  it("lists the codes the backend gives its failures", () => {
    expect([...EMAIL_ERROR_CODES].sort()).toEqual([
      "email_duplicate_request",
      "email_not_configured",
      "email_provider_limit",
      "email_provider_unavailable",
      "email_rejected",
      "email_sender_refused",
    ]);
  });
});
