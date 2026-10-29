"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import { AlertListResponseSchema, type AlertListResponse } from "@/lib/api/schemas";

export type AlertFilters = {
  status?: string;
  severity?: string;
  kind?: string;
  limit?: number;
  offset?: number;
};

export function buildAlertListParams(filters: AlertFilters = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.severity && filters.severity !== "all") params.set("severity", filters.severity);
  if (filters.kind?.trim()) params.set("kind", filters.kind.trim());
  params.set("limit", String(filters.limit ?? 50));
  params.set("offset", String(filters.offset ?? 0));
  return params;
}

async function fetchAlertList(query: URLSearchParams, signal?: AbortSignal): Promise<AlertListResponse> {
  const response = await fetch(`/api/broka/admin/alerts?${query.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok) throw new AdminRequestError(payload.message ?? "Unable to load alerts.", response.status, payload.code);
  return AlertListResponseSchema.parse(payload);
}

export function useAdminAlerts(filters: AlertFilters = {}, enabled = true) {
  const query = buildAlertListParams(filters);
  return useQuery<AlertListResponse>({
    queryKey: ["broka-admin", "alerts", query.toString()],
    enabled,
    queryFn: ({ signal }) => fetchAlertList(query, signal),
  });
}

export function useUnreadAlerts(enabled = true) {
  const query = buildAlertListParams({ status: "open", limit: 1, offset: 0 });
  return useQuery<number>({
    queryKey: ["broka-admin", "alerts-unread"],
    enabled,
    queryFn: async ({ signal }) => (await fetchAlertList(query, signal)).unread,
  });
}

async function postAlertAction(path: string, body: unknown, idempotencyKey: string) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok) throw new AdminRequestError(payload.message ?? "The alert action could not be completed.", response.status, payload.code);
  return payload;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      postAlertAction(
        `/api/broka/admin/alerts/${encodeURIComponent(id)}/acknowledge`,
        reason?.trim() ? { reason: reason.trim() } : {},
        newIdempotencyKey(),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["broka-admin", "alerts"] });
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      postAlertAction(
        `/api/broka/admin/alerts/${encodeURIComponent(id)}/resolve`,
        undefined,
        newIdempotencyKey(),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["broka-admin", "alerts"] });
    },
  });
}
