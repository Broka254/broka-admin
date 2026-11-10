"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import {
  FeedbackAdminItemSchema,
  FeedbackTriageInSchema,
  type FeedbackAdminItem,
  type FeedbackDetail,
  type FeedbackTriageIn,
} from "@/lib/api/intelligence-schemas";

export const COMPLAINT_QUEUES = ["unanswered", "overdue", "open", "closed", "all"] as const;
export type ComplaintQueue = (typeof COMPLAINT_QUEUES)[number];
export const COMPLAINT_SORTS = ["priority", "newest", "oldest"] as const;
export type ComplaintSort = (typeof COMPLAINT_SORTS)[number];
export const COMPLAINT_PAGE_SIZE = 25;

export type ComplaintFilters = {
  queue?: string | null;
  kind?: string | null;
  category?: string | null;
  severity?: string | null;
  search?: string | null;
  sort?: string | null;
  page?: number;
  userId?: string | null;
  relatedUserId?: string | null;
};

function oneOf<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function complaintQueue(value: string | null | undefined): ComplaintQueue {
  return oneOf(value, COMPLAINT_QUEUES, "unanswered");
}

export function complaintSort(value: string | null | undefined): ComplaintSort {
  return oneOf(value, COMPLAINT_SORTS, "priority");
}

/** Query string for GET /admin/feedback. Unknown values are dropped, not sent. */
export function buildFeedbackParams(filters: ComplaintFilters): URLSearchParams {
  const params = new URLSearchParams();
  const queue = complaintQueue(filters.queue);
  if (queue !== "all") params.set("queue", queue);
  if (filters.kind === "complaint" || filters.kind === "feedback") params.set("kind", filters.kind);
  if (filters.category && /^[a-z_]{2,32}$/.test(filters.category)) params.set("category", filters.category);
  if (filters.severity && ["low", "normal", "high", "urgent"].includes(filters.severity)) params.set("severity", filters.severity);
  const search = filters.search?.trim();
  if (search) params.set("search", search.slice(0, 100));
  if (filters.userId?.trim()) params.set("user_id", filters.userId.trim().slice(0, 64));
  if (filters.relatedUserId?.trim()) params.set("related_user_id", filters.relatedUserId.trim().slice(0, 64));
  params.set("sort", complaintSort(filters.sort));
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  params.set("limit", String(COMPLAINT_PAGE_SIZE));
  params.set("offset", String((page - 1) * COMPLAINT_PAGE_SIZE));
  return params;
}

export type TriageResult = FeedbackAdminItem;

/**
 * Reply to and/or move a submission. The backend pushes the reporter when a
 * reply is written or the case moves to in progress, resolved or closed,
 * and answers with how many devices it reached.
 */
export function useTriageFeedback() {
  const queryClient = useQueryClient();
  return useMutation<TriageResult, AdminRequestError, { id: string; input: FeedbackTriageIn }>({
    mutationFn: async ({ id, input }) => {
      const parsed = FeedbackTriageInSchema.safeParse(input);
      if (!parsed.success) throw new AdminRequestError(parsed.error.issues[0]?.message ?? "Choose a status or write a reply.", 422, "validation_failed");
      const response = await fetch(`/api/broka/admin/feedback/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      if (!response.ok) throw new AdminRequestError(payload.message ?? "The update could not be saved.", response.status, payload.code);
      return FeedbackAdminItemSchema.parse(payload);
    },
    onSuccess: (item) => {
      // The drawer keeps showing the case; merge the new state into it so
      // the reply and status appear without waiting for a refetch.
      queryClient.setQueryData<FeedbackDetail>(["broka-admin", "feedbackDetail", item.id], (old) => (old ? { ...old, ...item } : old));
      for (const key of ["feedback", "feedbackStats", "feedbackDetail", "intelligencePulse", "intelligenceInsights", "alerts", "alerts-unread"]) {
        void queryClient.invalidateQueries({ queryKey: ["broka-admin", key] });
      }
    },
  });
}

/** Ready-made first lines; the administrator edits before sending. */
export const REPLY_TEMPLATES: Array<{ key: string; label: string; status?: "acknowledged" | "in_progress" | "resolved" | "closed"; text: string }> = [
  {
    key: "received",
    label: "We're on it",
    status: "in_progress",
    text: "Thank you for telling us. A member of the BROKA team is looking into this now and will update you here.",
  },
  {
    key: "need-details",
    label: "Need details",
    status: "acknowledged",
    text: "Thank you for reporting this. To help us act quickly, please reply with the listing name or the seller's name, and what happened.",
  },
  {
    key: "seller-contacted",
    label: "Seller contacted",
    status: "in_progress",
    text: "We have contacted the seller about this and asked them to respond. We will let you know what they say.",
  },
  {
    key: "safety",
    label: "Safety first",
    status: "in_progress",
    text: "Your safety comes first. Please do not send money or meet anyone until we confirm. We are reviewing this account now.",
  },
  {
    key: "resolved",
    label: "Resolved",
    status: "resolved",
    text: "This has been resolved. Thank you for helping keep BROKA safe and fair. If anything else goes wrong, tell us here.",
  },
];
