import type { RecipientOut } from "@/lib/api/schemas";

export function isRetryEligible(recipient: Pick<RecipientOut, "retry_eligible">): boolean {
  return recipient.retry_eligible === true;
}

export function eligibleRecipientIds(recipients: Array<Pick<RecipientOut, "id" | "retry_eligible">>): string[] {
  return recipients.filter(isRetryEligible).map((recipient) => recipient.id);
}

export function toggleRetrySelection(
  selected: string[],
  recipient: Pick<RecipientOut, "id" | "retry_eligible">,
): string[] {
  if (!isRetryEligible(recipient)) return selected;
  return selected.includes(recipient.id)
    ? selected.filter((id) => id !== recipient.id)
    : [...selected, recipient.id];
}

export function recipientStatusLabel(status: RecipientOut["status"]): string {
  switch (status) {
    case "delivered":
      return "In-app available / device unverified";
    case "provider_accepted":
      return "Provider accepted";
    default:
      return status.replaceAll("_", " ");
  }
}

