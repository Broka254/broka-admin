import "server-only";

import { getAdminResource, runVerifiedAdminAction, USER_ACTIONS } from "@/lib/api/admin";

export const getUsers = (accessToken: string) => getAdminResource("users", accessToken);
export const flagUser = (userId: string, accessToken: string, reason: string, idempotencyKey?: string) =>
  runVerifiedAdminAction(USER_ACTIONS.flag, { user_id: userId }, accessToken, { reason, idempotencyKey });
export const unflagUser = (userId: string, accessToken: string, reason?: string, idempotencyKey?: string) =>
  runVerifiedAdminAction(USER_ACTIONS.unflag, { user_id: userId }, accessToken, { reason, idempotencyKey });
export const recomputeUserTrust = (userId: string, accessToken: string, idempotencyKey?: string) =>
  runVerifiedAdminAction(USER_ACTIONS["recompute-trust"], { user_id: userId }, accessToken, { idempotencyKey });
export const promoteUserToAdmin = (userId: string, accessToken: string, reason: string, idempotencyKey?: string) =>
  runVerifiedAdminAction(USER_ACTIONS["promote-admin"], { user_id: userId }, accessToken, { reason, idempotencyKey });
