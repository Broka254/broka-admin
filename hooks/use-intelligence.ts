"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { AdminRequestError } from "@/hooks/use-admin-resource";
import { ReportDetailSchema, type ReportDetail, type ReportGenerateIn } from "@/lib/api/intelligence-schemas";

async function readError(response: Response, fallback: string): Promise<AdminRequestError> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  return new AdminRequestError(payload.message ?? fallback, response.status, payload.code);
}

/** Build (or rebuild) the stored report for one closed period. */
export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation<ReportDetail, AdminRequestError, ReportGenerateIn>({
    mutationFn: async (input) => {
      const response = await fetch("/api/broka/admin/reports/generate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "The report could not be generated.");
      return ReportDetailSchema.parse(await response.json());
    },
    onSuccess: (report) => {
      if (report.id) queryClient.setQueryData(["broka-admin", "reportDetail", report.id], report);
      void queryClient.invalidateQueries({ queryKey: ["broka-admin", "reports"] });
    },
  });
}
