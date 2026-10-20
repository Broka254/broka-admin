"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Send, ShieldAlert, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/primitives";
import type { CommunicationOut } from "@/lib/api/schemas";
import { useAudiencePreview } from "@/hooks/use-audience-preview";
import { canPublishWithPreview } from "@/lib/communications/audience";

export type ConsequentialActionType = "schedule" | "publish" | "cancel" | "complete" | "retry";

interface ConsequentialActionDialogProps {
  action: ConsequentialActionType;
  communication: CommunicationOut;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: { scheduledAt?: string; reason?: string; recipientIds?: string[] }) => Promise<void>;
  selectedRecipientIds?: string[];
}

export function ConsequentialActionDialog({
  action,
  communication,
  isOpen,
  onClose,
  onConfirm,
  selectedRecipientIds = [],
}: ConsequentialActionDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");
  const audiencePreview = useAudiencePreview({
    kind: communication.audience.kind,
    user_ids: communication.audience.user_ids ?? [],
  });

  useEffect(() => {
    if (isOpen && action === "publish") {
      void audiencePreview.requestPreview();
    }
  }, [action, audiencePreview.definitionKey, isOpen, audiencePreview.requestPreview]);

  const publishPreviewReady = canPublishWithPreview(
    audiencePreview.preview,
    audiencePreview.definitionKey,
  );

  if (!isOpen) return null;

  async function handleConfirm() {
    setError(null);
    setBusy(true);
    try {
      if (action === "schedule") {
        if (!scheduledAt) {
          setError("Please select a future publication timestamp.");
          setBusy(false);
          return;
        }
        const scheduleDate = new Date(scheduledAt);
        if (isNaN(scheduleDate.getTime()) || scheduleDate <= new Date()) {
          setError("Publication time must be in the future.");
          setBusy(false);
          return;
        }
        if (communication.expires_at) {
          const expDate = new Date(communication.expires_at);
          if (scheduleDate >= expDate) {
            setError("Scheduled time must be before communication expiry.");
            setBusy(false);
            return;
          }
        }
        await onConfirm({ scheduledAt: scheduleDate.toISOString() });
      } else if (action === "publish") {
        if (!publishPreviewReady) {
          setError("A current, allowed audience preview is required before publication. The backend still revalidates the audience at publish time.");
          setBusy(false);
          return;
        }
        await onConfirm({});
      } else if (action === "cancel") {
        await onConfirm({ reason: reason.trim() || undefined });
      } else if (action === "complete") {
        await onConfirm({ reason: reason.trim() || undefined });
      } else if (action === "retry") {
        if (selectedRecipientIds.length === 0) {
          setError("Select at least one retry-eligible recipient from the ledger.");
          setBusy(false);
          return;
        }
        await onConfirm({ recipientIds: selectedRecipientIds });
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred while executing the action.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const config = {
    schedule: {
      title: "Schedule Communication",
      icon: <Clock size={20} className="text-cyan-300" />,
      confirmLabel: "Confirm Schedule",
      confirmStyle: "bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold",
      description: "Schedule this communication for automatic publication at the specified UTC timestamp.",
    },
    publish: {
      title: "Publish Communication Now",
      icon: <Send size={20} className="text-emerald-300" />,
      confirmLabel: "Publish Now",
      confirmStyle: "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold",
      description: "Publish this communication immediately. Once publishing begins, draft editing is permanently locked.",
    },
    cancel: {
      title: "Cancel Communication",
      icon: <AlertTriangle size={20} className="text-amber-300" />,
      confirmLabel: "Cancel Communication",
      confirmStyle: "bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold",
      description: "Cancel this scheduled or draft communication. Cancelled communications cannot be published.",
    },
    complete: {
      title: "Mark Communication Complete",
      icon: <CheckCircle2 size={20} className="text-indigo-300" />,
      confirmLabel: "Mark Complete",
      confirmStyle: "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold",
      description: communication.communication_type === "incident"
        ? "Complete the delivery campaign only. This does not resolve the operational incident; incident resolution remains an explicit authorized action that the backend does not yet expose."
        : "Mark this published communication as complete. Allowed only when all recipient delivery attempts have settled (no pending recipients).",
    },
    retry: {
      title: "Retry Failed Delivery",
      icon: <ShieldAlert size={20} className="text-rose-300" />,
      confirmLabel: `Retry Selected (${selectedRecipientIds.length})`,
      confirmStyle: "bg-rose-600 hover:bg-rose-500 text-white font-semibold",
      description: "Queue eligible failed recipients for retry. Dead tokens, permanently unregistered devices, and expired campaigns will not be retried.",
    },
  }[action];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#080a14] p-6 shadow-2xl">
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
            {config.icon}
          </div>
          <div>
            <h2 id="dialog-title" className="font-display text-lg font-semibold text-white">
              {config.title}
            </h2>
            <p className="text-xs text-slate-400">{communication.title}</p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-300">{config.description}</p>

        {action === "publish" && (
          <div className="mt-4 space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Target Audience</span>
              <span className="font-semibold text-slate-200">
                {String(communication.audience.kind ?? "all")}
                {communication.audience_count !== null ? ` (${communication.audience_count} resolved)` : ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Requested Channels</span>
              <span className="font-semibold text-slate-200">{communication.channels.join(", ")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Push Delivery Available</span>
              <StatusBadge tone={communication.push_available ? "success" : "warning"}>
                {communication.push_available ? "FCM Configured" : "FCM Not Configured"}
              </StatusBadge>
            </div>
            {!communication.push_available && communication.channels.includes("push") && (
              <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-2.5 text-[11px] text-amber-200">
                <AlertTriangle size={14} className="mb-0.5 inline mr-1" />
                Firebase Cloud Messaging is not configured on the backend. Push notifications will fail safely, but in-app announcements will still publish.
              </div>
            )}
            <div className="mt-2 rounded-lg border border-white/[0.07] bg-black/20 p-2.5 text-[11px] text-slate-400">
              {audiencePreview.loading ? (
                "Refreshing the current audience preview..."
              ) : audiencePreview.result ? (
                <>
                  Current preview: {audiencePreview.result.count.toLocaleString()} recipients
                  (maximum {audiencePreview.result.max_audience.toLocaleString()}).{" "}
                  {audiencePreview.result.allowed
                    ? "Preview is informational; the backend revalidates the audience and limits at publication."
                    : "This audience exceeds the configured maximum and cannot be published."}
                </>
              ) : (
                audiencePreview.error ?? "No current audience preview is available."
              )}
            </div>
          </div>
        )}

        {action === "schedule" && (
          <div className="mt-4 space-y-2">
            <label htmlFor="scheduled-at" className="block text-xs font-semibold text-slate-300">
              Future Publication Time (Local time converted to UTC)
            </label>
            <input
              id="scheduled-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-100 outline-none focus:border-[#8b75ff]"
            />
          </div>
        )}

        {(action === "cancel" || action === "complete") && (
          <div className="mt-4 space-y-2">
            <label htmlFor="reason" className="block text-xs font-semibold text-slate-300">
              Audit Reason (Optional, max 500 characters)
            </label>
            <input
              id="reason"
              type="text"
              maxLength={500}
              placeholder="e.g. Cancelled due to rescheduling / All impact restored"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-[#8b75ff]"
            />
          </div>
        )}

        {action === "retry" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs space-y-2">
              <p className="font-semibold text-slate-200">Targeted retry</p>
              <p className="text-slate-300">
                {selectedRecipientIds.length} eligible recipient{selectedRecipientIds.length === 1 ? "" : "s"} selected.
              </p>
              <p className="text-[11px] text-slate-500">
                Selection is limited to the current ledger page. Pagination or filter changes clear it so a hidden recipient is never retried accidentally.
              </p>
            </div>
            <p className="text-[11px] text-slate-500 leading-4">
              Retry queues the selected eligible recipients for another attempt; acceptance is not proof of delivery. Permanent errors and exhausted retry budgets are rejected by the backend.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/[0.07] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || (action === "publish" && !publishPreviewReady)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition ${config.confirmStyle} disabled:opacity-50`}
          >
            {busy && <CircleDashed size={14} className="animate-spin" />}
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
