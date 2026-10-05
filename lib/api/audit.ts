import "server-only";

import { getAdminResource } from "@/lib/api/admin";

export const getAuditLogs = (accessToken: string) => getAdminResource("auditLogs", accessToken);
