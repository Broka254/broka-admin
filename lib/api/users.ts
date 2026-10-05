import "server-only";

import { getAdminResource, runVerifiedAdminAction } from "@/lib/api/admin";

export const getUsers = (accessToken: string) => getAdminResource("users", accessToken);
export const flagUser = (userId: string, accessToken: string) => runVerifiedAdminAction({ path: "/admin/users/{user_id}/flag", method: "POST" }, userId, accessToken);
export const unflagUser = (userId: string, accessToken: string) => runVerifiedAdminAction({ path: "/admin/users/{user_id}/unflag", method: "POST" }, userId, accessToken);
export const recomputeUserTrust = (userId: string, accessToken: string) => runVerifiedAdminAction({ path: "/admin/users/{user_id}/recompute-trust", method: "POST" }, userId, accessToken);
export const promoteUserToAdmin = (userId: string, accessToken: string) => runVerifiedAdminAction({ path: "/admin/users/{user_id}/promote-admin", method: "POST" }, userId, accessToken);
