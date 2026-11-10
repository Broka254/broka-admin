"use client";

import { useEffect, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import { AlertSchema, AlertStatsSchema, type AlertListResponse } from "@/lib/api/schemas";

export type StreamStatus = "connected" | "connecting" | "offline";

const MAX_CONSECUTIVE_ERRORS = 3;
const POLL_INTERVAL_MS = 15_000;
// After falling back to polling, try the stream again: a backend deploy
// drops it for a minute, and the dashboard used to stay "Offline" (polling)
// until the page was reloaded.
const RETRY_STREAM_AFTER_MS = 60_000;
const STREAM_URL = "/api/broka/admin/alerts/stream";

type Connection = {
  refs: number;
  status: StreamStatus;
  listeners: Set<() => void>;
  dispose: () => void;
};

// One EventSource per QueryClient, shared by every component that asks for
// the stream (the shell and the Alert Centre each used to open their own).
const connections = new WeakMap<QueryClient, Connection>();

function openConnection(queryClient: QueryClient): Connection {
  const connection: Connection = { refs: 0, status: "connecting", listeners: new Set(), dispose: () => undefined };
  let source: EventSource | null = null;
  let errors = 0;
  let pollTimer: number | null = null;
  let retryTimer: number | null = null;
  let disposed = false;

  function setStatus(status: StreamStatus) {
    if (connection.status === status) return;
    connection.status = status;
    for (const listener of connection.listeners) listener();
  }

  function refreshAlerts() {
    void queryClient.invalidateQueries({ queryKey: ["broka-admin", "alerts"] });
    // A separate key, not a child of "alerts".
    void queryClient.invalidateQueries({ queryKey: ["broka-admin", "alerts-unread"] });
  }

  function startPollingFallback() {
    if (disposed) return;
    setStatus("offline");
    if (pollTimer === null) pollTimer = window.setInterval(refreshAlerts, POLL_INTERVAL_MS);
    if (retryTimer === null) {
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        errors = 0;
        connect();
      }, RETRY_STREAM_AFTER_MS);
    }
  }

  function stopPollingFallback() {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function connect() {
    if (disposed) return;
    try {
      source = new EventSource(STREAM_URL);
    } catch {
      source = null;
      startPollingFallback();
      return;
    }

    source.onopen = () => {
      if (disposed) return;
      errors = 0;
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
      errors += 1;
      if (errors >= MAX_CONSECUTIVE_ERRORS) {
        source?.close();
        source = null;
        startPollingFallback();
      } else {
        setStatus("connecting");
      }
    };
  }

  connection.dispose = () => {
    disposed = true;
    stopPollingFallback();
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
    source?.close();
    source = null;
  };

  connect();
  return connection;
}

// Live alert stream over the same-origin SSE proxy. Must never crash SSR:
// EventSource only exists in the browser, so the connection is opened inside
// an effect guarded by `typeof window`.
export function useAlertsStream(enabled = true): { status: StreamStatus } {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StreamStatus>("connecting");

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") {
      setStatus("offline");
      return;
    }
    let connection = connections.get(queryClient);
    if (!connection) {
      connection = openConnection(queryClient);
      connections.set(queryClient, connection);
    }
    const shared = connection;
    shared.refs += 1;
    const sync = () => setStatus(shared.status);
    shared.listeners.add(sync);
    sync();
    return () => {
      shared.listeners.delete(sync);
      shared.refs -= 1;
      if (shared.refs === 0) {
        shared.dispose();
        if (connections.get(queryClient) === shared) connections.delete(queryClient);
      }
    };
  }, [queryClient, enabled]);

  return { status };
}
