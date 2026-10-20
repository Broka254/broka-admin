import { describe, expect, it } from "vitest";

import {
  isoToLocalDateTimeInput,
  localDateTimeInputToIso,
  resolveExpiryForSave,
} from "@/lib/communications/datetime";

describe("expiry timestamp conversion", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("loads a stored UTC instant into Africa/Nairobi local form time", () => {
    expect(
      isoToLocalDateTimeInput("2026-01-15T09:30:00.000Z", "Africa/Nairobi"),
    ).toBe("2026-01-15T12:30");
  });

  it("saves an unchanged local value without shifting the instant", () => {
    const originalIso = "2026-01-15T09:30:00.000Z";
    const input = isoToLocalDateTimeInput(originalIso, "Africa/Nairobi");
    const result = resolveExpiryForSave({
      input,
      originalInput: input,
      originalIso,
      now,
      timeZone: "Africa/Nairobi",
    });
    expect(result).toEqual({ ok: true, expiresAt: originalIso });
  });

  it("edits and saves wall-clock time in Africa/Nairobi", () => {
    expect(localDateTimeInputToIso("2026-01-15T18:45", "Africa/Nairobi")).toBe(
      "2026-01-15T15:45:00.000Z",
    );
  });

  it("handles a second non-UTC time zone", () => {
    expect(localDateTimeInputToIso("2026-01-15T09:30", "America/New_York")).toBe(
      "2026-01-15T14:30:00.000Z",
    );
  });

  it("sends null when an existing expiry is cleared", () => {
    expect(isoToLocalDateTimeInput(null, "UTC")).toBe("");
    expect(
      resolveExpiryForSave({ input: "", now }),
    ).toEqual({ ok: true, expiresAt: null });
    expect(
      resolveExpiryForSave({
        input: "",
        originalInput: "2026-01-15T12:30",
        originalIso: "2026-01-15T09:30:00.000Z",
        now,
      }),
    ).toEqual({ ok: true, expiresAt: null });
  });

  it("rejects invalid and past timestamps explicitly", () => {
    expect(() => isoToLocalDateTimeInput("not-a-date", "UTC")).toThrow(/valid ISO/i);
    expect(() => localDateTimeInputToIso("2026-02-31T10:00", "UTC")).toThrow(
      /valid local date/i,
    );
    expect(
      resolveExpiryForSave({
        input: "2025-12-31T23:00",
        originalInput: "2025-12-31T23:00",
        originalIso: "2025-12-31T20:00:00.000Z",
        now,
        timeZone: "Africa/Nairobi",
      }),
    ).toEqual({ ok: false, message: "Expiry time must be in the future." });
  });

  it("handles daylight-saving gaps and ambiguous fall-back times", () => {
    expect(() => localDateTimeInputToIso("2026-03-08T02:30", "America/New_York")).toThrow(
      /daylight-saving/i,
    );
    expect(localDateTimeInputToIso("2026-11-01T01:30", "America/New_York")).toBe(
      "2026-11-01T05:30:00.000Z",
    );
    expect(
      resolveExpiryForSave({
        input: "2026-11-01T01:30",
        originalInput: "2026-11-01T01:30",
        originalIso: "2026-11-01T06:30:00.000Z",
        now,
        timeZone: "America/New_York",
      }),
    ).toEqual({ ok: true, expiresAt: "2026-11-01T06:30:00.000Z" });
  });
});
