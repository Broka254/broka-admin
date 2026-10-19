import "server-only";

export const dealsAdminContract = {
  availability: "available" as const,
  verified: ["GET /admin/deals", "GET /admin/deals/{id}"],
  reason: "Admin deal queue and detail (ledger entries, escrow payments, dispute cases) are exposed read-only. No admin mutation of deal state exists by design.",
};
