import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAudiencePreview } from "@/hooks/use-audience-preview";
import type { AudienceIn, AudiencePreviewOut } from "@/lib/api/schemas";
import {
  audienceValidationError,
  canPublishWithPreview,
  type AudiencePreviewSnapshot,
} from "@/lib/communications/audience";

vi.mock("@/lib/api/communications", () => ({
  previewAudience: vi.fn(),
}));

import { previewAudience } from "@/lib/api/communications";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const previewMock = vi.mocked(previewAudience);

function preview(count: number, allowed = true): AudiencePreviewOut {
  return { kind: "all", count, max_audience: 100, allowed };
}

beforeEach(() => {
  previewMock.mockReset();
});

describe("audience preview correctness", () => {
  it("ties a successful preview to the exact audience definition", async () => {
    previewMock.mockResolvedValue(preview(25));
    const { result } = renderHook(({ audience }) => useAudiencePreview(audience), {
      initialProps: { audience: { kind: "all", user_ids: [] } as AudienceIn },
    });

    await act(async () => {
      await result.current.requestPreview();
    });
    expect(result.current.result?.count).toBe(25);
    expect(canPublishWithPreview(result.current.preview, result.current.definitionKey)).toBe(true);
  });

  it("invalidates the previous preview when audience kind or explicit ids change", async () => {
    previewMock.mockResolvedValue(preview(25));
    const { result, rerender } = renderHook(({ audience }) => useAudiencePreview(audience), {
      initialProps: { audience: { kind: "all", user_ids: [] } as AudienceIn },
    });
    await act(async () => {
      await result.current.requestPreview();
    });
    expect(result.current.result?.count).toBe(25);

    rerender({ audience: { kind: "buyers", user_ids: [] } });
    await waitFor(() => expect(result.current.result).toBeNull());
    expect(canPublishWithPreview(result.current.preview, result.current.definitionKey)).toBe(false);

    rerender({ audience: { kind: "user_ids", user_ids: ["user-1"] } });
    expect(result.current.result).toBeNull();
  });

  it("ignores a stale asynchronous response after the definition changes", async () => {
    const first = deferred<AudiencePreviewOut>();
    const second = deferred<AudiencePreviewOut>();
    previewMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(({ audience }) => useAudiencePreview(audience), {
      initialProps: { audience: { kind: "all", user_ids: [] } as AudienceIn },
    });
    act(() => {
      void result.current.requestPreview();
    });

    rerender({ audience: { kind: "sellers", user_ids: [] } });
    act(() => {
      void result.current.requestPreview();
    });

    first.resolve({ ...preview(999), kind: "all" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.result).toBeNull();

    second.resolve({ ...preview(17), kind: "sellers" });
    await waitFor(() => expect(result.current.result?.count).toBe(17));
  });

  it("surfaces backend failures and maximum-audience violations", async () => {
    previewMock.mockRejectedValueOnce(new Error("The BROKA API is temporarily unavailable."));
    const { result } = renderHook(() => useAudiencePreview({ kind: "all", user_ids: [] }));
    await act(async () => {
      await result.current.requestPreview();
    });
    expect(result.current.error).toMatch(/temporarily unavailable/i);

    previewMock.mockResolvedValueOnce(preview(101, false));
    await act(async () => {
      await result.current.requestPreview();
    });
    expect(result.current.result?.allowed).toBe(false);
    expect(result.current.error).toMatch(/above the configured maximum/i);
    expect(canPublishWithPreview(result.current.preview, result.current.definitionKey)).toBe(false);
  });

  it("rejects an empty explicit-user audience before calling the backend", async () => {
    const audience: AudienceIn = { kind: "user_ids", user_ids: [] };
    expect(audienceValidationError(audience)).toMatch(/at least one user ID/i);

    const { result } = renderHook(() => useAudiencePreview(audience));
    await act(async () => {
      await result.current.requestPreview();
    });
    expect(previewMock).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/at least one user ID/i);
    expect(result.current.result).toBeNull();
  });

  it("rejects a stale snapshot as publication authorization", () => {
    const snapshot: AudiencePreviewSnapshot = {
      definitionKey: "old",
      result: preview(12, true),
    };
    expect(canPublishWithPreview(snapshot, "new")).toBe(false);
  });
});
