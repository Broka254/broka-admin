import "server-only";

export const disputesAdminContract = {
  availability: "available" as const,
  verified: ["GET /admin/disputes"],
  reason: "Admin dispute-case queue with state counts, rule/AI decision fields and deal context exists read-only. Resolution stays with the existing engine; the dashboard does not expose unsafe decide or refund mutations.",
};
