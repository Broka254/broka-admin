import { describe, expect, it } from "vitest";

import { isSafeAdminPath, resourceForPath } from "@/lib/api/admin";
import { MarketAnomalySchema, MarketScanResultSchema } from "@/lib/api/market-schemas";

const anomaly = {
  metric: "registrations", label: "New registrations", date: "2026-11-10", direction: "drop", observed: 0,
  baseline: { method: "same-weekday median / MAD", weeks: 6, median: 10, mad: 0, scale: 1, values: [{ date: "2026-11-03", value: 10 }] },
  deviation: { absolute: -10, pct: -100, z_score: -10 },
  impact: "10 fewer than the typical Tuesday",
  evidence: { source: "users.created_at", observed_day: { date: "2026-11-10", value: 0 }, baseline_days: [{ date: "2026-11-03", value: 10 }] },
  suggested_action: "Check the sign-up flow.", severity: "high", auto_action: "none: BROKA never suspends or changes an account from an anomaly.",
};

describe("market intelligence contracts", () => {
  it("accepts an anomaly that carries baseline, deviation, impact, evidence and action", () => {
    expect(MarketAnomalySchema.parse(anomaly).deviation.z_score).toBe(-10);
  });

  it("rejects an anomaly with no evidence", () => {
    expect(MarketAnomalySchema.safeParse({ ...anomaly, evidence: undefined }).success).toBe(false);
  });

  it("validates the scan result", () => {
    expect(MarketScanResultSchema.parse({ evaluated_day: "2026-11-10", anomalies: 1, alerts_created: 1, alerts_existing: 0 }).alerts_created).toBe(1);
  });

  it("allowlists the market endpoints and the listing drill-down", () => {
    for (const path of ["rankings", "performance", "anomalies", "models"]) {
      expect(isSafeAdminPath(`admin/intelligence/market/${path}`)).toBe(true);
    }
    expect(resourceForPath("/admin/intelligence/market/listings/abc-123")).toBe("marketListingDetail");
    expect(isSafeAdminPath("admin/intelligence/market/listings/..")).toBe(false);
  });
});
