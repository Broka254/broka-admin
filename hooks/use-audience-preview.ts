"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { previewAudience } from "@/lib/api/communications";
import type { AudienceIn, AudiencePreviewOut } from "@/lib/api/schemas";
import {
  audienceValidationError,
  audienceDefinitionKey,
  isAudiencePreviewCurrent,
  normalizeAudienceDefinition,
  type AudiencePreviewSnapshot,
} from "@/lib/communications/audience";

export function useAudiencePreview(audience: AudienceIn) {
  const userIdsSignature = JSON.stringify(audience.user_ids ?? []);
  const normalized = useMemo(
    () => normalizeAudienceDefinition(audience.kind, JSON.parse(userIdsSignature) as string[]),
    // The primitive signature keeps callers that construct an audience object
    // inline from restarting the request on every render.
    [audience.kind, userIdsSignature],
  );
  const definitionKey = useMemo(() => audienceDefinitionKey(normalized), [normalized]);
  const definitionKeyRef = useRef(definitionKey);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [snapshot, setSnapshot] = useState<AudiencePreviewSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    definitionKeyRef.current = definitionKey;
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setSnapshot(null);
    setError(null);
    setLoading(false);
  }, [definitionKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const requestPreview = useCallback(async () => {
    const currentId = ++requestIdRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    setSnapshot(null);
    setLoading(false);

    const validationError = audienceValidationError(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const result = await previewAudience(normalized, controller.signal);
      if (
        requestIdRef.current !== currentId ||
        definitionKeyRef.current !== definitionKey
      ) {
        return;
      }
      const next: AudiencePreviewSnapshot = { definitionKey, result };
      setSnapshot(next);
      if (!result.allowed) {
        setError(
          `This audience resolves to ${result.count.toLocaleString()} recipients, above the configured maximum of ${result.max_audience.toLocaleString()}.`,
        );
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      if (requestIdRef.current !== currentId || definitionKeyRef.current !== definitionKey) return;
      setSnapshot(null);
      setError(err instanceof Error ? err.message : "Failed to preview audience count.");
    } finally {
      if (requestIdRef.current === currentId) {
        setLoading(false);
      }
    }
  }, [definitionKey, normalized]);

  const preview: AudiencePreviewSnapshot | null = isAudiencePreviewCurrent(snapshot, definitionKey)
    ? snapshot
    : null;

  return {
    definitionKey,
    preview,
    result: preview ? (preview.result as AudiencePreviewOut) : null,
    loading,
    error,
    requestPreview,
  };
}
