"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { AlertSchema, AlertStatsSchema, type AlertListResponse } from "@/lib/api/schemas";

export type StreamStatus = "connected" | "connecting" | "offline";

const MAX_CONSECUTIVE_ERRORS = 3;
const POLL_INTERVAL_MS = 15_000;

// Live alert stream over the same-origin SSE proxy. Must never crash SSR:
// EventSource only exists in the browser, so the connection is opened inside
// an effect guarded by `typeof window`.
export function useAlertsStream(): { status: StreamStatus } {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const errorsRef = useRef(0);
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      setStatus("offline");
      return;
    }

    let source: EventSource | null = null;
    let disposed = false;

    function startPollingFallback() {
      if (pollTimerRef.current !== null || disposed) return;
      setStatus("offline");
      pollTimerRef.current = window.setInterval(() => {
        void queryClient.invalidateQueries({ queryKey: ["broka-admin", "alerts"] });
      }, POLL_INTERVAL_MS);
    }

    function stopPollingFallback() {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    try {
      source = new EventSource("/api/broka/admin/alerts/stream");
    } catch {
      errorsRef.current = MAX_CONSECUTIVE_ERRORS;
      startPollingFallback();
      return () => {
        disposed = true;
        stopPollingFallback();
      };
    }

    source.onopen = () => {
      if (disposed) return;
      errorsRef.current = 0;
      stopPollingFallback();
      setStatus("connected");
    };

    source.addEventListener("alert", (event) => {
      if (disposed) return;
      let data: unknown;
      try {
        data = JSON.parse((event as MessageEvent).data);
      } catch {
        return;
      }
      const parsed = AlertSchema.safeParse(data);
      if (!parsed.success) return;
      const alert = parsed.data;
      queryClient.setQueriesData<AlertListResponse>(
        { queryKey: ["broka-admin", "alerts"] },
        (old) => {
          if (!old) return old;
          if (old.items.some((item) => item.id === alert.id)) return old;
          return { ...old, items: [alert, ...old.items], unread: old.unread + 1 };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["broka-admin", "alerts-unread"] });
    });

    source.addEventListener("stats", (event) => {
      if (disposed) return;
      let data: unknown;
      try {
        data = JSON.parse((event as MessageEvent).data);
      } catch {
        return;
      }
      const parsed = AlertStatsSchema.safeParse(data);
      if (!parsed.success) return;
      queryClient.setQueryData<number>(["broka-admin", "alerts-unread"], parsed.data.unread);
    });

    source.onerror = () => {
      if (disposed) return;
      errorsRef.current += 1;
      if (errorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        source?.close();
        source = null;
        startPollingFallback();
      } else {
        setStatus("connecting");
      }
    };

    return () => {
      disposed = true;
      stopPollingFallback();
      source?.close();
      source = null;
    };
  }, [queryClient]);

  return { status };
}
