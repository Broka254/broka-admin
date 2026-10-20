// @vitest-environment node

import { describe, expect, it } from "vitest";

import { MAX_PROXY_PAYLOAD_BYTES, readBoundedJsonBody } from "@/lib/http/bounded-body";

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe("bounded proxy request bodies", () => {
  it("accepts an ordinary JSON request", async () => {
    const request = new Request("http://localhost/api/broka/admin/communications/preview", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "31" },
      body: JSON.stringify({ audience: { kind: "all" } }),
    });
    const result = await readBoundedJsonBody(request);
    expect(result).toMatchObject({
      ok: true,
      value: { audience: { kind: "all" } },
    });
  });

  it("enforces the actual streamed byte count when content-length is absent", async () => {
    const bytes = new Uint8Array(MAX_PROXY_PAYLOAD_BYTES + 1);
    const request = new Request("http://localhost/api/broka/admin/communications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: bytes,
    });
    expect(request.headers.get("content-length")).toBeNull();
    const result = await readBoundedJsonBody(request);
    expect(result).toMatchObject({ ok: false, status: 413, code: "payload_too_large" });
  });

  it("does not trust a misleading content-length header", async () => {
    const request = new Request("http://localhost/api/broka/admin/communications", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "10" },
      body: streamOf(new Uint8Array(MAX_PROXY_PAYLOAD_BYTES + 5)),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const result = await readBoundedJsonBody(request);
    expect(result).toMatchObject({ ok: false, status: 413, code: "payload_too_large" });
  });

  it("rejects malformed content-length safely", async () => {
    const request = new Request("http://localhost/api/broka/admin/communications", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "-5" },
      body: "{}",
    });
    const result = await readBoundedJsonBody(request);
    expect(result).toMatchObject({ ok: false, status: 400, code: "invalid_content_length" });
  });

  it("rejects malformed JSON and unsupported media types", async () => {
    const malformed = new Request("http://localhost/api/broka/admin/communications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    expect(await readBoundedJsonBody(malformed)).toMatchObject({
      ok: false,
      status: 400,
      code: "invalid_json",
    });

    const unsupported = new Request("http://localhost/api/broka/admin/communications", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    expect(await readBoundedJsonBody(unsupported)).toMatchObject({
      ok: false,
      status: 415,
      code: "unsupported_content_type",
    });
  });
});

