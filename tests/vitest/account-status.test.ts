import { describe, expect, it } from "vitest";

import { canSubmitAccountChange, parseEvidenceRefs, statusLabel } from "@/lib/api/account-status";
import { AccountStatusChangeInSchema, UserModerationSchema, AdminResourceSchemas } from "@/lib/api/schemas";

const base = {
  change: "suspend" as const,
  duration: "7d" as const,
  reason: "Repeated chargebacks",
  confirmation: "CONFIRM",
  expectedVersion: 4,
};

describe("account status rules", () => {
  it("names each state in words an administrator can act on", () => {
    expect(statusLabel({ status: "active", suspended_until: null })).toBe("Active");
    expect(statusLabel({ status: "restricted", suspended_until: null })).toMatch(/cannot transact/);
    expect(statusLabel({ status: "suspended", suspended_until: null })).toBe("Suspended: permanent");
    expect(statusLabel({ status: "suspended", suspended_until: "2026-12-01T00:00:00Z" })).toMatch(/^Suspended until /);
  });

  it("sends a change only with a reason, the typed confirmation and a version", () => {
    expect(canSubmitAccountChange(base)).toBe(true);
    expect(canSubmitAccountChange({ ...base, reason: "  ab  " })).toBe(false);
    expect(canSubmitAccountChange({ ...base, confirmation: "confirm" })).toBe(false);
    expect(canSubmitAccountChange({ ...base, expectedVersion: null })).toBe(false);
    expect(canSubmitAccountChange({ ...base, expectedVersion: -1 })).toBe(false);
  });

  it("needs a duration to suspend, and none for the other changes", () => {
    expect(canSubmitAccountChange({ ...base, duration: null })).toBe(false);
    expect(canSubmitAccountChange({ ...base, change: "restrict", duration: null })).toBe(true);
    expect(canSubmitAccountChange({ ...base, change: "reinstate", duration: null })).toBe(true);
  });

  it("parses evidence references by comma or line, without duplicates", () => {
    expect(parseEvidenceRefs("case 1, case 2\ncase 1,  ")).toEqual(["case 1", "case 2"]);
    expect(parseEvidenceRefs("")).toEqual([]);
  });
});

describe("account status contracts", () => {
  it("accepts only the fields the backend's change endpoints take", () => {
    expect(AccountStatusChangeInSchema.safeParse({
      reason: "Repeated chargebacks", expected_version: 2, duration: "24h", evidence_refs: ["case 1"],
    }).success).toBe(true);
    // A field the backend does not take is refused here, not forwarded.
    expect(AccountStatusChangeInSchema.safeParse({
      reason: "Repeated chargebacks", expected_version: 2, role: "admin",
    }).success).toBe(false);
    expect(AccountStatusChangeInSchema.safeParse({
      reason: "Repeated chargebacks", expected_version: 2, duration: "forever",
    }).success).toBe(false);
  });

  it("parses the moderation history and is registered with the proxy", () => {
    const parsed = UserModerationSchema.parse({
      user_id: "u1",
      status: "suspended",
      suspended_until: null,
      status_reason: "Repeated chargebacks",
      status_changed_at: "2026-11-20T10:00:00Z",
      status_changed_by: "admin-1",
      status_version: 2,
      history: [{
        id: "e1", action: "suspended", from_status: "active", to_status: "suspended", suspended_until: null,
        reason: "Repeated chargebacks", notes: null, evidence_refs: '["case 1"]', actor_id: "admin-1",
        request_id: null, created_at: "2026-11-20T10:00:00Z",
      }],
    });
    expect(parsed.history[0].actor_id).toBe("admin-1");
    expect(AdminResourceSchemas.userModeration).toBe(UserModerationSchema);
  });
});
