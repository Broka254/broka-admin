import "server-only";

import { getAdminResource } from "@/lib/api/admin";

export const getEventCatalog = (accessToken: string) => getAdminResource("eventCatalog", accessToken);
export const getEventMetrics = (accessToken: string) => getAdminResource("eventMetrics", accessToken);
