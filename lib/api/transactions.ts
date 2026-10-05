import "server-only";

import { getAdminResource } from "@/lib/api/admin";

export const getTransactions = (accessToken: string) => getAdminResource("transactions", accessToken);
