import { describe, expect, it } from "vitest";

import {
  RevenueResponseSchema,
  TimeseriesResponseSchema,
  buildRevenueQuery,
} from "@/lib/api/revenue";

const validRevenue = {
  currency: "KES",
  from: "2026-09-29",
  to: "2026-10-29",
  bucket: "day",
  income: {
    total_minor: 1234500,
    streams: [{ key: "fees", label: "Transaction fees", amount_minor: 1000000, count: 42 }],
  },
  costs: {
    total_minor: 234500,
    estimated_minor: 50000,
    kinds: [{ key: "infra", label: "Infrastructure", amount_minor: 234500, count: 7, estimated: true }],
  },
  profit_minor: 1000000,
  margin_pct: 81.0,
  series: [{ bucket_start: "2026-10-28T00:00:00.000Z", income_minor: 50000, costs_minor: 10000, profit_minor: 40000 }],
  notes: ["Costs include estimated infrastructure spend."],
};

describe("RevenueResponseSchema", () => {
  it("parses a valid payload", () => {
    const parsed = RevenueResponseSchema.parse(validRevenue);
    expect(parsed.income.streams).toHaveLength(1);
    expect(parsed.costs.kinds[0].estimated).toBe(true);
  });

  it("accepts empty series and streams", () => {
    const parsed = RevenueResponseSchema.parse({
      ...validRevenue,
      income: { total_minor: 0, streams: [] },
      costs: { total_minor: 0, estimated_minor: 0, kinds: [] },
      series: [],
      notes: [],
    });
    expect(parsed.series).toEqual([]);
    expect(parsed.notes).toEqual([]);
  });

  it("rejects invalid payloads", () => {
    expect(() =>
      RevenueResponseSchema.parse({ ...validRevenue, income: { total_minor: "lots" } }),
    ).toThrow();
    expect(() => RevenueResponseSchema.parse({ ...validRevenue, bucket: "year" })).toThrow();
    expect(() =>
      RevenueResponseSchema.parse({
        ...validRevenue,
        costs: { total_minor: 1, estimated_minor: 0, kinds: [{ key: "x" }] },
      }),
    ).toThrow();
  });

  it("builds the expected query string", () => {
    const params = buildRevenueQuery({ from: "2026-09-29", to: "2026-10-29", bucket: "week" });
    expect(params.toString()).toBe("from=2026-09-29&to=2026-10-29&bucket=week");
  });
});

describe("TimeseriesResponseSchema", () => {
  it("parses variable series keys", () => {
    const parsed = TimeseriesResponseSchema.parse({
      from: "2026-09-29",
      to: "2026-10-29",
      bucket: "day",
      series: {
        signups: [{ t: "2026-10-28T00:00:00.000Z", v: 12 }],
        gmv_minor: [{ t: "2026-10-28T00:00:00.000Z", v: 500000 }],
      },
    });
    expect(Object.keys(parsed.series)).toEqual(["signups", "gmv_minor"]);
  });

  it("accepts an empty series map", () => {
    const parsed = TimeseriesResponseSchema.parse({
      from: "2026-09-29",
      to: "2026-10-29",
      bucket: "month",
      series: {},
    });
    expect(parsed.series).toEqual({});
  });

  it("rejects malformed points", () => {
    expect(() =>
      TimeseriesResponseSchema.parse({
        from: "x",
        to: "y",
        bucket: "day",
        series: { signups: [{ t: "2026-10-28", v: "many" }] },
      }),
    ).toThrow();
  });
});
