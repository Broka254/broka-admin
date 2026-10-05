import "server-only";

export const dealsAdminContract = {
  availability: "not-documented" as const,
  required: ["GET /admin/deals", "GET /admin/deals/{id}"],
  reason: "The inspected API exposes authenticated party-scoped deal routes, not an admin operations queue.",
};
