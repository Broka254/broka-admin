import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JarvisProvider } from "@/components/jarvis/provider";
import { DomainPage } from "@/components/jarvis/views/domain-page";
import type { DomainKey } from "@/lib/jarvis/command-centre";

import { installProxy, commandCentreFixture, renderWithClient, timeseriesFixture, type FakeProxy } from "./fixtures/jarvis-proxy";

let proxy: FakeProxy;

function renderPage(domains: DomainKey[], title = "Business Intelligence") {
  return renderWithClient(
    <JarvisProvider>
      <DomainPage eyebrow="Jarvis Mode" title={title} description="Test description." domains={domains} />
    </JarvisProvider>,
  );
}

beforeEach(() => {
  proxy = installProxy();
  proxy.resources.set("admin/command-center", { status: 200, body: commandCentreFixture() });
  proxy.resources.set("admin/analytics/timeseries", { status: 200, body: timeseriesFixture() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("domain panels", () => {
  it("shows the finance and growth panels together on the business page, with the founder's targets", async () => {
    renderPage(["finance", "growth"]);
    expect(await screen.findByRole("heading", { level: 2, name: "Finance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Growth" })).toBeInTheDocument();
    expect(await screen.findByText("Paying customers (30 days)")).toBeInTheDocument();
    expect(screen.getByText("Met")).toBeInTheDocument();
    expect(screen.getAllByText("Not met").length).toBeGreaterThan(0);
  });

  it("states a figure the backend did not send as not served, on the marketplace page", async () => {
    renderPage(["marketplace", "users"], "Marketplace Intelligence");
    expect(await screen.findByRole("heading", { level: 2, name: "Marketplace" })).toBeInTheDocument();
    // Live listings is not in this fixture, so its tile must say so rather than show a number.
    const tile = (await screen.findByText("Live listings")).closest("article") as HTMLElement;
    expect(within(tile).getByText("Not served by this backend")).toBeInTheDocument();
  });

  it("shows the reason a domain's figures are missing and offers a retry", async () => {
    proxy.resources.delete("admin/command-center");
    renderPage(["finance"]);
    expect(await screen.findByText("The figures for this domain could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("operations", () => {
  it("shows each anomaly with the day it was judged on, what it means and the figures not judged", async () => {
    proxy.resources.set("admin/operations/anomalies", {
      status: 200,
      body: {
        evaluated_day: "2026-11-26",
        anomalies: [
          {
            key: "api_latency_p95",
            date: "2026-11-26",
            label: "API latency (p95)",
            severity: "high",
            observed: 1900,
            baseline_median: 420,
            what_happened: "API latency rose to 1.9 seconds.",
            impact: "Buyers see slow responses.",
            suggested_action: "Check the database connection pool.",
            source: "api.core.operations",
          },
        ],
        not_covered: [{ figure: "payments_waiting", reason: "No baseline yet." }],
      },
    });
    renderPage(["operations"], "Operations Intelligence");

    expect(await screen.findByText("Judged against their own history, for 2026-11-26")).toBeInTheDocument();
    expect(screen.getByText("API latency rose to 1.9 seconds.")).toBeInTheDocument();
    expect(screen.getByText("Suggested: Check the database connection pool.")).toBeInTheDocument();
    expect(screen.getByText("Figures not judged (1)")).toBeInTheDocument();
  });

  it("says an older backend does not serve the anomaly judgements", async () => {
    renderPage(["operations"], "Operations Intelligence");
    expect(await screen.findByText("This backend does not serve the anomaly judgements yet.")).toBeInTheDocument();
  });
});

describe("trust and safety", () => {
  it("shows the complaints queue, and keeps a count the feedback service did not send as a dash", async () => {
    proxy.resources.set("admin/feedback/stats", { status: 200, body: { open_complaints: 4, open_by_severity: { urgent: 1 } } });
    renderPage(["trust"], "Trust & Safety");

    const openCount = await screen.findByText("Open complaints");
    expect(within(openCount.parentElement as HTMLElement).getByText("4")).toBeInTheDocument();
    const urgent = screen.getByText("Urgent and open").parentElement as HTMLElement;
    expect(within(urgent).getByText("1")).toBeInTheDocument();
    const everything = screen.getByText("All feedback").parentElement as HTMLElement;
    expect(within(everything).getByText("—")).toBeInTheDocument();
  });
});
