import { describe, expect, it } from "vitest";

import { MarketListingRowSchema } from "@/lib/api/market-schemas";
import { toCSV } from "@/lib/csv";
import {
  buildMarketQuery, customRangeError, defaultCustomRange, demandWindowDays, filterOptions, formatScore, isRankingKey,
  rangeDays, rankingCsvFilename, rankingCsvRows, scoreBreakdown, windowLabel,
} from "@/lib/market";
import { legacyRow, listingRow } from "./fixtures/market";

const NOW = Date.parse("2026-11-24T10:00:00Z");

describe("market query", () => {
  it("sends a rolling window as window_days, with the filters", () => {
    expect(buildMarketQuery("7", { from: "", to: "" }, {}, NOW)?.toString()).toBe("window_days=7");
    expect(buildMarketQuery("30", { from: "", to: "" }, { category: "Phones", county: "Nairobi" }, NOW)?.toString())
      .toBe("window_days=30&category=Phones&county=Nairobi");
  });

  it("sends a custom range with the end day included, as the API's exclusive end", () => {
    expect(buildMarketQuery("custom", { from: "2026-11-01", to: "2026-11-07" }, {}, NOW)?.toString()).toBe("from=2026-11-01&to=2026-11-08");
    // Month and year ends roll over.
    expect(buildMarketQuery("custom", { from: "2026-10-31", to: "2026-10-31" }, {}, NOW)?.get("to")).toBe("2026-11-01");
    expect(buildMarketQuery("custom", { from: "2025-12-01", to: "2025-12-31" }, {}, NOW)?.get("to")).toBe("2026-01-01");
  });

  it("requests nothing for an invalid custom range", () => {
    expect(buildMarketQuery("custom", { from: "2026-11-07", to: "2026-11-01" }, {}, NOW)).toBeNull();
    expect(buildMarketQuery("custom", { from: "2026-02-31", to: "2026-03-05" }, {}, NOW)).toBeNull();
    expect(buildMarketQuery("custom", { from: "2026-11-25", to: "2026-11-26" }, {}, NOW)).toBeNull();
  });

  it("allows 90 days and refuses 91", () => {
    expect(customRangeError({ from: "2026-08-27", to: "2026-11-24" }, NOW)).toBeNull();
    expect(rangeDays({ from: "2026-08-27", to: "2026-11-24" })).toBe(90);
    expect(customRangeError({ from: "2026-08-26", to: "2026-11-24" }, NOW)).toBe("A custom range is at most 90 days; this one is 91.");
  });

  it("explains each invalid range", () => {
    expect(customRangeError({ from: "", to: "2026-11-01" }, NOW)).toBe("Choose a start and an end date.");
    expect(customRangeError({ from: "2026-11-07", to: "2026-11-01" }, NOW)).toBe("The end date is before the start date.");
    expect(customRangeError({ from: "2026-11-25", to: "2026-11-30" }, NOW)).toBe("The start date is in the future.");
  });

  it("defaults the custom range to the last 30 UTC days, today included", () => {
    expect(defaultCustomRange(NOW)).toEqual({ from: "2026-10-26", to: "2026-11-24" });
    expect(rangeDays(defaultCustomRange(NOW))).toBe(30);
  });

  it("measures demand over 7 to 180 days ending now", () => {
    expect(demandWindowDays("1", { from: "", to: "" })).toBe(7);
    expect(demandWindowDays("90", { from: "", to: "" })).toBe(90);
    expect(demandWindowDays("custom", { from: "2026-11-01", to: "2026-11-03" })).toBe(7);
    expect(demandWindowDays("custom", { from: "2026-10-01", to: "2026-11-14" })).toBe(45);
    expect(demandWindowDays("custom", { from: "bad", to: "2026-11-14" })).toBe(30);
  });

  it("labels the window", () => {
    expect(windowLabel("1", { from: "", to: "" })).toBe("last 24 hours");
    expect(windowLabel("30", { from: "", to: "" })).toBe("last 30 days");
    expect(windowLabel("custom", { from: "2026-11-01", to: "2026-11-07" })).toBe("2026-11-01 to 2026-11-07 (UTC)");
  });

  it("knows its ranking keys", () => {
    expect(isRankingKey("negotiated")).toBe(true);
    expect(isRankingKey("searched")).toBe(false);
  });
});

describe("filters", () => {
  it("offers each label once, sorted, without the placeholder for an empty value", () => {
    expect(filterOptions(["Phones", "Uncategorised", "Furniture", "Phones", " ", null, undefined, ""], "Uncategorised")).toEqual(["Furniture", "Phones"]);
  });
});

describe("ranking export", () => {
  it("writes one row per listing in rank order", () => {
    const rows = [listingRow("a"), listingRow("b", { viewers: 6, previous_score: 20, delta: 38, growth_pct: 190 })].map((row) => MarketListingRowSchema.parse(row));
    const csv = rankingCsvRows(rows, "trending");
    expect(csv.map((row) => [row.rank, row.listing_id])).toEqual([[1, "a"], [2, "b"]]);
    expect(csv[1]).toMatchObject({ ranking: "trending", viewers: 6, negotiators: 2, deal_buyers: 1, score_change: 38, growth_pct: 190 });
  });

  it("leaves a stage the API did not send empty instead of writing zero", () => {
    const csv = toCSV(rankingCsvRows([MarketListingRowSchema.parse(legacyRow("a"))], "viewed"));
    const [header, line] = csv.split("\n");
    const cells = Object.fromEntries(header.split(",").map((name, index) => [name, line.split(",")[index]]));
    expect(cells.viewers).toBe("10");
    expect(cells.negotiators).toBe("");
    expect(cells.deal_buyers).toBe("");
  });

  it("guards a listing name that a spreadsheet would run as a formula", () => {
    const csv = toCSV(rankingCsvRows([MarketListingRowSchema.parse(listingRow("a", { name: "=HYPERLINK(\"x\")" }))], "viewed"));
    expect(csv).toContain("'=HYPERLINK");
  });

  it("names the file after the ranking and the window", () => {
    expect(rankingCsvFilename("viewed", "7", { from: "", to: "" }, NOW)).toBe("broka-listings-viewed-7d-to-2026-11-24.csv");
    expect(rankingCsvFilename("trending", "1", { from: "", to: "" }, NOW)).toBe("broka-listings-trending-24h-to-2026-11-24.csv");
    expect(rankingCsvFilename("converted", "custom", { from: "2026-11-01", to: "2026-11-07" }, NOW)).toBe("broka-listings-converted-2026-11-01-to-2026-11-07.csv");
  });
});

describe("score", () => {
  it("formats whole and fractional scores", () => {
    expect(formatScore(58)).toBe("58");
    expect(formatScore(7.5)).toBe("7.5");
    expect(formatScore(undefined)).toBe("—");
  });

  it("lists what each stage added, skipping stages that added nothing", () => {
    expect(scoreBreakdown({ views: 10, saves: 0, contacts: 16 })).toBe("views 10 · contacts 16");
    expect(scoreBreakdown(undefined)).toBe("");
  });
});
