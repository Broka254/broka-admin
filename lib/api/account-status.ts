import { useQuery } from "@tanstack/react-query";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import {
  UserModerationSchema,
  AccountStatusStateSchema,
  type AccountStatusChangeIn,
  type AccountStatusState,
  type UserModeration,
} from "@/lib/api/schemas";
import { formatDateTime } from "@/lib/format";

export type AccountChange = "restrict" | "suspend" | "reinstate";
export type SuspensionDuration = "24h" | "7d" | "30d" | "permanent";

export const DURATION_LABELS: Record<SuspensionDuration, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  permanent: "Permanent",
};

/** What the account is allowed to do now, in words an administrator can act on. */
export function statusLabel(state: Pick<AccountStatusState, "status" | "suspended_until">): string {
  if (state.status === "active") return "Active";
  if (state.status === "restricted") return "Restricted: can sign in, cannot transact";
  if (state.suspended_until === null) return "Suspended: permanent";
  return `Suspended until ${formatDateTime(state.suspended_until)}`;
}

/**
 * Whether the form may be sent. The backend re-checks each rule; this keeps an
 * administrator from submitting something it would refuse, and from a
 * destructive change without the typed confirmation.
 */
export function canSubmitAccountChange(input: {
  change: AccountChange;
  duration: SuspensionDuration | null;
  reason: string;
  confirmation: string;
  expectedVersion: number | null;
}): boolean {
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) return false;
  if (input.confirmation !== "CONFIRM") return false;
  if (input.expectedVersion === null || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) return false;
  if (input.change === "suspend" && input.duration === null) return false;
  return true;
}

/** "a, b" or one per line, trimmed, de-duplicated, at most 20 references. */
export function parseEvidenceRefs(raw: string): string[] {
  const refs = raw.split(/[\n,]/).map((part) => part.trim()).filter(Boolean);
  return [...new Set(refs)].slice(0, 20).map((ref) => ref.slice(0, 200));
}

export function useAccountModeration(userId: string, enabled = true) {
  return useQuery<UserModeration>({
    queryKey: ["broka-admin", "userModeration", userId],
    enabled: enabled && Boolean(userId),
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/broka/admin/users/${encodeURIComponent(userId)}/moderation`, {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      if (!response.ok) throw new AdminRequestError(payload.message ?? "Unable to load the account status.", response.status, payload.code);
      return UserModerationSchema.parse(payload);
    },
  });
}

/** Sends one change through the dashboard's server, which allowlists the three changes. */
export async function submitAccountChange(
  change: AccountChange,
  userId: string,
  body: AccountStatusChangeIn,
): Promise<AccountStatusState> {
  const response = await fetch(`/api/broka/users/${encodeURIComponent(userId)}/status/${change}`, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok) {
    throw new AdminRequestError(payload.message ?? "The account change was not applied.", response.status, payload.code);
  }
  return AccountStatusStateSchema.parse(payload);
}
