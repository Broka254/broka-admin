"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import {
  ProductionCostManualEntrySchema,
  type ProductionCostManualEntry,
  type ProductionCostManualEntryInput,
} from "@/lib/api/schemas";

export function useCreateProductionCostManualEntry() {
  const queryClient = useQueryClient();

  return useMutation<ProductionCostManualEntry, Error, ProductionCostManualEntryInput>({
    mutationFn: async (input) => {
      const response = await fetch("/api/broka/admin/production-costs/manual-entries", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(input),
      });

      const payload = await response.json().catch(() => ({})) as {
        message?: string;
        code?: string;
      };
      if (!response.ok) {
        throw new AdminRequestError(
          payload.message ?? "Unable to save the manual production-cost entry.",
          response.status,
          payload.code,
        );
      }

      return ProductionCostManualEntrySchema.parse(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["broka-admin", "productionCosts"] });
    },
  });
}
