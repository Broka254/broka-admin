import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cancelCommunication,
  createCommunication,
  previewAudience,
  retryRecipients,
} from "@/lib/api/communications";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("communications API client", () => {
  it("sends the backend idempotency header and JSON payload", async () => {
    const response = { id: "comm-1" };
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(response), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await createCommunication(
      {
        title: "Title",
        body: "Body",
        communication_type: "announcement",
        severity: "normal",
        audience: { kind: "all", user_ids: [] },
        channels: ["in_app"],
        deep_link: null,
      },
      "idempotency-key-123",
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/broka/admin/communications");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Idempotency-Key": "idempotency-key-123",
    });
    expect(init.headers).not.toHaveProperty("Idempotency-Key");
  });

  it("forwards an abort signal for preview requests", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      kind: "all",
      count: 1,
      max_audience: 100,
      allowed: true,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await previewAudience({ kind: "all", user_ids: [] }, controller.signal);
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal);
  });

  it("maps backend errors to AdminRequestError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      code: "conflict",
      message: "Version changed",
    }), { status: 409 })));
    await expect(cancelCommunication("comm-1", "reason", "key-123456")).rejects.toMatchObject({
      name: "AdminRequestError",
      status: 409,
      code: "conflict",
      message: "Version changed",
    });
  });

  it("treats an omitted reason as an empty JSON object, not an omitted body", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      id: "comm-1",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await cancelCommunication("comm-1", undefined, "key-123456");
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBe("{}");
  });

  it("never sends a retry without an explicit non-empty recipient selection", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      retried: 0,
      message: "Eligible recipients were queued for retry",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    // The backend treats an omitted recipient_ids list as "retry every eligible
    // recipient", so the client must refuse to make that request at all.
    await expect(retryRecipients("comm-1", [], "key-123456")).rejects.toMatchObject({
      name: "AdminRequestError",
      status: 400,
      code: "empty_retry_selection",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the explicit recipient selection with the retry request", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      retried: 2,
      message: "Eligible recipients were queued for retry",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await retryRecipients("comm-1", ["r1", "r2"], "key-123456");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/broka/admin/communications/comm-1/recipients/retry");
    expect(JSON.parse(init.body as string)).toEqual({ recipient_ids: ["r1", "r2"] });
    expect(init.headers).toMatchObject({ "X-Idempotency-Key": "key-123456" });
  });
});
