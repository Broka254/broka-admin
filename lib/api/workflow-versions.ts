import "server-only";

import { getAdminResource } from "@/lib/api/admin";

export const getWorkflowVersions = (accessToken: string) => getAdminResource("workflowVersions", accessToken);
