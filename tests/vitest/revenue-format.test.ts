import { describe, expect, it } from "vitest";

import { downloadCSV, toCSV } from "@/lib/csv";
import { formatCompact, formatDateTime, formatKES, formatPct, formatShortDate } from "@/lib/format";

describe("formatKES", () => {
  it("formats whole shillings without decimals", () => {
    expect(formatKES(1234500)).toBe("KES 12,345");
  });

  it("keeps cents when present and handles negatives", () => {
    expect(formatKES(1234567)).toBe("KES 12,345.67");
    expect(formatKES(-5000)).toBe("-KES 50");
  });

  it("handles zero and non-finite input", () => {
    expect(formatKES(0)).toBe("KES 0");
    expect(formatKES(Number.NaN)).toBe("KES 0");
  });
});

describe("other formatters", () => {
  it("formats percentages with one decimal", () => {
    expect(formatPct(81)).toBe("81.0%");
    expect(formatPct(-4.567)).toBe("-4.6%");
  });

  it("formats compact money for axes", () => {
    expect(formatCompact(1234500)).toContain("KES");
    expect(formatCompact(1234500)).toContain("12");
  });

  it("formats ISO timestamps and passes through garbage", () => {
    expect(formatDateTime("2026-10-28T00:00:00.000Z")).toContain("2026");
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
    expect(formatShortDate("2026-10-28T00:00:00.000Z")).toContain("Oct");
  });
});

describe("csv utils", () => {
  it("serializes rows with headers", () => {
    const csv = toCSV([
      { section: "series", profit_minor: 40000 },
      { section: "income_stream", label: "Fees", amount_minor: 1000 },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("section,profit_minor,label,amount_minor");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("series");
  });

  it("escapes commas and quotes", () => {
    const csv = toCSV([{ label: 'Fees, "premium"', amount_minor: 5 }]);
    expect(csv).toContain('"Fees, ""premium"""');
  });

  it("returns empty string for no rows", () => {
    expect(toCSV([])).toBe("");
  });

  it("downloadCSV is SSR-safe", () => {
    expect(() => downloadCSV("revenue.csv", [{ a: 1 }])).not.toThrow();
  });
});
