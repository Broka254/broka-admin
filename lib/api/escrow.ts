import "server-only";

export const escrowAdminContract = {
  availability: "not-documented" as const,
  required: ["GET /admin/escrow", "GET /admin/escrow/{id}", "POST /admin/escrow/{id}/release"],
  reason: "The inspected API exposes per-deal escrow state only; it does not publish an admin list, totals, or auditable intervention surface.",
};
