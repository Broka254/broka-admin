import { describe, expect, it } from "vitest";

import { readDateRangeParams, writeDateRangeParams } from "@/lib/date-range";

const fallback = { from: "2026-10-01", to: "2026-10-31", bucket: "day" as const };

describe("date-range URL serialisation", () => {
  it("reads a complete, valid range exactly", () => {
    const params = new URLSearchParams({ from: "2026-09-01", to: "2026-09-30", bucket: "week" });
    expect(readDateRangeParams(params, fallback)).toEqual({ from: "2026-09-01", to: "2026-09-30", bucket: "week" });
  });

  it("falls back as a whole when a date is missing, malformed or reversed", () => {
    expect(readDateRangeParams(new URLSearchParams({ from: "2026-09-01", bucket: "day" }), fallback)).toEqual(fallback);
    expect(readDateRangeParams(new URLSearchParams({ from: "2026-13-01", to: "2026-13-20" }), fallback)).toEqual(fallback);
    expect(readDateRangeParams(new URLSearchParams({ from: "2026-02-31", to: "2026-03-05" }), fallback)).toEqual(fallback);
    expect(readDateRangeParams(new URLSearchParams({ from: "2026-10-20", to: "2026-10-01" }), fallback)).toEqual(fallback);
  });

  it("keeps valid dates but falls back to the default bucket when the bucket is unknown", () => {
    expect(readDateRangeParams(new URLSearchParams({ from: "2026-09-01", to: "2026-09-30", bucket: "year" }), fallback)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      bucket: "day",
    });
  });

  it("writes the range without dropping unrelated query parameters", () => {
    const base = new URLSearchParams({ pulse: "30", search: "wanjiru" });
    const written = writeDateRangeParams({ from: "2026-09-01", to: "2026-09-30", bucket: "month" }, base);
    expect(written.get("pulse")).toBe("30");
    expect(written.get("search")).toBe("wanjiru");
    expect(written.get("from")).toBe("2026-09-01");
    expect(written.get("to")).toBe("2026-09-30");
    expect(written.get("bucket")).toBe("month");
  });

  it("round-trips through the URL reader", () => {
    const next = { from: "2026-11-01", to: "2026-11-12", bucket: "day" as const };
    expect(readDateRangeParams(writeDateRangeParams(next), fallback)).toEqual(next);
  });
});
