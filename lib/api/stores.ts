import "server-only";

export const storesAdminContract = {
  availability: "not-documented" as const,
  required: ["GET /admin/stores", "GET /admin/stores/{id}"],
  reason: "The inspected API exposes public and owner-scoped store routes, not an admin store-management contract.",
};
