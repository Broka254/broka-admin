import "server-only";

import { getAdminResource } from "@/lib/api/admin";

export const getEventMetrics = (accessToken: string) => getAdminResource("eventMetrics", accessToken);
export const analyticsContract = {
  availability: "not-documented" as const,
  reason: "The event-metrics route has an empty success schema and does not document period or metric definitions.",
};
