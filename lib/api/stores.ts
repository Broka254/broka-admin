import "server-only";

export const storesAdminContract = {
  availability: "available" as const,
  verified: ["GET /admin/stores"],
  reason: "Admin store enumeration with search, county and category filters (soft-deleted excluded by default) exists. No admin store mutation endpoint exists.",
};
