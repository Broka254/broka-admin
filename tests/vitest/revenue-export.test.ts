import { describe, expect, it } from "vitest";

import { buildRevenueCsvRows } from "@/lib/revenue-export";
import { toCSV } from "@/lib/csv";
import type { RevenueResponse } from "@/lib/api/revenue";

const fixture: RevenueResponse = {
  currency: "KES",
  from: "2026-10-01T00:00:00Z",
  to: "2026-10-31T00:00:00Z",
  bucket: "day",
  income: {
    total_minor: 120000,
    streams: [{ key: "listing_fee", label: "Listing fees", amount_minor: 120000, count: 12 }],
  },
  costs: {
    total_minor: 30000,
    estimated_minor: 5000,
    kinds: [{ key: "sms", label: "SMS", amount_minor: 30000, count: 20, estimated: true }],
  },
  profit_minor: 90000,
  margin_pct: 75,
  series: [{
    bucket_start: "2026-10-01T00:00:00Z",
    income_minor: 120000,
    costs_minor: 30000,
    profit_minor: 90000,
  }],
  notes: ["Some costs are estimated."],
};

describe("buildRevenueCsvRows", () => {
  it("exports summary, every bucket, streams, cost kinds, and finance notes", () => {
    const rows = buildRevenueCsvRows(fixture, {
      from: "2026-10-01",
      to: "2026-10-31",
      bucket: "day",
    });
    expect(rows.map((row) => row.section)).toEqual([
      "summary",
      "summary",
      "time_bucket",
      "income_stream",
      "cost_kind",
      "finance_note",
    ]);
    expect(rows[0].profit_minor).toBe(90000);
    expect(rows[3].amount_minor).toBe(120000);
    expect(rows[4].estimated).toBe(true);
    expect(rows[5].label).toBe("Some costs are estimated.");
  });

  it("keeps monetary values in integer minor units", () => {
    const rows = buildRevenueCsvRows(fixture, {
      from: "2026-10-01",
      to: "2026-10-31",
      bucket: "day",
    });
    expect(rows[0].income_minor).toBe(120000);
    expect(rows[0].costs_minor).toBe(30000);
  });
});

describe("CSV spreadsheet safety", () => {
  it("prefixes formula-like text cells without changing numeric cells", () => {
    const csv = toCSV([
      { label: "=HYPERLINK(\"https://bad.example\",\"click\")", amount_minor: -1200 },
    ]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("-1200");
  });
});
