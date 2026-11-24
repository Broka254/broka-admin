"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import { MarketListingDetailSchema, MarketScanResultSchema, type MarketListingDetail, type MarketScanResult } from "@/lib/api/market-schemas";

async function readError(response: Response, fallback: string): Promise<AdminRequestError> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  return new AdminRequestError(payload.message ?? fallback, response.status, payload.code);
}

/** One listing's funnel, daily series and category position. */
export function useMarketListing(listingId: string | null, windowDays: number) {
  return useQuery<MarketListingDetail>({
    queryKey: ["broka-admin", "marketListingDetail", listingId, windowDays],
    enabled: Boolean(listingId),
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/broka/admin/intelligence/market/listings/${encodeURIComponent(listingId ?? "")}?window_days=${windowDays}`, {
        credentials: "same-origin", cache: "no-store", signal,
      });
      if (!response.ok) throw await readError(response, "Unable to load listing analytics.");
      return MarketListingDetailSchema.parse(await response.json());
    },
  });
}

/** Run the anomaly scan. It only raises deduplicated alerts. */
export function useAnomalyScan() {
  const queryClient = useQueryClient();
  return useMutation<MarketScanResult, AdminRequestError, void>({
    mutationFn: async () => {
      const response = await fetch("/api/broka/admin/intelligence/market/anomalies/scan", {
        method: "POST", credentials: "same-origin",
      });
      if (!response.ok) throw await readError(response, "The anomaly scan could not run.");
      return MarketScanResultSchema.parse(await response.json());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["broka-admin", "alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["broka-admin", "marketAnomalies"] });
    },
  });
}
