"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type { z } from "zod";

import {
  ZenoBriefingSchema,
  ZenoChatRequestSchema,
  ZenoChatResponseSchema,
  ZenoConversationDetailSchema,
  ZenoConversationListSchema,
  ZenoDeleteResultSchema,
  ZenoStatusSchema,
  type ZenoChatRequest,
  type ZenoChatResponse,
  type ZenoConversationDetail,
  type ZenoConversationList,
  type ZenoConversationSummary,
} from "@/lib/api/jarvis-schemas";
import { CONVERSATION_PAGE_SIZE, hasEarlierTurns, turnPageSpecs, type TurnPage } from "@/lib/jarvis/presentation";

// Browser access to Jarvis Mode. Every request goes through the same-origin
// proxy at /api/broka, never to the BROKA API directly. Every response is
// parsed with the shared schema here as well, so a payload that does not match
// the contract is refused before any view renders it.

export class JarvisRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, code: string, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "JarvisRequestError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRetryAfter(value: string | null): number | null {
  if (!value || !/^\d{1,5}$/.test(value.trim())) return null;
  return Number(value.trim());
}

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  query?: URLSearchParams;
  body?: unknown;
  signal?: AbortSignal;
};

async function jarvisRequest<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.output<S>> {
  const search = options.query?.toString() ?? "";
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`/api/broka/${path}${search ? `?${search}` : ""}`, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new JarvisRequestError(0, "network", "BROKA could not be reached. Check the connection and try again.");
  }

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const record = isRecord(payload) ? payload : {};
    const code = typeof record.code === "string" ? record.code : "upstream_error";
    const message = typeof record.message === "string" ? record.message : "Jarvis Mode could not complete this request.";
    throw new JarvisRequestError(response.status, code, message, parseRetryAfter(response.headers.get("retry-after")));
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new JarvisRequestError(502, "invalid_response", "The response did not match the Jarvis Mode contract.");
  }
  return parsed.data;
}

/** Retries a read once, and only for a transient failure. Disabled, forbidden and contract errors never retry. */
export function shouldRetryRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  return error instanceof JarvisRequestError && (error.status === 0 || error.code === "backend_unavailable");
}

export const jarvisKeys = {
  status: ["jarvis", "status"] as const,
  briefing: (windowDays: number) => ["jarvis", "briefing", windowDays] as const,
  conversations: ["jarvis", "conversations"] as const,
  turns: (conversationId: string, offset: number, limit: number) =>
    ["jarvis", "turns", conversationId, offset, limit] as const,
  turnsFor: (conversationId: string) => ["jarvis", "turns", conversationId] as const,
};

function turnPageRequest(conversationId: string, page: TurnPage, signal?: AbortSignal) {
  return jarvisRequest(
    `admin/zeno/conversations/${encodeURIComponent(conversationId)}`,
    ZenoConversationDetailSchema,
    { signal, query: new URLSearchParams({ offset: String(page.offset), limit: String(page.limit) }) },
  );
}

export function useJarvisStatus(enabled = true) {
  return useQuery({
    queryKey: jarvisKeys.status,
    queryFn: ({ signal }) => jarvisRequest("admin/zeno/status", ZenoStatusSchema, { signal }),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: shouldRetryRead,
  });
}

export function useJarvisBriefing(windowDays: number, enabled = true) {
  return useQuery({
    queryKey: jarvisKeys.briefing(windowDays),
    queryFn: ({ signal }) =>
      jarvisRequest("admin/zeno/briefing", ZenoBriefingSchema, {
        signal,
        query: new URLSearchParams({ window_days: String(windowDays) }),
      }),
    enabled,
    // The backend caches a briefing for about a minute; polling more often gains nothing.
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
    retry: shouldRetryRead,
  });
}

export function useJarvisConversations(enabled = true) {
  return useInfiniteQuery({
    queryKey: jarvisKeys.conversations,
    queryFn: ({ pageParam, signal }) =>
      jarvisRequest("admin/zeno/conversations", ZenoConversationListSchema, {
        signal,
        query: new URLSearchParams({ limit: String(CONVERSATION_PAGE_SIZE), offset: String(pageParam) }),
      }),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.offset + last.conversations.length;
      return last.conversations.length > 0 && next < last.total ? next : undefined;
    },
    enabled,
    staleTime: 15_000,
    retry: shouldRetryRead,
  });
}

function findSummary(
  data: InfiniteData<ZenoConversationList> | undefined,
  conversationId: string,
): ZenoConversationSummary | null {
  const pages = data?.pages ?? [];
  for (const page of pages) {
    const match = page.conversations.find((item) => item.id === conversationId);
    if (match) return match;
  }
  return null;
}

function useJarvisTurns(conversationId: string | null, total: number | null, earlierPages: number) {
  const pages = conversationId ? turnPageSpecs(total, earlierPages) : [];
  return useQueries({
    queries: pages.map((page) => ({
      queryKey: jarvisKeys.turns(conversationId as string, page.offset, page.limit),
      queryFn: ({ signal }: { signal: AbortSignal }) => turnPageRequest(conversationId as string, page, signal),
      retry: shouldRetryRead,
    })),
  });
}

export function useJarvisChat() {
  return useMutation({
    mutationFn: (input: ZenoChatRequest) =>
      jarvisRequest("admin/zeno/chat", ZenoChatResponseSchema, {
        method: "POST",
        body: ZenoChatRequestSchema.parse(input),
      }),
  });
}

export function useJarvisDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      jarvisRequest(`admin/zeno/conversations/${encodeURIComponent(conversationId)}`, ZenoDeleteResultSchema, {
        method: "DELETE",
      }),
    onSuccess: async (_result, conversationId) => {
      queryClient.removeQueries({ queryKey: jarvisKeys.turnsFor(conversationId) });
      await queryClient.invalidateQueries({ queryKey: jarvisKeys.conversations });
    },
  });
}

export type InvestigationState = {
  summaries: ZenoConversationSummary[];
  conversations: ReturnType<typeof useJarvisConversations>;
  activeId: string | null;
  active: ZenoConversationSummary | null;
  turns: ZenoConversationDetail["turns"];
  turnsLoading: boolean;
  turnsError: unknown;
  hasEarlierTurns: boolean;
  latest: ZenoChatResponse | null;
  pendingQuestion: string | null;
  isDeleting: boolean;
  deleteError: unknown;
  select: (conversationId: string) => void;
  startNew: () => void;
  loadEarlierTurns: () => void;
  ask: (message: string, windowDays: number) => Promise<ZenoChatResponse>;
  remove: (conversationId: string) => Promise<void>;
};

/**
 * The investigation workspace's state: which conversation is open, its turns
 * from the server (never a local copy), the answer just received, and the
 * question that is in flight.
 */
export function useJarvisInvestigation(enabled = true): InvestigationState {
  const queryClient = useQueryClient();
  const conversations = useJarvisConversations(enabled);
  const chat = useJarvisChat();
  const deletion = useJarvisDeleteConversation();
  const sendChat = chat.mutateAsync;
  const deleteConversation = deletion.mutateAsync;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [earlierPages, setEarlierPages] = useState(0);
  const [latest, setLatest] = useState<ZenoChatResponse | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const summaries = useMemo(
    () => (conversations.data?.pages ?? []).flatMap((page) => page.conversations),
    [conversations.data],
  );
  const active = summaries.find((item) => item.id === activeId) ?? null;
  const turnQueries = useJarvisTurns(activeId, active ? active.turn_count : null, earlierPages);
  const turns = turnQueries.flatMap((query) => query.data?.turns ?? []);
  const turnsLoading = turnQueries.some((query) => query.isPending);
  const turnsError = turnQueries.find((query) => query.error)?.error ?? null;

  const select = useCallback((conversationId: string) => {
    setActiveId(conversationId);
    setEarlierPages(0);
    setLatest(null);
  }, []);

  const startNew = useCallback(() => {
    setActiveId(null);
    setEarlierPages(0);
    setLatest(null);
  }, []);

  const loadEarlierTurns = useCallback(() => setEarlierPages((pages) => pages + 1), []);

  const ask = useCallback(
    async (message: string, windowDays: number) => {
      const text = message.trim();
      const target = activeId;
      setPendingQuestion(text);
      try {
        const response = await sendChat({
          conversation_id: target ?? undefined,
          message: text,
          context: { period_days: windowDays },
        });
        // Refresh the summaries first: the turn count they carry decides which
        // turn pages exist. Load the newest page before the pending question
        // is cleared, so the transcript never shows a gap.
        await queryClient.invalidateQueries({ queryKey: jarvisKeys.conversations });
        const refreshed = findSummary(
          queryClient.getQueryData<InfiniteData<ZenoConversationList>>(jarvisKeys.conversations),
          response.conversation_id,
        );
        if (refreshed) {
          await Promise.all(
            turnPageSpecs(refreshed.turn_count, 0).map((page) =>
              queryClient.fetchQuery({
                queryKey: jarvisKeys.turns(response.conversation_id, page.offset, page.limit),
                queryFn: ({ signal }) => turnPageRequest(response.conversation_id, page, signal),
              }),
            ),
          );
        }
        setLatest(response);
        setEarlierPages(0);
        setActiveId(response.conversation_id);
        return response;
      } finally {
        setPendingQuestion(null);
      }
    },
    [activeId, sendChat, queryClient],
  );

  const remove = useCallback(
    async (conversationId: string) => {
      await deleteConversation(conversationId);
      if (activeId === conversationId) {
        setActiveId(null);
        setEarlierPages(0);
        setLatest(null);
      }
    },
    [activeId, deleteConversation],
  );

  return {
    summaries,
    conversations,
    activeId,
    active,
    turns,
    turnsLoading,
    turnsError,
    hasEarlierTurns: hasEarlierTurns(active ? active.turn_count : null, earlierPages),
    latest: latest && latest.conversation_id === activeId ? latest : null,
    pendingQuestion,
    isDeleting: deletion.isPending,
    deleteError: deletion.error,
    select,
    startNew,
    loadEarlierTurns,
    ask,
    remove,
  };
}
