import { useQuery } from "@tanstack/react-query";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import type { ActivityUserRow } from "@/lib/api/schemas";

/**
 * One page of the account activity table. The filtered total comes from the
 * X-Total-Count header; when it is absent the total is null, and the view says
 * so rather than substituting the page length.
 */
export function useActivityUsers(query: URLSearchParams, enabled = true) {
  return useQuery<{ rows: ActivityUserRow[]; total: number | null }>({
    queryKey: ["broka-admin", "activity-users", query.toString()],
    enabled,
    queryFn: async ({ signal }) => {
      const search = query.toString();
      const response = await fetch(`/api/broka/admin/activity/users${search ? `?${search}` : ""}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string } | ActivityUserRow[];
      if (!response.ok) {
        const failure = Array.isArray(payload) ? {} : payload;
        throw new AdminRequestError(failure.message ?? "Unable to load BROKA data.", response.status, failure.code);
      }
      const rawTotal = response.headers.get("X-Total-Count")?.trim();
      const total = rawTotal && /^\d+$/.test(rawTotal) ? Number(rawTotal) : null;
      return {
        rows: payload as ActivityUserRow[],
        total: total !== null && Number.isSafeInteger(total) ? total : null,
      };
    },
  });
}
