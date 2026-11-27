"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { SkeletonPanel } from "@/components/ui/primitives";
import { JarvisRequestError } from "@/hooks/use-jarvis";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { ZenoConversationSummary } from "@/lib/api/jarvis-schemas";
import { ERROR_COPY, formatUtc, jarvisErrorKind, type JarvisErrorKind } from "@/lib/jarvis/presentation";
import { relativeTime } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

import { JarvisNotice } from "@/components/jarvis/readiness";

function errorKindOf(error: unknown): JarvisErrorKind {
  return error instanceof JarvisRequestError ? jarvisErrorKind(error.code, error.status) : "error";
}

function turnsLabel(count: number) {
  return `${count} turn${count === 1 ? "" : "s"}`;
}

/** Confirms a deletion. It is a dialog, so Escape cancels and focus returns to the trigger. */
function DeleteConfirmation({
  target,
  busy,
  error,
  onCancel,
  onConfirm,
  trapFocus,
}: {
  target: ZenoConversationSummary;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  trapFocus: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(trapFocus, () => {
    if (!busy) onCancel();
  });

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="jarvis-delete-title"
        aria-describedby="jarvis-delete-body"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.preventDefault();
            onCancel();
          }
        }}
        className="drawer-panel w-full max-w-md rounded-2xl border border-rose-400/25 bg-[#080a14] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
      >
        <h3 id="jarvis-delete-title" className="font-display text-base font-bold text-white">
          Delete this investigation?
        </h3>
        <p id="jarvis-delete-body" className="mt-2 text-sm leading-6 text-slate-400">
          “{target.title}” and its {turnsLabel(target.turn_count)} will be removed from your history. This cannot be
          undone.
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-xs text-rose-200">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="focus-ring rounded-lg border border-white/12 px-3.5 py-2 text-sm! font-semibold text-slate-200 hover:border-white/25 disabled:opacity-50"
          >
            Keep investigation
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="focus-ring rounded-lg border border-rose-400/40 bg-rose-500/15 px-3.5 py-2 text-sm! font-semibold text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete investigation"}
          </button>
        </div>
      </div>
    </div>
  );
}

export type ConversationHistoryProps = {
  summaries: ZenoConversationSummary[];
  total: number | null;
  activeId: string | null;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: unknown;
  onLoadMore: () => void;
  onSelect: (conversationId: string) => void;
  onNew: () => void;
  onDelete: (conversationId: string) => Promise<void>;
  /** False inside the mobile drawer, which already keeps focus inside itself. */
  trapDeleteFocus: boolean;
  headingId?: string;
  className?: string;
};

/**
 * The administrator's own investigations, newest first. Titles, timestamps
 * and turn counts come from the backend. Nothing is kept in browser storage.
 */
export function ConversationHistory({
  summaries,
  total,
  activeId,
  loading,
  error,
  onRetry,
  hasMore,
  loadingMore,
  loadMoreError,
  onLoadMore,
  onSelect,
  onNew,
  onDelete,
  trapDeleteFocus,
  headingId = "jarvis-history-title",
  className,
}: ConversationHistoryProps) {
  const [pendingDelete, setPendingDelete] = useState<ZenoConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    } catch (failure) {
      setDeleteError(ERROR_COPY[errorKindOf(failure)].body);
    } finally {
      setDeleting(false);
    }
  }

  const count = total ?? summaries.length;

  return (
    <section aria-labelledby={headingId} className={cn("data-panel flex min-h-0 flex-col p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold text-slate-100">
            Investigation history
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {loading && summaries.length === 0 ? "Loading" : `${count} saved`}
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#8b75ff]/30 bg-[#8b75ff]/10 px-2.5 py-1.5 text-xs! font-semibold text-[#ded8ff] hover:border-[#8b75ff]/55"
        >
          <Plus size={12} aria-hidden="true" />
          New
        </button>
      </div>

      <div className="scroll-thin mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {loading && summaries.length === 0 ? (
          <div aria-busy="true">
            <p className="sr-only" role="status">
              Loading your investigations
            </p>
            <SkeletonPanel rows={2} />
          </div>
        ) : error && summaries.length === 0 ? (
          <JarvisNotice kind={errorKindOf(error)} onRetry={onRetry} />
        ) : summaries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm leading-6 text-slate-500">
            No investigations yet. Ask Zeno a question to start one. It will be saved here.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Investigations">
            {summaries.map((conversation) => {
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id}>
                  <div
                    className={cn(
                      "group flex items-start gap-2 rounded-xl border px-3 py-2.5 transition",
                      active
                        ? "border-[#8b75ff]/45 bg-[#8b75ff]/10"
                        : "border-white/[0.07] bg-white/[0.015] hover:border-white/15",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(conversation.id)}
                      aria-current={active ? "true" : undefined}
                      title={`Last updated ${formatUtc(conversation.updated_at)}`}
                      className="focus-ring min-w-0 flex-1 rounded-md text-left"
                    >
                      <span className="block truncate text-sm font-medium text-slate-100">
                        {conversation.title || "Untitled investigation"}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {turnsLabel(conversation.turn_count)} · updated {relativeTime(conversation.updated_at)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setPendingDelete(conversation);
                      }}
                      aria-label={`Delete investigation: ${conversation.title || "Untitled investigation"}`}
                      className="focus-ring shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-200"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore ? (
          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs! font-semibold text-slate-300 hover:text-white disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more investigations"}
            </button>
            {loadMoreError ? (
              <p role="alert" className="text-xs text-rose-200">
                {ERROR_COPY[errorKindOf(loadMoreError)].body}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {pendingDelete ? (
        <DeleteConfirmation
          target={pendingDelete}
          busy={deleting}
          error={deleteError}
          trapFocus={trapDeleteFocus}
          onCancel={() => {
            if (!deleting) setPendingDelete(null);
          }}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </section>
  );
}

/** The history on narrow screens, opened from the investigation header. */
export function HistoryDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const drawerRef = useFocusTrap<HTMLElement>(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px] lg:hidden"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Investigation history"
        className="drawer-panel flex h-full w-full max-w-md flex-col border-l border-[#8b75ff]/25 bg-[#080a14] shadow-[-30px_0_90px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a895ff]">Jarvis Mode</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close investigation history"
            className="focus-ring rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-4">{children}</div>
      </aside>
    </div>
  );
}
