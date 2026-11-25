import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/hooks/use-admin-resource", () => ({
  isEndpointMissing: (error: unknown) => (error as { status?: number } | null)?.status === 404,
  useAdminResource: vi.fn(),
}));
vi.mock("@/hooks/use-market", () => ({ useMarketListing: vi.fn(), useAnomalyScan: vi.fn() }));
vi.mock("@/lib/csv", () => ({ downloadCSV: vi.fn() }));

import { MarketView } from "@/components/intelligence/market-view";
import { useAdminResource } from "@/hooks/use-admin-resource";
import { useAnomalyScan, useMarketListing } from "@/hooks/use-market";
import { parseAdminResource } from "@/lib/api/schemas";
import { downloadCSV } from "@/lib/csv";
import {
  demandFixture, legacyPerformanceFixture, legacyRankingsFixture, performanceFixture, rankingsFixture,
} from "./fixtures/market";

type Resources = Record<string, unknown>;

function ok(data: unknown) {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn() };
}

function missing() {
  return { data: undefined, isLoading: false, isError: true, error: { status: 404, message: "Not found" }, refetch: vi.fn() };
}

/** Each resource answers as the backend would; contracts are applied as the proxy does. */
function serve(resources: Resources) {
  vi.mocked(useAdminResource).mockImplementation(((resource: string) => {
    const payload = resources[resource];
    if (payload === "missing") return missing();
    if (payload === undefined) return ok(undefined);
    return ok(parseAdminResource(resource as "marketRankings", payload));
  }) as never);
}

const current: Resources = {
  marketRankings: rankingsFixture,
  marketPerformance: performanceFixture,
  marketDemand: demandFixture,
};

function lastQuery(resource: string): { query: string | null; enabled: unknown } {
  const calls = vi.mocked(useAdminResource).mock.calls.filter(([name]) => name === resource);
  const [, query, enabled] = calls[calls.length - 1] as unknown as [string, URLSearchParams | undefined, boolean | undefined];
  return { query: query ? query.toString() : null, enabled };
}

beforeEach(() => {
  vi.mocked(useMarketListing).mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() } as never);
  vi.mocked(useAnomalyScan).mockReturnValue({ mutate: vi.fn(), isPending: false, data: undefined, isError: false, error: null } as never);
});

describe("MarketView rankings", () => {
  it("ranks listings and shows how the score is built", () => {
    serve(current);
    render(<MarketView />);
    const table = screen.getByRole("table", { name: /most viewed/i });
    expect(within(table).getByText("Listing a")).toBeInTheDocument();
    expect(within(table).getByText("Second phone")).toBeInTheDocument();
    expect(screen.getByText(/Score = 1 x viewers/)).toBeInTheDocument();
    expect(lastQuery("marketRankings")).toEqual({ query: "window_days=7", enabled: true });
  });

  it("switches to the negotiation and conversion rankings", () => {
    serve(current);
    render(<MarketView />);
    fireEvent.change(screen.getByLabelText("Ranking"), { target: { value: "negotiated" } });
    expect(screen.getByRole("table", { name: /most negotiated/i })).toHaveTextContent("Haggled phone");
    fireEvent.change(screen.getByLabelText("Ranking"), { target: { value: "growing" } });
    expect(screen.getByText("No listing here grew from a score of at least 5 in the window before.")).toBeInTheDocument();
  });

  it("filters by category and county", () => {
    serve(current);
    render(<MarketView />);
    const category = screen.getByLabelText("Category filter");
    // The placeholder for listings without a category is not a filter.
    expect(within(category).queryByText("Uncategorised")).toBeNull();
    fireEvent.change(category, { target: { value: "Phones" } });
    fireEvent.change(screen.getByLabelText("County filter"), { target: { value: "Nairobi" } });
    expect(lastQuery("marketRankings").query).toBe("window_days=7&category=Phones&county=Nairobi");
    // Performance is not filtered: the API ranks every seller.
    expect(lastQuery("marketPerformance").query).toBe("window_days=7");
  });

  it("exports the ranking shown as CSV", () => {
    serve(current);
    render(<MarketView />);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    const [filename, rows] = vi.mocked(downloadCSV).mock.calls[0];
    expect(filename).toMatch(/^broka-listings-viewed-7d-to-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(rows.map((row) => row.listing_id)).toEqual(["a", "b"]);
  });

  it("lists listings that stall, fade or wait for their seller", () => {
    serve(current);
    render(<MarketView />);
    expect(screen.getByText("Stalled sofa")).toBeInTheDocument();
    expect(screen.getByText("Score 10, down from 30 in the window before.")).toBeInTheDocument();
    expect(screen.getByText("2 buyers waiting for the seller, the longest 30.5 hours.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the seller" })).toHaveAttribute("href", "/users/seller-e");
  });

  it("says what an older API cannot rank instead of showing an empty list", () => {
    serve({ ...current, marketRankings: legacyRankingsFixture, marketPerformance: legacyPerformanceFixture });
    render(<MarketView />);
    fireEvent.change(screen.getByLabelText("Ranking"), { target: { value: "negotiated" } });
    expect(screen.getByText("This ranking needs the upgraded BROKA API.")).toBeInTheDocument();
    // Contacted-no-deal, unusual interest, losing attention, waiting buyers, the buyer journey.
    expect(screen.getAllByText("Needs the upgraded BROKA API.")).toHaveLength(5);
  });
});

describe("MarketView custom range", () => {
  it("requests nothing until the range is valid, then sends the end day included", () => {
    serve(current);
    render(<MarketView />);
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText("Through date"), { target: { value: "2025-06-30" } });
    expect(screen.getByRole("alert")).toHaveTextContent("A custom range is at most 90 days; this one is 181.");
    expect(lastQuery("marketRankings")).toEqual({ query: null, enabled: false });
    expect(lastQuery("marketPerformance").enabled).toBe(false);

    fireEvent.change(screen.getByLabelText("Through date"), { target: { value: "2025-01-31" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(lastQuery("marketRankings")).toEqual({ query: "from=2025-01-01&to=2025-02-01", enabled: true });
    expect(lastQuery("marketPerformance").query).toBe("from=2025-01-01&to=2025-02-01");
    // Demand has rolling windows only: the range sets its length.
    expect(lastQuery("marketDemand").query).toBe("window_days=31");
    expect(screen.getAllByText(/custom dates set only its length/).length).toBeGreaterThan(0);
  });
});

describe("MarketView demand", () => {
  it("compares demand with the window before", () => {
    serve(current);
    render(<MarketView />);
    expect(screen.getByText("Rising · Phones")).toBeInTheDocument();
    expect(screen.getByText("Falling · Furniture")).toBeInTheDocument();
    const counties = screen.getByRole("table", { name: /buyer conversations and supply by county/i });
    expect(within(counties).getByText("Nairobi")).toBeInTheDocument();
    expect(lastQuery("marketDemand").query).toBe("window_days=7");
    expect(lastQuery("intelligenceCategories").enabled).toBe(false);
  });

  it("falls back to the category and county reads on an API without /market/demand", () => {
    serve({
      ...current,
      marketDemand: "missing",
      intelligenceCategories: {
        generated_at: "2026-11-24T10:00:00Z", window: { from: "2026-11-17T10:00:00Z", to: "2026-11-24T10:00:00Z", days: 7 },
        categories: [{
          key: "phones", label: "Phones", supply_live: 3, new_listings: 2, buyer_threads: 8, interests: 3, viewers: 20,
          buy_agent_requests: 1, buy_agent_unmatched: 0, sold_out_reports: 0, deals_agreed: 2, demand: 12,
          demand_per_listing: 4, median_price_kes: 25000,
          liquidity: { cohort_from: "2026-11-03T00:00:00Z", cohort_to: "2026-11-10T00:00:00Z", eligible: 4, with_buyer_contact: 2, rate_pct: 50, median_hours_to_first_contact: 5 },
          signal: "undersupplied", recommendation: "More buyer demand than listings.",
        }],
      },
    });
    render(<MarketView />);
    expect(lastQuery("intelligenceCategories").enabled).toBe(true);
    const table = screen.getByRole("table", { name: "Demand by category" });
    expect(within(table).getByText("Phones")).toBeInTheDocument();
    expect(within(table).getByText("Undersupplied")).toBeInTheDocument();
    expect(screen.getByText(/This API has no comparison with the window before/)).toBeInTheDocument();
  });
});

describe("MarketView performance", () => {
  it("follows buyers from a view to a completed deal and links people to their records", () => {
    serve(current);
    render(<MarketView />);
    expect(screen.getByText("Completed a deal")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Amina Stores" })).toHaveAttribute("href", "/users/seller-a");
    expect(screen.getByRole("link", { name: "Brian" })).toHaveAttribute("href", "/users/buyer-1");
    expect(screen.getByText(/searches:/)).toBeInTheDocument();
  });
});
