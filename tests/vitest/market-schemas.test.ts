import { describe, expect, it } from "vitest";

import { isSafeAdminPath, resourceForPath } from "@/lib/api/admin";
import {
  MarketAnomalySchema, MarketDemandSchema, MarketListingDetailSchema, MarketPerformanceSchema, MarketRankingsSchema,
  MarketScanResultSchema,
} from "@/lib/api/market-schemas";
import { parseAdminResource } from "@/lib/api/schemas";
import {
  demandFixture, legacyPerformanceFixture, legacyRankingsFixture, listingDetailFixture, performanceFixture, rankingsFixture,
} from "./fixtures/market";

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
    for (const path of ["rankings", "performance", "demand", "anomalies", "models"]) {
      expect(isSafeAdminPath(`admin/intelligence/market/${path}`)).toBe(true);
    }
    expect(resourceForPath("/admin/intelligence/market/demand")).toBe("marketDemand");
    expect(resourceForPath("/admin/intelligence/market/listings/abc-123")).toBe("marketListingDetail");
    expect(isSafeAdminPath("admin/intelligence/market/listings/..")).toBe(false);
  });
});

describe("rankings contract", () => {
  it("keeps every stage, ranking and attention list the API sends", () => {
    const parsed = parseAdminResource("marketRankings", rankingsFixture);
    expect(parsed.formula).toContain("6 x negotiators");
    expect(parsed.weights?.deals).toBe(10);
    expect(parsed.rankings.negotiated?.[0].negotiators).toBe(3);
    expect(parsed.rankings.converted?.[0].deal_buyers).toBe(1);
    expect(parsed.rankings.growing).toEqual([]);
    expect(parsed.rankings.viewed[0].breakdown?.negotiations).toBe(12);
    expect(parsed.conversion.engaged_not_converting?.[0].name).toBe("Stalled sofa");
    expect(parsed.attention?.needs_seller[0].waiting_buyers).toBe(2);
    expect(parsed.attention?.losing_attention[0].delta).toBe(-20);
  });

  it("reads an API from before the negotiation stage, leaving what it never sent undefined", () => {
    const parsed = MarketRankingsSchema.parse(legacyRankingsFixture);
    // Undefined, not []: the view says "needs the upgraded API" instead of
    // claiming nothing was negotiated.
    expect(parsed.rankings.negotiated).toBeUndefined();
    expect(parsed.rankings.converted).toBeUndefined();
    expect(parsed.conversion.engaged_not_converting).toBeUndefined();
    expect(parsed.attention).toBeUndefined();
    expect(parsed.rankings.viewed[0].negotiators).toBeUndefined();
    expect(parsed.formula).toBeUndefined();
  });

  it("rejects a ranking row without its listing id", () => {
    const broken = { ...rankingsFixture, rankings: { ...rankingsFixture.rankings, viewed: [{ ...rankingsFixture.rankings.viewed[0], listing_id: undefined }] } };
    expect(MarketRankingsSchema.safeParse(broken).success).toBe(false);
  });
});

describe("performance contract", () => {
  it("keeps the buyer funnel, completed deals and seller reply times", () => {
    const parsed = MarketPerformanceSchema.parse(performanceFixture);
    expect(parsed.buyer_funnel?.map((step) => step.key)).toEqual(["viewed", "saved_or_liked", "contacted", "negotiated", "deal_agreed", "deal_completed"]);
    expect(parsed.sellers.top[0].avg_first_reply_minutes).toBe(42);
    expect(parsed.sellers.top[0].contacters_change_pct).toBe(150);
    expect(parsed.buyers.top[0].deals_completed).toBe(1);
    expect(parsed.not_instrumented?.[0].metric).toBe("searches");
  });

  it("reads the older performance payload", () => {
    const parsed = MarketPerformanceSchema.parse(legacyPerformanceFixture);
    expect(parsed.buyer_funnel).toBeUndefined();
    expect(parsed.sellers.top[0].negotiators).toBeUndefined();
  });

  it("accepts a seller with too few conversations to time replies", () => {
    const seller = { ...performanceFixture.sellers.top[0], avg_first_reply_minutes: null };
    const parsed = MarketPerformanceSchema.parse({ ...performanceFixture, sellers: { total: 1, top: [seller] } });
    expect(parsed.sellers.top[0].avg_first_reply_minutes).toBeNull();
  });
});

describe("demand contract", () => {
  it("validates demand and supply against the window before", () => {
    const parsed = parseAdminResource("marketDemand", demandFixture);
    expect(parsed.categories[0].demand_previous).toBe(6);
    expect(parsed.categories[1].signal).toBe("inactive");
    expect(parsed.categories[1].demand_per_listing).toBeNull();
    expect(parsed.growth).toEqual({ rising: ["Phones"], falling: ["Furniture"] });
    expect(parsed.counties[0].buyer_threads_change_pct).toBe(100);
  });

  it("rejects demand without its growth summary", () => {
    expect(MarketDemandSchema.safeParse({ ...demandFixture, growth: undefined }).success).toBe(false);
  });

  it("rejects a negative count", () => {
    const counties = [{ ...demandFixture.counties[0], buyer_threads: -1 }];
    expect(MarketDemandSchema.safeParse({ ...demandFixture, counties }).success).toBe(false);
  });
});

describe("listing detail contract", () => {
  it("keeps the negotiation and completion stages", () => {
    const parsed = MarketListingDetailSchema.parse(listingDetailFixture());
    expect(parsed.funnel.negotiators).toBe(2);
    expect(parsed.funnel.deals_completed).toBe(1);
    expect(parsed.listing.seller_name).toBe("Amina Stores");
    expect(parsed.daily[2].completed).toBe(1);
  });

  it("reads a detail from before them", () => {
    const parsed = MarketListingDetailSchema.parse(listingDetailFixture({
      funnel: { viewers: 12, savers_or_likers: 4, contacters: 5, deals_agreed: 1 },
      daily: [{ date: "2026-11-24", views: 4, saves: 1, likes: 0, contacts: 2 }],
    }));
    expect(parsed.funnel.negotiators).toBeUndefined();
    expect(parsed.daily[0].negotiations).toBeUndefined();
  });
});
