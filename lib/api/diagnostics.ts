import "server-only";

import { getAdminResource } from "@/lib/api/admin";

export const getPublicHealth = (accessToken: string) => getAdminResource("health", accessToken);
export const diagnosticsContract = {
  availability: "not-documented" as const,
  reason: "The public health route exists, but a secret-safe admin diagnostics model is not documented.",
};
