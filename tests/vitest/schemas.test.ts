import { describe, expect, it } from "vitest";

import {
  CommunicationCreateInSchema,
  CommunicationDetailSchema,
  CommunicationListSchema,
  CommunicationOutSchema,
  CommunicationStatsSchema,
  CommunicationUpdateInSchema,
  DeliverySummaryOutSchema,
  RecipientOutSchema,
  RecipientPageSchema,
  RetryInSchema,
  WorkerDiagnosticsSchema,
} from "@/lib/api/schemas";

const communication = {
  id: "comm-1",
  title: "Planned maintenance",
  body: "The API will be briefly unavailable.",
  communication_type: "maintenance",
  severity: "high",
  status: "published",
  audience: { kind: "buyers", user_ids: [] },
  channels: ["in_app", "push"],
  audience_count: 12,
  deep_link: "https://broka.co.ke/communications",
  created_by_id: "admin-1",
  updated_by_id: "admin-1",
  version: 2,
  created_at: "2026-01-15T09:30:00.000Z",
  updated_at: "2026-01-15T09:31:00.000Z",
  scheduled_at: null,
  published_at: "2026-01-15T09:32:00.000Z",
  completed_at: null,
  cancelled_at: null,
  expires_at: "2026-01-16T09:32:00.000Z",
  push_available: true,
  warnings: [],
};

const delivery = {
  total_recipients: 12,
  read_count: 5,
  by_status: { provider_accepted: 8, delivered: 3, failed: 1 },
  devices_by_status: { provider_accepted: 9, failed: 2 },
  provider_accepted: 8,
  confirmed_delivered: 3,
  failed: 1,
  retry_scheduled: 0,
  pending: 0,
};

const recipient = {
  id: "recipient-1",
  user_id: "user-1",
  status: "retry_scheduled",
  attempt_count: 2,
  last_attempt_at: "2026-01-15T09:35:00.000Z",
  provider_message_id: null,
  delivered_at: null,
  read_at: null,
  failure_category: "provider_transient",
  retry_eligible: true,
  next_attempt_at: "2026-01-15T09:40:00.000Z",
};

const lastPass = {
  last_pass_at: "2026-01-15T09:40:00.000Z",
  last_pass_seconds: 1.25,
  communications_claimed: 1,
  communications_published: 1,
  recipients_resolved: 12,
  recipients_claimed: 12,
  messages_attempted: 14,
  provider_accepted: 9,
  confirmed_delivered: 3,
  failures: 2,
  retries_scheduled: 0,
  retries_exhausted: 2,
};

describe("communications runtime contracts", () => {
  it("parses representative valid backend responses", () => {
    expect(CommunicationOutSchema.safeParse(communication).success).toBe(true);
    expect(CommunicationDetailSchema.safeParse({ communication, delivery }).success).toBe(true);
    expect(
      CommunicationListSchema.safeParse({ items: [communication], total: 1, limit: 15, offset: 0 })
        .success,
    ).toBe(true);
    expect(RecipientPageSchema.safeParse({ items: [recipient], total: 1, limit: 20, offset: 0 }).success).toBe(true);
    expect(CommunicationStatsSchema.safeParse({
      communication_id: communication.id,
      status: communication.status,
      audience_count: 12,
      delivery,
      generated_at: "2026-01-15T09:41:00.000Z",
    }).success).toBe(true);
  });

  it("rejects unsupported finite values instead of accepting contract drift", () => {
    expect(CommunicationOutSchema.safeParse({ ...communication, communication_type: "app_release" }).success).toBe(false);
    expect(CommunicationOutSchema.safeParse({ ...communication, severity: "urgent" }).success).toBe(false);
    expect(CommunicationOutSchema.safeParse({ ...communication, status: "resolved" }).success).toBe(false);
    expect(CommunicationOutSchema.safeParse({ ...communication, channels: ["in_app", "email"] }).success).toBe(false);
    expect(CommunicationOutSchema.safeParse({ ...communication, audience: { kind: "customers" } }).success).toBe(false);
    expect(RecipientOutSchema.safeParse({ ...recipient, status: "device_seen" }).success).toBe(false);
    expect(RecipientOutSchema.safeParse({ ...recipient, failure_category: "raw_provider_exception" }).success).toBe(false);
  });

  it("validates counters, pagination, and status-map keys", () => {
    expect(DeliverySummaryOutSchema.safeParse({ ...delivery, provider_accepted: -1 }).success).toBe(false);
    expect(DeliverySummaryOutSchema.safeParse({ ...delivery, by_status: { mystery: 1 } }).success).toBe(false);
    expect(
      CommunicationListSchema.safeParse({ items: [], total: -1, limit: 15, offset: 0 }).success,
    ).toBe(false);
    expect(
      CommunicationListSchema.safeParse({ items: [], total: 0, limit: 201, offset: 0 }).success,
    ).toBe(false);
  });

  it("accepts null to clear expiry and rejects invalid timestamp values", () => {
    const update = { expires_at: null };
    expect(CommunicationUpdateInSchema.safeParse(update).success).toBe(true);
    expect(CommunicationUpdateInSchema.safeParse({ expires_at: "tomorrow" }).success).toBe(false);
    expect(CommunicationCreateInSchema.safeParse({
      title: "Title",
      body: "Body",
      communication_type: "announcement",
      audience: { kind: "all", user_ids: [] },
      channels: ["in_app"],
      expires_at: null,
    }).success).toBe(true);
  });

  it("keeps request and response validation separate for retry payloads", () => {
    expect(RetryInSchema.safeParse({ recipient_ids: ["recipient-1"] }).success).toBe(true);
    expect(RetryInSchema.safeParse({ recipient_ids: [] }).success).toBe(false);
  });

  it("validates documented worker diagnostics fields", () => {
    const diagnostics = {
      generated_at: "2026-01-15T09:41:00.000Z",
      worker: {
        mode: "database_scheduled_loop",
        sweep_seconds: 15,
        claim_seconds: 60,
        recipient_batch: 100,
        provider_concurrency: 8,
        provider_timeout_seconds: 10,
        retention_days: 30,
        last_pass: lastPass,
      },
      backlog: {
        communications: { published: 1 },
        recipients: { retry_scheduled: 2 },
        pending_recipients: 2,
      },
    };
    expect(WorkerDiagnosticsSchema.safeParse(diagnostics).success).toBe(true);
    expect(
      WorkerDiagnosticsSchema.safeParse({
        ...diagnostics,
        worker: { ...diagnostics.worker, mode: "unknown_worker" },
      }).success,
    ).toBe(false);
    expect(
      WorkerDiagnosticsSchema.safeParse({
        ...diagnostics,
        backlog: { ...diagnostics.backlog, recipients: { mystery: 2 } },
      }).success,
    ).toBe(false);
  });
});

