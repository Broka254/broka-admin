import "server-only";

import { getAdminResource } from "@/lib/api/admin";

export const getFraudEvents = (accessToken: string) => getAdminResource("fraudEvents", accessToken);
