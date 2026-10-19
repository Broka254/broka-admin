import "server-only";

export const escrowAdminContract = {
  availability: "available" as const,
  verified: ["GET /admin/finance-integrity", "GET /admin/payments", "GET /admin/deals/{id}"],
  reason: "Escrow and payment state are exposed read-only via finance integrity, normalized payments and deal detail. No admin release/refund mutation is exposed: money movement remains with the escrow engine.",
};
