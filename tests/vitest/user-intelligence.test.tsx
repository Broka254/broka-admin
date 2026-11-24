import { render, screen } from "@testing-library/react";
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/analytics/users",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-admin-resource", () => ({
  AdminRequestError: class AdminRequestError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  isEndpointMissing: () => false,
  useAdminResource: vi.fn(),
}));
vi.mock("@/hooks/use-timeseries", () => ({ useTimeseries: vi.fn() }));
vi.mock("@/hooks/use-user-intelligence", () => ({ useActivityUsers: vi.fn() }));
vi.mock("@/hooks/use-url-date-range", () => ({ useUrlDateRange: vi.fn() }));

import { AdminRequestError, useAdminResource } from "@/hooks/use-admin-resource";
import { useTimeseries } from "@/hooks/use-timeseries";
import { useActivityUsers } from "@/hooks/use-user-intelligence";
import { useUrlDateRange } from "@/hooks/use-url-date-range";
import { UserIntelligenceView } from "@/components/dashboard/user-intelligence/user-intelligence-view";

const live = {
  generated_at: "2026-11-24T10:00:00Z",
  presence_window_seconds: 300,
  active_users_now: 4,
  active_sessions_now: 5,
  active_users: { last_5m: 4, last_15m: 6, last_60m: 9 },
  registered_users: 120,
  active_user_percentage: { last_5m: 3.33, last_15m: 5, last_60m: 7.5 },
  peak_concurrent_users_24h: { value: 11, sampled_at: "2026-11-24T08:00:00Z", sample_interval_seconds: 60, samples_in_window: 1440 },
  coverage_started_on: "2026-11-24",
};

const engagement = {
  from: "2026-10-26T00:00:00Z",
  to: "2026-11-25T00:00:00Z",
  as_of_date: "2026-11-24",
  dau: 10,
  wau: 25,
  mau: 60,
  dau_mau_ratio: 0.1667,
  active_users_in_range: 70,
  eligible_registered_users: 120,
  active_user_percentage: 58.33,
  new_active_users: 20,
  returning_active_users: 50,
  sessions_started_in_range: 300,
  closed_sessions_in_range: 280,
  average_session_foreground_seconds: 540.5,
  median_session_foreground_seconds: 300,
  median_sample_truncated: false,
  average_daily_active_seconds_per_user: 1200,
  coverage_started_on: "2026-11-01",
};

function ok(data: unknown) {
  return { data, isLoading: false, isError: false, error: null };
}

beforeEach(() => {
  vi.mocked(useUrlDateRange).mockReturnValue([
    { from: "2026-10-26", to: "2026-11-25", bucket: "day" },
    vi.fn(),
  ] as unknown as ReturnType<typeof useUrlDateRange>);
  vi.mocked(useAdminResource).mockImplementation(((resource: string) => {
    if (resource === "activityLive") return ok(live);
    if (resource === "activityEngagement") return ok(engagement);
    if (resource === "activityRetention") return ok({ from: "", to: "", horizons_days: [1, 7, 30], coverage_started_on: null, cohorts: [] });
    return ok(undefined);
  }) as never);
  vi.mocked(useTimeseries).mockReturnValue(ok({
    from: "2026-11-23", to: "2026-11-25", bucket: "day",
    coverage: { active_users_started_on: "2026-11-24" },
    series: { active_users: [
      { t: "2026-11-23T00:00:00Z", v: null },
      { t: "2026-11-24T00:00:00Z", v: 7 },
    ] },
  }) as never);
  vi.mocked(useActivityUsers).mockReturnValue(ok({ rows: [], total: null }) as never);
});

describe("UserIntelligenceView", () => {
  it("shows the live figures and what each one counts", () => {
    render(<UserIntelligenceView />);
    expect(screen.getByText("Active accounts now")).toBeInTheDocument();
    expect(screen.getByText("Peak concurrent, 24 h")).toBeInTheDocument();
    expect(screen.getByText("DAU")).toBeInTheDocument();
    expect(screen.getByText("New vs returning")).toBeInTheDocument();
  });

  it("keeps unmeasured days out of the count and says how many were measured", () => {
    render(<UserIntelligenceView />);
    expect(screen.getByText(/1 of 2 days measured\./)).toBeInTheDocument();
    expect(screen.getByTestId("active-users-trend")).toBeInTheDocument();
  });

  it("reads a missing backend endpoint as a pending upgrade, not as an error", () => {
    vi.mocked(useAdminResource).mockImplementation(((resource: string) => {
      if (resource === "activityEngagement") {
        return { data: undefined, isLoading: false, isError: true, error: new AdminRequestError("not found", 404) };
      }
      if (resource === "activityLive") return ok(live);
      return ok(undefined);
    }) as never);
    render(<UserIntelligenceView />);
    expect(screen.getByText(/needs the upgraded backend/)).toBeInTheDocument();
  });

  it("does not turn a missing filtered total into the page length", () => {
    render(<UserIntelligenceView />);
    expect(screen.getByText("No accounts match this search.")).toBeInTheDocument();
    expect(screen.getByText(/filtered total unavailable/)).toBeInTheDocument();
  });

  it("links each account to its record", () => {
    vi.mocked(useActivityUsers).mockReturnValue(ok({
      rows: [{
        id: "u1",
        name: "Amina",
        account_type: "buyer",
        registered_at: "2026-10-01T00:00:00Z",
        last_seen: "2026-11-24T09:58:00Z",
        is_online: true,
        presence_label: "Active now",
        listings: 2,
        sessions_30d: 3,
        active_days_30d: 4,
        foreground_seconds_30d: 3900,
        is_flagged: false,
        is_admin: false,
        trust_score: 100,
      }],
      total: 1,
    }) as never);
    render(<UserIntelligenceView />);
    // The table renders a desktop row and a mobile card for each account, so the
    // same link and duration can appear twice. Both must point at the record.
    for (const link of screen.getAllByRole("link", { name: "Amina" })) {
      expect(link).toHaveAttribute("href", "/users/u1");
    }
    expect(screen.getAllByText("1h 05m").length).toBeGreaterThan(0);
  });
});
