"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import {
  ProductionCostEntryInSchema,
  ProductionCostEntryMutationResponseSchema,
  ProductionCostEntryPatchSchema,
  ProductionCostPricingInSchema,
  ProductionCostPricingMutationResponseSchema,
  ProductionCostPricingPatchSchema,
  type ProductionCostEntryInput,
  type ProductionCostEntryPatch,
} from "@/lib/api/schemas";

async function sendCostMutation<T>(
  path: string,
  method: "POST" | "PATCH",
  input: unknown,
  schema: { parse(value: unknown): T },
  fallback: string,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({})) as {
    message?: string;
    detail?: string;
    code?: string;
  };
  if (!response.ok) {
    throw new AdminRequestError(
      payload.detail ?? payload.message ?? fallback,
      response.status,
      payload.code,
    );
  }
  return schema.parse(payload);
}

function invalidateCostResources(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    "productionCosts",
    "productionCostSummary",
    "productionCostUsage",
    "productionCostEntries",
    "productionCostAdjustments",
    "productionCostPricing",
  ].map((resource) =>
    queryClient.invalidateQueries({ queryKey: ["broka-admin", resource] })
  ));
}

export function useCreateProductionCostEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { input: ProductionCostEntryInput }) => {
      const input = ProductionCostEntryInSchema.parse(variables.input);
      return sendCostMutation(
        "/api/broka/admin/revenue/costs/entries",
        "POST",
        input,
        ProductionCostEntryMutationResponseSchema,
        "Unable to save the production-cost entry.",
      );
    },
    onSuccess: () => invalidateCostResources(queryClient),
  });
}

export function useUpdateProductionCostEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { entryId: number; input: ProductionCostEntryPatch }) => {
      const input = ProductionCostEntryPatchSchema.parse(variables.input);
      return sendCostMutation(
        "/api/broka/admin/revenue/costs/entries/" + encodeURIComponent(String(variables.entryId)),
        "PATCH",
        input,
        ProductionCostEntryMutationResponseSchema,
        "Unable to update the production-cost entry.",
      );
    },
    onSuccess: () => invalidateCostResources(queryClient),
  });
}

export function useCreateProductionCostPricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: unknown) => {
      const validated = ProductionCostPricingInSchema.parse(input);
      return sendCostMutation(
        "/api/broka/admin/revenue/costs/pricing",
        "POST",
        validated,
        ProductionCostPricingMutationResponseSchema,
        "Unable to create a service price.",
      );
    },
    onSuccess: () => invalidateCostResources(queryClient),
  });
}

export function useUpdateProductionCostPricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { pricingId: number; input: unknown }) => {
      const validated = ProductionCostPricingPatchSchema.parse(variables.input);
      return sendCostMutation(
        "/api/broka/admin/revenue/costs/pricing/" + encodeURIComponent(String(variables.pricingId)),
        "PATCH",
        validated,
        ProductionCostPricingMutationResponseSchema,
        "Unable to update a service price.",
      );
    },
    onSuccess: () => invalidateCostResources(queryClient),
  });
}
