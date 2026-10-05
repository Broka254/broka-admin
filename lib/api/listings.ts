import "server-only";

export const listingsAdminContract = {
  availability: "not-documented" as const,
  required: ["GET /admin/listings", "GET /admin/listings/{id}", "PATCH /admin/listings/{id}/status"],
  reason: "The inspected API exposes public and seller-scoped listing routes, not an admin moderation contract.",
};
