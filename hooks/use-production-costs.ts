"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import {
  ProductionCostEntryMutationResponseSchema,
  type ProductionCostEntryInput,
  type ProductionCostEntry,
} from "@/lib/api/schemas";

export type CreateProductionCostEntryVariables = { input: ProductionCostEntryInput };

export function useCreateProductionCostEntry() {
  const queryClient = useQueryClient();

  return useMutation<ProductionCostEntry, Error, CreateProductionCostEntryVariables>({
    mutationFn: async ({ input }) => {
      const response = await fetch("/api/broka/admin/revenue/costs/entries", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string; code?: string };
      if (!response.ok) {
        throw new AdminRequestError(
          payload.message ?? "Unable to save the production-cost entry.",
          response.status,
          payload.code,
        );
      }
      return ProductionCostEntryMutationResponseSchema.parse(payload).entry;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["broka-admin", "productionCosts"] }),
        queryClient.invalidateQueries({ queryKey: ["broka-admin", "productionCostEntries"] }),
        queryClient.invalidateQueries({ queryKey: ["broka-admin", "productionCostAdjustments"] }),
      ]);
    },
  });
}
