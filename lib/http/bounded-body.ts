export const MAX_PROXY_PAYLOAD_BYTES = 512 * 1024;

export type BoundedJsonFailure = {
  ok: false;
  status: 400 | 413 | 415;
  code:
    | "invalid_content_length"
    | "payload_too_large"
    | "unsupported_content_type"
    | "invalid_json";
  message: string;
};

export type BoundedJsonSuccess = {
  ok: true;
  value: unknown;
  bytesRead: number;
};

export type BoundedJsonResult = BoundedJsonSuccess | BoundedJsonFailure;

function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const mediaType = value.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json" || mediaType?.endsWith("+json") === true;
}

/**
 * Read an untrusted request body with a hard byte ceiling. The declared
 * Content-Length is only a fast-fail hint: the actual stream is always counted
 * and the reader is cancelled as soon as the limit is crossed.
 */
export async function readBoundedJsonBody(
  request: Request,
  maxBytes = MAX_PROXY_PAYLOAD_BYTES,
): Promise<BoundedJsonResult> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared.trim())) {
      return {
        ok: false,
        status: 400,
        code: "invalid_content_length",
        message: "The request Content-Length header is malformed.",
      };
    }
    if (Number(declared) > maxBytes) {
      return {
        ok: false,
        status: 413,
        code: "payload_too_large",
        message: "Request payload exceeds allowed limit.",
      };
    }
  }

  const contentType = request.headers.get("content-type");
  if (contentType && !isJsonContentType(contentType)) {
    return {
      ok: false,
      status: 415,
      code: "unsupported_content_type",
      message: "Request payload must use application/json.",
    };
  }

  if (!request.body) {
    return {
      ok: false,
      status: 400,
      code: "invalid_json",
      message: "Request payload must contain valid JSON.",
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel();
        return {
          ok: false,
          status: 413,
          code: "payload_too_large",
          message: "Request payload exceeds allowed limit.",
        };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (bytesRead === 0) {
    return {
      ok: false,
      status: 400,
      code: "invalid_json",
      message: "Request payload must contain valid JSON.",
    };
  }
  if (!contentType) {
    return {
      ok: false,
      status: 415,
      code: "unsupported_content_type",
      message: "Request payload must use application/json.",
    };
  }

  const bytes = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text), bytesRead };
  } catch {
    return {
      ok: false,
      status: 400,
      code: "invalid_json",
      message: "Request payload must contain valid JSON.",
    };
  }
}

