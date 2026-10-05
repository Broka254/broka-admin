import "server-only";

import { getAdminResource } from "@/lib/api/admin";

export const getAiSavings = (accessToken: string) => getAdminResource("aiSavings", accessToken);
export const zenoActivityAdminContract = {
  availability: "not-documented" as const,
  required: ["GET /admin/zeno/activity", "GET /admin/zeno/negotiations"],
  reason: "No admin activity, negotiation, provider, model, latency, error, or fallback response schema is published.",
};
