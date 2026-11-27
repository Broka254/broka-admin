import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { coreStateFor } from "@/components/jarvis/core/zeno-core";
import {
  attentionInsights,
  DOMAINS,
  domainAttention,
  findMetric,
  formatMetric,
  formatServerInstant,
  lastDaysRange,
  metricComparison,
  opportunityInsights,
  parseServerTime,
  serverInstantIso,
  trendFor,
  type CommandCentre,
  type Timeseries,
} from "@/lib/jarvis/command-centre";
import { questionSteps } from "@/lib/jarvis/presentation";
import { JARVIS_SECTIONS, sectionForPath } from "@/lib/jarvis/sections";

import { commandCentreFixture, metricFixture, timeseriesFixture } from "./fixtures/jarvis-proxy";

const centre = commandCentreFixture() as unknown as CommandCentre;

describe("figures are never shown as zero when they are missing", () => {
  it("returns no text for a figure that is absent, null or unavailable", () => {
    expect(formatMetric(null)).toBeNull();
    expect(formatMetric(metricFixture({ key: "revenue", value: 0, available: false }))).toBeNull();
    expect(formatMetric(metricFixture({ key: "revenue", value: null }))).toBeNull();
  });

  it("formats money in shillings, percentages, milliseconds and counts with their units", () => {
    expect(formatMetric(metricFixture({ key: "revenue", unit: "kes_minor", value: 250000 }))).toBe("KES 2,500");
    expect(formatMetric(metricFixture({ key: "seller_reply_rate", unit: "percent", value: 41.2 }))).toBe("41.2%");
    expect(formatMetric(metricFixture({ key: "api_latency_p95", unit: "ms", value: 420 }))).toBe("420 ms");
    expect(formatMetric(metricFixture({ key: "active_users", value: 1200 }))).toBe("1,200");
  });

  it("reports no comparison when the backend computed none, rather than a change of zero", () => {
    const comparison = metricComparison(metricFixture({ key: "revenue", change_pct: null }));
    expect(comparison.change).toBeNull();
  });

  it("finds a figure by group and key, and reports an absent one as absent", () => {
    expect(findMetric(centre, "financial", "revenue")?.value).toBe(250000);
    expect(findMetric(centre, "marketplace", "live_listings")).toBeNull();
    expect(findMetric(undefined, "financial", "revenue")).toBeNull();
  });
});

describe("time", () => {
  it("covers the requested number of inclusive UTC days, ending today", () => {
    expect(lastDaysRange(3, new Date("2026-11-27T23:59:00Z"))).toEqual({ from: "2026-11-25", to: "2026-11-27" });
  });

  it("reads a naive server timestamp as UTC, not as the browser's local time", () => {
    expect(parseServerTime("2026-11-27T10:00:00")).toBe(Date.UTC(2026, 10, 27, 10, 0, 0));
    expect(serverInstantIso("2026-11-27T10:00:00")).toBe("2026-11-27T10:00:00.000Z");
  });

  it("keeps an explicit offset and rejects a missing or invalid timestamp", () => {
    expect(parseServerTime("2026-11-27T10:00:00+03:00")).toBe(Date.UTC(2026, 10, 27, 7, 0, 0));
    expect(parseServerTime(null)).toBeNull();
    expect(parseServerTime("")).toBeNull();
    expect(parseServerTime("not a time")).toBeNull();
    expect(formatServerInstant(null)).toBe("—");
    expect(formatServerInstant("2026-11-27T10:00:00")).toMatch(/UTC$/);
  });
});

describe("trends", () => {
  it("returns null for a series the backend did not send", () => {
    expect(trendFor(undefined, "gmv_minor")).toBeNull();
    expect(trendFor({ ...timeseriesFixture(), series: {} } as unknown as Timeseries, "gmv_minor")).toBeNull();
  });

  it("keeps an unmeasured day as null, so the chart leaves a gap there", () => {
    expect(trendFor(timeseriesFixture() as unknown as Timeseries, "gmv_minor")).toEqual([
      { t: "2026-11-25", v: 150000 },
      { t: "2026-11-26", v: null },
      { t: "2026-11-27", v: 420000 },
    ]);
  });
});

describe("signals and domains", () => {
  it("orders attention signals from the most serious and leaves out positive ones", () => {
    expect(attentionInsights(centre).map((insight) => insight.title)).toEqual([
      "1 complaint past the first-reply deadline",
      "New listings fell 40% this week",
    ]);
  });

  it("lists opportunities and positive results separately from attention", () => {
    expect(opportunityInsights(centre).map((insight) => insight.severity)).toEqual(["opportunity", "positive"]);
  });

  it("counts a domain's attention signals only from its own insight areas", () => {
    expect(domainAttention(centre, DOMAINS.trust)).toBe(1);
    expect(domainAttention(centre, DOMAINS.marketplace)).toBe(1);
    expect(domainAttention(centre, DOMAINS.users)).toBe(0);
    expect(domainAttention(undefined, DOMAINS.trust)).toBeNull();
  });
});

describe("Zeno's state", () => {
  it("shows a disabled or unreachable Zeno over an investigation that cannot be running", () => {
    expect(coreStateFor({ availability: "disabled", investigating: true })).toBe("disabled");
    expect(coreStateFor({ availability: "unavailable", investigating: true })).toBe("unavailable");
    expect(coreStateFor({ availability: "checking", investigating: false })).toBe("checking");
    expect(coreStateFor({ availability: "model-not-ready", investigating: false })).toBe("attention");
    expect(coreStateFor({ availability: "ready", investigating: true })).toBe("analysing");
    expect(coreStateFor({ availability: "ready", investigating: false })).toBe("ready");
  });
});

describe("investigation steps", () => {
  const turns = [
    { id: "u1", role: "user" },
    { id: "a1", role: "assistant" },
    { id: "u2", role: "user" },
    { id: "a2", role: "assistant" },
  ];

  it("numbers no question while part of the transcript is not loaded", () => {
    expect(questionSteps(turns, false).size).toBe(0);
  });

  it("numbers each follow-up and leaves the first question unlabelled", () => {
    expect([...questionSteps(turns, true).entries()]).toEqual([["u2", 2]]);
    expect(questionSteps([{ id: "u1", role: "user" }], true).size).toBe(0);
  });
});

describe("navigation contract", () => {
  it("lists the eight Jarvis sections, in order, with their labels and routes", () => {
    expect(JARVIS_SECTIONS.map((section) => section.label)).toEqual([
      "Command Centre",
      "Intelligence Core",
      "Business Intelligence",
      "Marketplace Intelligence",
      "Trust & Safety",
      "Operations Intelligence",
      "Investigation Studio",
      "Live Intelligence Feed",
    ]);
    expect(JARVIS_SECTIONS.map((section) => section.href)).toEqual([
      "/assistant",
      "/assistant/core",
      "/assistant/business",
      "/assistant/marketplace",
      "/assistant/trust",
      "/assistant/operations",
      "/assistant/studio",
      "/assistant/live",
    ]);
  });

  it("has a route file for every section, so no link leads to a missing page", () => {
    for (const section of JARVIS_SECTIONS) {
      const page = resolve(process.cwd(), "app/(dashboard)", section.href.replace(/^\//, ""), "page.tsx");
      expect(existsSync(page), `missing ${page}`).toBe(true);
    }
  });

  it("maps a pathname to its section, tolerating a trailing slash and unknown sub-paths", () => {
    expect(sectionForPath("/assistant").label).toBe("Command Centre");
    expect(sectionForPath("/assistant/studio/").label).toBe("Investigation Studio");
    expect(sectionForPath("/assistant/live/extra").label).toBe("Live Intelligence Feed");
    expect(sectionForPath("/assistant/unknown").label).toBe("Command Centre");
  });

  it("builds the sidebar from the shared section list, with no separate Founder entry for Jarvis", () => {
    const shell = readFileSync(resolve(process.cwd(), "components/layout/admin-shell.tsx"), "utf8");
    expect(shell).toContain("JARVIS_SECTIONS.map");
    expect(shell).not.toMatch(/label: "Jarvis Mode", href: "\/assistant"/);
  });
});
