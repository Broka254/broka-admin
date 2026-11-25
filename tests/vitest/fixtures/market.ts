// Payloads shaped exactly as the backend writes them (api/core/market_intel.py):
// the current API, and the one from before the negotiation and completion
// stages, which the dashboard must still read.

type Row = Record<string, unknown>;

export function listingRow(id: string, overrides: Row = {}): Row {
  return {
    listing_id: id, name: `Listing ${id}`, category: "Phones", county: "Nairobi", seller_id: `seller-${id}`,
    viewers: 10, savers: 3, likers: 2, contacters: 4, negotiators: 2, deal_buyers: 1, completed_buyers: 1,
    view_to_save_pct: 30, view_to_contact_pct: 40, contact_to_deal_pct: 25,
    score: 58, breakdown: { views: 10, saves: 6, likes: 4, contacts: 16, negotiations: 12, deals: 10 },
    ...overrides,
  };
}

/** A row from the API before negotiators, deals and the score breakdown. */
export function legacyRow(id: string, overrides: Row = {}): Row {
  return {
    listing_id: id, name: `Listing ${id}`, category: "Phones", county: "Nairobi", seller_id: `seller-${id}`,
    viewers: 10, savers: 3, likers: 2, contacters: 4, view_to_save_pct: 30, view_to_contact_pct: 40,
    ...overrides,
  };
}

const marketWindow = {
  from: "2026-11-17T10:00:00Z", to: "2026-11-24T10:00:00Z", days: 7,
  previous_from: "2026-11-10T10:00:00Z", previous_to: "2026-11-17T10:00:00Z",
};

const definitions = {
  views: "First-time viewers in the window (listing_views keeps one row per listing and viewer).",
  deal_rate: "Buyers who agreed a deal / buyers who contacted, capped at 100%.",
  trending: "Score gain against the previous window of equal length; the score must be at least 3 and higher than before.",
  growing: "Relative score gain, for listings that scored at least 5 in the previous window.",
  losing_attention: "Listings that scored at least 10 in the previous window and at most half of that now.",
  needs_seller: "Buyers whose first message in the window has had no reply from the seller for over 24 hours.",
};

export const rankingsFixture = {
  generated_at: "2026-11-24T10:00:00Z",
  window: marketWindow,
  category: null,
  county: null,
  truncated: false,
  listings_engaged: 5,
  weights: { views: 1, saves: 2, likes: 2, contacts: 4, negotiations: 6, deals: 10 },
  formula: "Score = 1 x viewers + 2 x savers + 2 x likers + 4 x contacters + 6 x negotiators + 10 x buyers who agreed a deal, counting distinct users at each stage.",
  rankings: {
    viewed: [listingRow("a"), listingRow("b", { name: "Second phone", viewers: 6 })],
    saved: [listingRow("a")],
    liked: [listingRow("a")],
    contacted: [listingRow("a")],
    negotiated: [listingRow("b", { name: "Haggled phone", negotiators: 3 })],
    converted: [listingRow("a")],
    trending: [listingRow("a", { previous_score: 20, delta: 38, growth_pct: 190 })],
    growing: [],
  },
  conversion: {
    benchmark: null,
    popular_not_converting: [],
    hidden_gems: [],
    engaged_not_converting: [listingRow("c", {
      name: "Stalled sofa", deal_buyers: 0, completed_buyers: 0,
      note: "4 buyers contacted and 2 negotiated, but none agreed a deal in the window: check the price, the stock and how the seller answers.",
    })],
    unusual_interest: [],
    note: "Needs at least 4 listings with 5+ viewers to benchmark contact rates.",
  },
  attention: {
    losing_attention: [listingRow("d", {
      name: "Fading TV", score: 10, previous_score: 30, delta: -20, growth_pct: -66.7,
      note: "Score 10, down from 30 in the window before.",
    })],
    needs_seller: [listingRow("e", {
      name: "Quiet fridge", waiting_buyers: 2, oldest_wait_hours: 30.5,
      note: "2 buyers waiting for the seller, the longest 30.5 hours.",
    })],
  },
  definitions,
};

export const legacyRankingsFixture = {
  generated_at: "2026-11-24T10:00:00Z",
  window: { from: marketWindow.from, to: marketWindow.to, days: 7 },
  category: null,
  truncated: false,
  listings_engaged: 2,
  rankings: {
    viewed: [legacyRow("a")], saved: [legacyRow("a")], liked: [], contacted: [legacyRow("a")],
    trending: [legacyRow("a", { score: 30, previous_score: 10, delta: 20, growth_pct: 200 })],
  },
  conversion: { benchmark: null, popular_not_converting: [], hidden_gems: [], note: "Needs at least 4 listings with 5+ viewers to benchmark contact rates." },
  definitions: { views: definitions.views },
};

export const performanceFixture = {
  generated_at: "2026-11-24T10:00:00Z",
  window: marketWindow,
  truncated: false,
  response_time_truncated: false,
  sellers: { total: 1, top: [{
    seller_id: "seller-a", name: "Amina Stores", listings_engaged: 2, viewers: 16, savers: 3, contacters: 5,
    negotiators: 3, contact_rate_pct: 31.3, deals_agreed: 2, deals_completed: 1,
    viewers_previous: 8, contacters_previous: 2, contacters_change_pct: 150, live_listings: 4, avg_first_reply_minutes: 42,
  }] },
  buyers: { total: 3, browsers_without_contact: 1, top: [{
    buyer_id: "buyer-1", name: "Brian", listings_viewed: 3, listings_saved: 1, listings_contacted: 2,
    listings_negotiated: 1, deals_agreed: 1, deals_completed: 1,
  }] },
  buyer_funnel: [
    { key: "viewed", label: "Viewed a listing", buyers: 3, pct_of_viewed: 100 },
    { key: "saved_or_liked", label: "Saved or liked one", buyers: 2, pct_of_viewed: 66.7 },
    { key: "contacted", label: "Contacted a seller", buyers: 2, pct_of_viewed: 66.7 },
    { key: "negotiated", label: "Negotiated", buyers: 1, pct_of_viewed: 33.3 },
    { key: "deal_agreed", label: "Agreed a deal", buyers: 1, pct_of_viewed: 33.3 },
    { key: "deal_completed", label: "Completed a deal", buyers: 1, pct_of_viewed: 33.3 },
  ],
  not_instrumented: [{ metric: "searches", reason: "Search queries are not recorded, so search-to-contact conversion cannot be measured." }],
  definitions: {
    seller_contact_rate: "Distinct contacters / distinct viewers across the seller's listings.",
    avg_first_reply_minutes: "Average minutes from a buyer's first message to the seller's first reply.",
    buyer_funnel: "Distinct buyers at each stage in the window.",
  },
};

export const legacyPerformanceFixture = {
  generated_at: "2026-11-24T10:00:00Z",
  window: { from: marketWindow.from, to: marketWindow.to, days: 7 },
  truncated: false,
  sellers: { total: 1, top: [{ seller_id: "seller-a", name: "Amina Stores", listings_engaged: 2, viewers: 16, savers: 3, contacters: 5, contact_rate_pct: 31.3, deals_agreed: 2 }] },
  buyers: { total: 3, browsers_without_contact: 1, top: [{ buyer_id: "buyer-1", name: "Brian", listings_viewed: 3, listings_saved: 1, listings_contacted: 2, deals_agreed: 1 }] },
  definitions: { seller_contact_rate: "Distinct contacters / distinct viewers across the seller's listings." },
};

export const demandFixture = {
  generated_at: "2026-11-24T10:00:00Z",
  window: { from: "2026-10-25T10:00:00Z", to: "2026-11-24T10:00:00Z", days: 30, previous_from: "2026-09-25T10:00:00Z", previous_to: "2026-10-25T10:00:00Z" },
  categories: [
    {
      key: "phones", label: "Phones", signal: "undersupplied", recommendation: "More buyer demand than listings: recruit sellers and invite stores.",
      supply_live: 3, demand: 12, demand_previous: 6, demand_change_pct: 100, demand_per_listing: 4,
      buyer_threads: 8, interests: 3, buy_agent_requests: 1, new_listings: 2, new_listings_previous: 1,
      deals_agreed: 2, deals_agreed_previous: 1, median_price_kes: 25000,
    },
    {
      key: "furniture", label: "Furniture", signal: "inactive", recommendation: "No activity in this window after some in the one before.",
      supply_live: 0, demand: 0, demand_previous: 4, demand_change_pct: -100, demand_per_listing: null,
      buyer_threads: 0, interests: 0, buy_agent_requests: 0, new_listings: 0, new_listings_previous: 2,
      deals_agreed: 0, deals_agreed_previous: 1, median_price_kes: null,
    },
    {
      key: "uncategorised", label: "Uncategorised", signal: "developing", recommendation: "Too little activity yet to call.",
      supply_live: 1, demand: 0, demand_previous: 0, demand_change_pct: null, demand_per_listing: 0,
      buyer_threads: 0, interests: 0, buy_agent_requests: 0, new_listings: 1, new_listings_previous: 0,
      deals_agreed: 0, deals_agreed_previous: 0, median_price_kes: 1000,
    },
  ],
  growth: { rising: ["Phones"], falling: ["Furniture"] },
  counties: [
    {
      key: "nairobi", label: "Nairobi", supply_live: 4, stores: 1, buyer_threads: 8, buyer_threads_previous: 4,
      buyer_threads_change_pct: 100, new_listings: 3, new_listings_previous: 3, threads_per_listing: 2,
    },
    {
      key: "unknown", label: "Unknown", supply_live: 1, stores: 0, buyer_threads: 0, buyer_threads_previous: 0,
      buyer_threads_change_pct: null, new_listings: 0, new_listings_previous: 0, threads_per_listing: 0,
    },
  ],
  definitions: {
    demand: "Buyer threads + interests + Buying Agent requests in the window.",
    county: "The listing's county. Buyer conversations are counted by where the listing is.",
  },
};

export function listingDetailFixture(overrides: Row = {}): Row {
  return {
    generated_at: "2026-11-24T10:00:00Z",
    window: { from: "2026-10-25T10:00:00Z", to: "2026-11-24T10:00:00Z", days: 30 },
    truncated: false,
    listing: {
      id: "lst-1", name: "Samsung A15", category: "Phones", county: "Nairobi", seller_id: "seller-a",
      seller_name: "Amina Stores", price: 18000, status: "active", created_at: "2026-10-01T09:00:00Z",
      age_days: 54, lifetime_views_counter: 140,
    },
    totals: listingRow("lst-1", { name: "Samsung A15", viewers: 12, contacters: 5, negotiators: 2, view_to_contact_pct: 41.7, contact_to_deal_pct: 20 }),
    funnel: { viewers: 12, savers_or_likers: 4, contacters: 5, negotiators: 2, deals_agreed: 1, deals_completed: 1 },
    deals_by_status: { released: 1, cancelled: 1 },
    daily: [
      { date: "2026-11-22", views: 3, saves: 1, likes: 0, contacts: 1, negotiations: 1, deals: 0, completed: 0 },
      { date: "2026-11-23", views: 5, saves: 0, likes: 1, contacts: 2, negotiations: 0, deals: 1, completed: 0 },
      { date: "2026-11-24", views: 4, saves: 1, likes: 0, contacts: 2, negotiations: 1, deals: 0, completed: 1 },
    ],
    snapshots: [
      { date: "2026-11-23", views: 130, likes: 3, interested_buyers: 4, sell_probability: 58 },
      { date: "2026-11-24", views: 140, likes: 4, interested_buyers: 5, sell_probability: 64 },
    ],
    category_position: { listings_compared: 9, viewers_rank: 2, median_contact_rate_pct: 20 },
    weights: { views: 1, saves: 2, likes: 2, contacts: 4, negotiations: 6, deals: 10 },
    definitions: {
      lifetime_views_counter: "The listing's own view counter since it was posted, guests and repeat views included.",
      snapshots: "Cumulative counts the nightly job recorded; a day it did not run has no point.",
    },
    ...overrides,
  };
}
