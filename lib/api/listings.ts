import "server-only";

export const listingsAdminContract = {
  availability: "available" as const,
  verified: ["GET /admin/listings"],
  reason: "Admin listing enumeration with status, category, seller and name filters exists. There is deliberately no admin listing mutation endpoint.",
};
