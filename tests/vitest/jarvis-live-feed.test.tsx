import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveFeedView } from "@/components/jarvis/views/live-feed";

import { alertFixture, alertListFixture, installProxy, renderWithClient, type FakeProxy } from "./fixtures/jarvis-proxy";

let proxy: FakeProxy;

beforeEach(() => {
  proxy = installProxy();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("live intelligence feed", () => {
  it("marks an alert Live only when it arrives after the view has loaded", async () => {
    proxy.resources.set("admin/alerts", {
      status: 200,
      body: alertListFixture([alertFixture({ id: 1, title: "Older alert" })]),
    });
    const { client } = renderWithClient(<LiveFeedView />);

    const older = (await screen.findByText("Older alert")).closest("li") as HTMLElement;
    expect(within(older).getByText("Recorded")).toBeInTheDocument();

    proxy.resources.set("admin/alerts", {
      status: 200,
      body: alertListFixture([alertFixture({ id: 2, title: "New alert" }), alertFixture({ id: 1, title: "Older alert" })]),
    });
    await client.invalidateQueries({ queryKey: ["broka-admin", "alerts"] });

    const fresh = (await screen.findByText("New alert")).closest("li") as HTMLElement;
    await waitFor(() => expect(within(fresh).getByText("Live")).toBeInTheDocument());
    expect(within(older).getByText("Recorded")).toBeInTheDocument();
  });

  it("asks the backend for every status, so the feed is not limited to open alerts", async () => {
    proxy.resources.set("admin/alerts", { status: 200, body: alertListFixture([alertFixture()]) });
    renderWithClient(<LiveFeedView />);
    await screen.findByText("Dispute opened on a listing");
    expect(proxy.callsTo("GET", "admin/alerts")[0].path).toBe("admin/alerts?status=all&limit=50&offset=0");
  });

  it("says plainly when the backend has no alerts recorded", async () => {
    proxy.resources.set("admin/alerts", { status: 200, body: alertListFixture([]) });
    renderWithClient(<LiveFeedView />);
    expect(await screen.findByText("The backend has no alerts recorded.")).toBeInTheDocument();
  });

  it("shows the stream as offline with the refresh interval it falls back to", async () => {
    proxy.resources.set("admin/alerts", { status: 200, body: alertListFixture([alertFixture()]) });
    renderWithClient(<LiveFeedView />);
    expect(await screen.findByText("Stream offline: refreshing every 15 seconds")).toBeInTheDocument();
  });
});
