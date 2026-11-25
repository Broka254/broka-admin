import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  const w = window as unknown as Record<string, unknown>;
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    w.ResizeObserver = ResizeObserverStub;
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

vi.mock("@/hooks/use-market", () => ({ useMarketListing: vi.fn(), useAnomalyScan: vi.fn() }));

import { ListingAnalyticsPanel } from "@/components/intelligence/listing-analytics";
import { AdminRequestError } from "@/hooks/use-admin-resource";
import { useMarketListing } from "@/hooks/use-market";
import { MarketListingDetailSchema } from "@/lib/api/market-schemas";
import { listingDetailFixture } from "./fixtures/market";

function ready(payload: Record<string, unknown>) {
  return { data: MarketListingDetailSchema.parse(payload), isLoading: false, isError: false, error: null, refetch: vi.fn() };
}

function tile(label: string): HTMLElement {
  const funnel = screen.getByTestId("listing-funnel");
  const heading = within(funnel).getByText(label);
  return heading.closest(".stat-tile") as HTMLElement;
}

describe("ListingAnalyticsPanel", () => {
  it("shows every stage a buyer can reach, through to a completed deal", () => {
    vi.mocked(useMarketListing).mockReturnValue(ready(listingDetailFixture()) as never);
    render(<ListingAnalyticsPanel listingId="lst-1" />);

    expect(within(tile("Viewers")).getByText("12")).toBeInTheDocument();
    expect(within(tile("Contacted")).getByText("5")).toBeInTheDocument();
    expect(within(tile("Negotiated")).getByText("2")).toBeInTheDocument();
    expect(within(tile("Deals agreed")).getByText("20% of contacters")).toBeInTheDocument();
    expect(within(tile("Deals completed")).getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/Ranks #2 by viewers among 9 engaged listings/)).toBeInTheDocument();
    expect(screen.getByText(/Lifetime view counter: 140 over 54 days listed/)).toBeInTheDocument();
    expect(screen.getByText("released · 1")).toBeInTheDocument();
    expect(screen.getByTestId("listing-daily-chart")).toHaveTextContent("12 first views over 3 days");
  });

  it("lists the nightly snapshots latest first, with the sell score labelled as a rule", () => {
    vi.mocked(useMarketListing).mockReturnValue(ready(listingDetailFixture()) as never);
    render(<ListingAnalyticsPanel listingId="lst-1" />);

    const table = screen.getByRole("table", { name: /nightly listing snapshots/i });
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("2026-11-24");
    expect(rows[1]).toHaveTextContent("64%");
    expect(rows[2]).toHaveTextContent("2026-11-23");
    expect(screen.getByText(/rule-based estimate \(0 to 100\), not a trained model/)).toBeInTheDocument();
  });

  it("shows a dash, not a zero, for a stage an older API does not send", () => {
    vi.mocked(useMarketListing).mockReturnValue(ready(listingDetailFixture({
      funnel: { viewers: 12, savers_or_likers: 4, contacters: 5, deals_agreed: 1 },
      daily: [{ date: "2026-11-24", views: 4, saves: 1, likes: 0, contacts: 2 }],
      snapshots: [],
    })) as never);
    render(<ListingAnalyticsPanel listingId="lst-1" />);

    expect(within(tile("Negotiated")).getByText("—")).toBeInTheDocument();
    expect(within(tile("Deals completed")).getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/No nightly snapshot in this window/)).toBeInTheDocument();
  });

  it("says the API needs upgrading when the endpoint is missing", () => {
    vi.mocked(useMarketListing).mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new AdminRequestError("Not found", 404), refetch: vi.fn() } as never);
    render(<ListingAnalyticsPanel listingId="lst-1" />);
    expect(screen.getByText("Listing analytics needs the upgraded BROKA API.")).toBeInTheDocument();
  });

  it("offers a retry for any other failure", () => {
    const refetch = vi.fn();
    vi.mocked(useMarketListing).mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new AdminRequestError("The BROKA API is temporarily unavailable.", 503), refetch } as never);
    render(<ListingAnalyticsPanel listingId="lst-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("reloads for the window chosen", () => {
    vi.mocked(useMarketListing).mockReturnValue(ready(listingDetailFixture()) as never);
    render(<ListingAnalyticsPanel listingId="lst-1" />);
    expect(useMarketListing).toHaveBeenLastCalledWith("lst-1", 30);
    fireEvent.click(screen.getByRole("radio", { name: "90 days" }));
    expect(useMarketListing).toHaveBeenLastCalledWith("lst-1", 90);
  });
});
