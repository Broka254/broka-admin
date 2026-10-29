"use client";

import { useQuery } from "@tanstack/react-query";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import {
  RevenueResponseSchema,
  TimeseriesResponseSchema,
  buildRevenueQuery,
  type RevenueQuery,
} from "@/lib/api/revenue";

async function fetchAdminPath<T>(path: string, query?: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const suffix = query?.size ? `?${query.toString()}` : "";
  const response = await fetch(`/api/broka/${path}${suffix}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok) throw new AdminRequestError(payload.message ?? "Unable to load BROKA data.", response.status, payload.code);
  return payload as T;
}

export function useRevenue(params: RevenueQuery, enabled = true) {
  const query = buildRevenueQuery(params);
  return useQuery({
    queryKey: ["broka-admin", "revenue", query.toString()],
    enabled,
    queryFn: async ({ signal }) => {
      const raw = await fetchAdminPath<unknown>("admin/revenue", query, signal);
      return RevenueResponseSchema.parse(raw);
    },
  });
}

export function useTimeseries(params: RevenueQuery, enabled = true) {
  const query = buildRevenueQuery(params);
  return useQuery({
    queryKey: ["broka-admin", "analytics-timeseries", query.toString()],
    enabled,
    queryFn: async ({ signal }) => {
      const raw = await fetchAdminPath<unknown>("admin/analytics/timeseries", query, signal);
      return TimeseriesResponseSchema.parse(raw);
    },
  });
}
