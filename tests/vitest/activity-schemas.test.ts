import { describe, expect, it } from "vitest";

import { TimeseriesResponseSchema as BrowserTimeseriesSchema } from "@/lib/api/revenue";
import {
  ActivityEngagementSchema,
  ActivityLiveSchema,
  ActivityRetentionSchema,
  ActivityUserProfileSchema,
  ActivityUsersSchema,
  AdminResourceSchemas,
  TimeseriesResponseSchema,
  parseAdminResource,
} from "@/lib/api/schemas";

const live = {
  generated_at: "2026-11-24T10:00:00Z",
  presence_window_seconds: 300,
  active_users_now: 4,
  active_sessions_now: 5,
  active_users: { last_5m: 4, last_15m: 6, last_60m: 9 },
  registered_users: 120,
  active_user_percentage: { last_5m: 3.33, last_15m: 5, last_60m: 7.5 },
  peak_concurrent_users_24h: { value: 11, sampled_at: "2026-11-24T08:00:00Z", sample_interval_seconds: 60, samples_in_window: 1440 },
  coverage_started_on: "2026-11-01",
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
  coverage_started_on: null,
};

describe("activity contracts", () => {
  it("accepts the live, engagement and retention payloads", () => {
    expect(ActivityLiveSchema.parse(live).active_users_now).toBe(4);
    expect(ActivityEngagementSchema.parse(engagement).dau).toBe(10);
    expect(ActivityRetentionSchema.parse({
      from: "2026-10-01T00:00:00Z",
      to: "2026-10-03T00:00:00Z",
      horizons_days: [1, 7, 30],
      coverage_started_on: null,
      cohorts: [{
        cohort_date: "2026-10-01",
        registered: 3,
        d1_retained: 1, d1_pct: 33.33,
        d7_retained: null, d7_pct: null,
        d30_retained: null, d30_pct: null,
      }],
    }).cohorts[0].d7_pct).toBeNull();
  });

  it("accepts an account row and a profile, with nullable names and no contact fields", () => {
    const row = {
      id: "u1",
      name: null,
      account_type: "buyer",
      registered_at: "2026-10-01T00:00:00Z",
      last_seen: null,
      is_online: false,
      presence_label: "Recently active",
      listings: 0,
      sessions_30d: 0,
      active_days_30d: 0,
      foreground_seconds_30d: 0,
      is_flagged: false,
      is_admin: false,
      trust_score: 100,
    };
    expect(ActivityUsersSchema.parse([row])[0].id).toBe("u1");

    const profile = ActivityUserProfileSchema.parse({
      generated_at: "2026-11-24T10:00:00Z",
      user: { id: "u1", name: "Amina", account_type: "buyer", is_flagged: false, is_admin: false, registered_at: null, last_seen: null, is_online: false, presence_label: "Recently active" },
      totals: { sessions: 0, foreground_seconds: 0, first_session_at: null, last_active_at: null, active_days: 0, first_active_on: null },
      last_30_days: { active_days: 0, foreground_seconds: 0 },
      recent_sessions: [],
      daily: [],
    });
    expect(profile.user.name).toBe("Amina");
    expect("phone" in profile.user).toBe(false);
  });

  it("registers every activity resource with the proxy's response validation", () => {
    for (const resource of ["activityLive", "activityEngagement", "activityRetention", "activityUsers", "activityUserProfile"] as const) {
      expect(AdminResourceSchemas[resource]).toBeDefined();
    }
    expect(parseAdminResource("activityEngagement", engagement).mau).toBe(60);
  });

  it("accepts a null value in a timeseries bucket on both the proxy and the browser copy", () => {
    const payload = {
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-03T00:00:00Z",
      bucket: "day",
      coverage: { active_users_started_on: "2026-11-02" },
      series: {
        active_users: [
          { t: "2026-11-01T00:00:00Z", v: null },
          { t: "2026-11-02T00:00:00Z", v: 3 },
        ],
      },
    };
    expect(TimeseriesResponseSchema.parse(payload).series.active_users[0].v).toBeNull();
    expect(BrowserTimeseriesSchema.parse(payload).series.active_users[1].v).toBe(3);
  });

  it("still accepts an older timeseries response without coverage", () => {
    const older = { from: "a", to: "b", bucket: "day", series: { signups: [{ t: "x", v: 1 }] } };
    expect(TimeseriesResponseSchema.parse(older).coverage).toBeUndefined();
    expect(BrowserTimeseriesSchema.parse(older).series.signups[0].v).toBe(1);
  });

  it("rejects a non-numeric value that is neither a number nor null", () => {
    const bad = { from: "a", to: "b", bucket: "day", series: { signups: [{ t: "x", v: "3" }] } };
    expect(() => TimeseriesResponseSchema.parse(bad)).toThrow();
  });
});
