import { describe, expect, it } from "vitest";

import {
  coverageNote,
  formatCount,
  formatDuration,
  formatPercent,
  formatRatio,
  utcRangeEndingToday,
} from "@/lib/activity-format";

describe("activity formatting", () => {
  it("shows durations in seconds, minutes and hours", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(720)).toBe("12m");
    expect(formatDuration(3900)).toBe("1h 05m");
    expect(formatDuration(59.6)).toBe("1m");
  });

  it("never turns an unmeasured value into zero", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
    expect(formatPercent(null)).toBe("—");
    expect(formatRatio(null)).toBe("—");
    expect(formatCount(null)).toBe("—");
  });

  it("clamps negative durations to zero", () => {
    expect(formatDuration(-5)).toBe("0s");
  });

  it("formats percentages from values already multiplied by 100", () => {
    expect(formatPercent(12.345)).toBe("12.3%");
    expect(formatPercent(0)).toBe("0.0%");
    expect(formatRatio(0.3333)).toBe("0.33");
  });

  it("explains when no activity has been recorded", () => {
    expect(coverageNote(null)).toMatch(/No signed-in activity has been recorded yet/);
    expect(coverageNote("2026-11-01")).toContain("2026-11-01");
    expect(coverageNote("2026-11-01")).toMatch(/never shown as zero|not counted as zero/);
  });

  it("builds a range that ends on today's UTC day, end exclusive", () => {
    const range = utcRangeEndingToday(30, new Date("2026-11-24T10:00:00Z"));
    expect(range).toEqual({ from: "2026-10-26", to: "2026-11-25" });
  });
});
