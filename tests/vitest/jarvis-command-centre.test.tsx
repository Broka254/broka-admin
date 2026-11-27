import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { JarvisProvider } from "@/components/jarvis/provider";
import { CommandCentreView } from "@/components/jarvis/views/command-centre";

import { briefingFixture } from "./fixtures/jarvis";
import {
  alertFixture,
  alertListFixture,
  commandCentreFixture,
  installProxy,
  renderWithClient,
  timeseriesFixture,
  type FakeProxy,
} from "./fixtures/jarvis-proxy";

let proxy: FakeProxy;

function renderCentre() {
  return renderWithClient(
    <JarvisProvider>
      <CommandCentreView />
    </JarvisProvider>,
  );
}

/** The tile or card whose heading is `label`. */
function cardFor(label: string): HTMLElement {
  const element = screen.getByText(label).closest("article");
  if (!element) throw new Error(`No card around ${label}`);
  return element;
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  proxy = installProxy();
  proxy.resources.set("admin/command-center", { status: 200, body: commandCentreFixture() });
  proxy.resources.set("admin/analytics/timeseries", { status: 200, body: timeseriesFixture() });
  proxy.resources.set("admin/alerts", { status: 200, body: alertListFixture([alertFixture()]) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const HEADLINE = "1 critical and 1 high-priority signal in the last 7 days";

describe("headline figures", () => {
  it("shows each headline figure from the snapshot with its value", async () => {
    renderCentre();
    expect(await screen.findByText("Platform revenue")).toBeInTheDocument();
    expect(within(cardFor("Platform revenue")).getByText("KES 2,500")).toBeInTheDocument();
    expect(within(cardFor("API availability")).getByText("99.9%")).toBeInTheDocument();
  });

  it("says a figure the backend did not send is not served, and never shows it as zero", async () => {
    renderCentre();
    await screen.findByText("Live listings");
    const tile = cardFor("Live listings");
    expect(within(tile).getByText("Not served by this backend")).toBeInTheDocument();
    expect(tile).not.toHaveTextContent("0");
  });

  it("states an unavailable figure with its reason and shows no value", async () => {
    renderCentre();
    await screen.findByText("Payment success");
    const tile = cardFor("Payment success");
    expect(within(tile).getByText("Unavailable")).toBeInTheDocument();
    expect(within(tile).getByText("No payment attempts in this window, so a rate cannot be measured.")).toBeInTheDocument();
    expect(tile).not.toHaveTextContent("0%");
  });

  it("shows the reason the snapshot is not loading when the command centre is not served", async () => {
    proxy.resources.delete("admin/command-center");
    renderCentre();
    expect(await screen.findByText("This backend does not serve the command centre yet.")).toBeInTheDocument();
  });
});

describe("briefing", () => {
  it("shows the headline, the signals by severity and the most serious signals first", async () => {
    renderCentre();
    expect(await screen.findByText(HEADLINE)).toBeInTheDocument();

    const counts = screen.getByLabelText("Signals by severity");
    expect(within(counts).getByText("Critical")).toBeInTheDocument();
    expect(within(counts).getByText("High")).toBeInTheDocument();

    const titles = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    const webhook = titles.findIndex((text) => text.includes("Payment webhook failures"));
    const replies = titles.findIndex((text) => text.includes("Seller replies are slowing"));
    expect(webhook).toBeGreaterThan(-1);
    expect(webhook).toBeLessThan(replies);
    expect(screen.getByText("Signal only")).toBeInTheDocument();
  });

  it("asks the backend for the chosen window and refreshes when it changes", async () => {
    renderCentre();
    await screen.findByText(HEADLINE);
    const select = screen.getByLabelText("Briefing window") as HTMLSelectElement;
    expect(select.value).toBe("7");
    expect(proxy.callsTo("GET", "admin/zeno/briefing")[0].path).toBe("admin/zeno/briefing?window_days=7");

    fireEvent.change(select, { target: { value: "30" } });
    await waitFor(() => expect(proxy.callsTo("GET", "admin/zeno/briefing?window_days=30")).not.toHaveLength(0));
  });

  it("hands a signal to Zeno from its card, as a question about that signal", async () => {
    renderCentre();
    await screen.findByText(HEADLINE);
    fireEvent.click(screen.getAllByRole("button", { name: "Investigate with Zeno" })[0]);
    await waitFor(() => expect(proxy.callsTo("POST", "admin/zeno/chat")).toHaveLength(1));
    expect(proxy.callsTo("POST", "admin/zeno/chat")[0].body).toMatchObject({
      message: "Investigate this signal: Payment webhook failures",
    });
  });

  it("reports an outage as unavailable and retries it on request", async () => {
    proxy.briefing = { status: 503, body: { code: "backend_unavailable", message: "x", request_id: "r" } };
    renderCentre();
    expect(await screen.findByText("BROKA cannot be reached right now")).toBeInTheDocument();
    proxy.briefing = { status: 200, body: briefingFixture() };
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(HEADLINE)).toBeInTheDocument();
  });

  it("refuses a briefing that does not match the contract and shows nothing from it", async () => {
    proxy.briefing = { status: 200, body: { ...briefingFixture(), forecast: [] } };
    renderCentre();
    expect(await screen.findByText("The response could not be verified")).toBeInTheDocument();
    expect(screen.queryByText(HEADLINE)).toBeNull();
  });
});

describe("signals and domains", () => {
  it("lists the signals that need attention, each with the figures it was drawn from", async () => {
    renderCentre();
    const section = await screen.findByRole("region", { name: "Signals to act on" });
    expect(within(section).getByText("1 complaint past the first-reply deadline")).toBeInTheDocument();
    expect(within(section).getByText("New listings fell 40% this week")).toBeInTheDocument();
  });

  it("counts the attention each domain needs, and says so when a count is not measured", async () => {
    renderCentre();
    await screen.findByText("Platform revenue");
    expect(screen.getByRole("link", { name: /^Trust and safety/ })).toHaveTextContent("1 signal needs attention");
    expect(screen.getByRole("link", { name: /^Users and sellers/ })).toHaveTextContent("Nothing needs attention");
    // The operations anomalies are not served in this fixture, so no count is shown.
    expect(screen.getByRole("link", { name: /^Operations/ })).toHaveTextContent("Attention not measured");
  });

  it("links each domain to the Jarvis page that hosts it", async () => {
    renderCentre();
    await screen.findByText("Platform revenue");
    expect(screen.getByRole("link", { name: /^Finance/ })).toHaveAttribute("href", "/assistant/business");
    expect(screen.getByRole("link", { name: /^Marketplace/ })).toHaveAttribute("href", "/assistant/marketplace");
    expect(screen.getByRole("link", { name: /^Operations/ })).toHaveAttribute("href", "/assistant/operations");
  });
});

describe("trend", () => {
  it("charts the agreed deal value and leaves an unmeasured day blank in the value table", async () => {
    renderCentre();
    const region = await screen.findByRole("region", { name: "Agreed deal value" });
    fireEvent.click(await within(region).findByText("Show the values"));
    // The unmeasured day is a row in the value table, and its value is not written as KES 0.
    expect(within(region).getByText("not measured")).toBeInTheDocument();
    expect(within(region).getAllByText("KES 4,200").length).toBeGreaterThan(0);
    const table = region.querySelector("table") as HTMLTableElement;
    expect(table).not.toHaveTextContent("KES 0");
  });

  it("draws a measured day with unmeasured days on both sides as a point, so it stays visible", async () => {
    const { container } = renderCentre();
    await screen.findByRole("region", { name: "Agreed deal value" });
    // 25 and 27 November are measured but 26 November is not, so neither has a line to draw.
    await waitFor(() => expect(container.querySelectorAll(".jv-point")).toHaveLength(2));
  });

  it("says the trend is not served when the analytics series does not include it", async () => {
    proxy.resources.set("admin/analytics/timeseries", { status: 200, body: { ...timeseriesFixture(), series: {} } });
    renderCentre();
    const region = await screen.findByRole("region", { name: "Agreed deal value" });
    expect(await within(region).findByText("Not served by this backend.")).toBeInTheDocument();
  });

  it("says the analytics time-series is not served by an older backend", async () => {
    proxy.resources.delete("admin/analytics/timeseries");
    renderCentre();
    const region = await screen.findByRole("region", { name: "Agreed deal value" });
    expect(
      await within(region).findByText("This backend does not serve the analytics time-series yet, so no trend is shown."),
    ).toBeInTheDocument();
  });
});

describe("latest alerts", () => {
  it("shows the newest alerts as Recorded when they were already there on arrival", async () => {
    renderCentre();
    expect(await screen.findByText("Dispute opened on a listing")).toBeInTheDocument();
    expect(screen.getByText("Recorded")).toBeInTheDocument();
    expect(screen.queryByText("Live")).toBeNull();
  });
});
