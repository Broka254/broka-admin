import "server-only";

export const disputesAdminContract = {
  availability: "not-documented" as const,
  required: ["GET /admin/disputes", "GET /admin/disputes/{id}", "POST /admin/disputes/{id}/resolve"],
  reason: "The inspected dispute routes are party-scoped and do not document an admin queue, evidence model, or audited resolution path.",
};
