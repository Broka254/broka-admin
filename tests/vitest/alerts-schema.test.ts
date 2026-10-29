import { describe, expect, it } from "vitest";

import {
  AlertListResponseSchema,
  AlertSchema,
  RevenueResponseSchema,
  TimeseriesResponseSchema,
} from "@/lib/api/schemas";

const validAlert = {
  id: 101,
  kind: "escrow_payout_failed",
  severity: "critical",
  title: "Escrow payout failed",
  body: "E-Confirm reported a failed payout.",
  href: "/finance-integrity",
  status: "open",
  created_at: "2026-10-29T10:00:00.000Z",
  acknowledged_at: null,
  acknowledged_by: null,
  resolved_at: null,
  meta: { deal_id: "deal-1" },
};

describe("AlertSchema", () => {
  it("parses a valid alert", () => {
    expect(AlertSchema.parse(validAlert)).toMatchObject({ id: 101, severity: "critical", status: "open" });
  });

  it("rejects an unknown severity", () => {
    expect(() => AlertSchema.parse({ ...validAlert, severity: "urgent" })).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() => AlertSchema.parse({ ...validAlert, status: "snoozed" })).toThrow();
  });

  it("rejects a missing id", () => {
    const { id: _dropped, ...rest } = validAlert;
    expect(_dropped).toBe(101);
    expect(() => AlertSchema.parse(rest)).toThrow();
  });
});

describe("AlertListResponseSchema", () => {
  it("parses a valid list response", () => {
    const parsed = AlertListResponseSchema.parse({ items: [validAlert], total: 1, unread: 1 });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.unread).toBe(1);
  });

  it("rejects a negative unread count", () => {
    expect(() => AlertListResponseSchema.parse({ items: [], total: 0, unread: -1 })).toThrow();
  });
});

describe("RevenueResponseSchema (proxy registration)", () => {
  const validRevenue = {
    currency: "KES",
    from: "2026-09-29",
    to: "2026-10-29",
    bucket: "day",
    income: { total_minor: 100, streams: [{ key: "fees", label: "Fees", amount_minor: 100, count: 1 }] },
    costs: { total_minor: 10, estimated_minor: 0, kinds: [{ key: "infra", label: "Infra", amount_minor: 10, count: 1, estimated: false }] },
    profit_minor: 90,
    margin_pct: 90,
    series: [{ bucket_start: "2026-10-28T00:00:00.000Z", income_minor: 100, costs_minor: 10, profit_minor: 90 }],
    notes: [],
  };

  it("parses a valid revenue payload", () => {
    expect(RevenueResponseSchema.parse(validRevenue)).toMatchObject({ profit_minor: 90 });
  });

  it("rejects an unknown bucket", () => {
    expect(() => RevenueResponseSchema.parse({ ...validRevenue, bucket: "hour" })).toThrow();
  });
});

describe("TimeseriesResponseSchema (proxy registration)", () => {
  const valid = {
    from: "2026-09-29",
    to: "2026-10-29",
    bucket: "day",
    series: { signups: [{ t: "2026-10-28T00:00:00.000Z", v: 3 }] },
  };

  it("parses varying series keys", () => {
    const parsed = TimeseriesResponseSchema.parse(valid);
    expect(parsed.series.signups).toHaveLength(1);
  });

  it("rejects non-numeric values", () => {
    expect(() =>
      TimeseriesResponseSchema.parse({ ...valid, series: { signups: [{ t: "x", v: "3" }] } }),
    ).toThrow();
  });
});
