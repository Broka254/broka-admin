import type { Metadata } from "next";

import { EmailComposer } from "@/components/email/email-composer";

export const metadata: Metadata = { title: "Email Reply" };

export default function EmailReplyPage() {
  return <EmailComposer />;
}
