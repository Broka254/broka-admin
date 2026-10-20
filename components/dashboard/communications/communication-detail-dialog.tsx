"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  ExternalLink,
  Megaphone,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import {
  useAdminCommunicationDetail,
  useAdminCommunicationRecipients,
} from "@/hooks/use-admin-resource";
import {
  cancelCommunication,
  completeCommunication,
  publishCommunication,
  retryRecipients,
  scheduleCommunication,
} from "@/lib/api/communications";
import { StatusBadge } from "@/components/ui/primitives";
import type { CommunicationOut, RecipientOut } from "@/lib/api/schemas";
import { eligibleRecipientIds, recipientStatusLabel, toggleRetrySelection } from "@/lib/communications/recipients";
import { ConsequentialActionDialog, type ConsequentialActionType } from "./consequential-action-dialog";
import { DeliveryEvidenceGrid } from "./delivery-evidence";
import { IncidentLifecycleNotice } from "./incident-lifecycle-notice";

interface CommunicationDetailDialogProps {
  communicationId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEditDraft: (comm: CommunicationOut) => void;
  onRefreshOverview: () => void;
}

export function CommunicationDetailDialog({
  communicationId,
  isOpen,
  onClose,
  onEditDraft,
  onRefreshOverview,
}: CommunicationDetailDialogProps) {
  // Recipient table pagination & filter
  const [recipientStatusFilter, setRecipientStatusFilter] = useState<string>("all");
  const [recipientPage, setRecipientPage] = useState<number>(0);
  const pageSize = 20;

  // Selected recipient IDs for targeted retry
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

  // Action dialog state
  const [activeAction, setActiveAction] = useState<ConsequentialActionType | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    params.set("offset", String(recipientPage * pageSize));
    if (recipientStatusFilter !== "all") {
      params.set("status", recipientStatusFilter);
    }
    return params;
  }, [recipientPage, recipientStatusFilter]);

  const {
    data: detailData,
    isLoading: detailLoading,
    isError: detailIsError,
    error: detailError,
    refetch: refetchDetail,
  } = useAdminCommunicationDetail(communicationId ?? "", isOpen && Boolean(communicationId));

  const {
    data: recipientsData,
    isLoading: recipientsLoading,
    refetch: refetchRecipients,
  } = useAdminCommunicationRecipients(
    communicationId ?? "",
    queryParams,
    isOpen && Boolean(communicationId)
  );

  if (!isOpen || !communicationId) return null;

  const comm = detailData?.communication;
  const delivery = detailData?.delivery;

  async function handleConfirmAction(payload: { scheduledAt?: string; reason?: string; recipientIds?: string[] }) {
    if (!comm || !activeAction) return;
    const idempotencyKey = crypto.randomUUID();

    if (activeAction === "schedule" && payload.scheduledAt) {
      await scheduleCommunication(comm.id, payload.scheduledAt, idempotencyKey);
    } else if (activeAction === "publish") {
      await publishCommunication(comm.id, idempotencyKey);
    } else if (activeAction === "cancel") {
      await cancelCommunication(comm.id, payload.reason, idempotencyKey);
    } else if (activeAction === "complete") {
      await completeCommunication(comm.id, payload.reason, idempotencyKey);
    } else if (activeAction === "retry") {
      const result = await retryRecipients(comm.id, payload.recipientIds, idempotencyKey);
      setRetryNotice(
        `${result.retried} eligible recipient${result.retried === 1 ? "" : "s"} accepted for retry queuing. Retry acceptance is not delivery success; the ledger and statistics will refresh when the worker settles them.`,
      );
      setSelectedRecipientIds([]);
    }

    await refetchDetail();
    await refetchRecipients();
    onRefreshOverview();
  }

  function getStatusBadgeTone(status: string): "neutral" | "info" | "warning" | "success" | "danger" {
    switch (status) {
      case "draft":
        return "neutral";
      case "scheduled":
        return "info";
      case "publishing":
        return "warning";
      case "published":
      case "completed":
        return "success";
      case "cancelled":
        return "neutral";
      case "failed":
        return "danger";
      default:
        return "neutral";
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "incident":
        return <AlertTriangle size={15} className="text-amber-400" />;
      case "maintenance":
        return <Wrench size={15} className="text-cyan-400" />;
      case "product_update":
        return <Sparkles size={15} className="text-purple-400" />;
      default:
        return <Megaphone size={15} className="text-emerald-400" />;
    }
  }

  const isDraft = comm?.status === "draft";
  const isScheduled = comm?.status === "scheduled";
  const isPublished = comm?.status === "published";
  const visibleRecipients = recipientsData?.items ?? [];
  const eligibleOnPage = eligibleRecipientIds(visibleRecipients);

  function setRecipientPageAndClearSelection(nextPage: number) {
    setRecipientPage(Math.max(0, nextPage));
    setSelectedRecipientIds([]);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-sm" role="dialog" aria-modal="true">
        <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#080a14] p-5 sm:p-7 shadow-2xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>

          {detailLoading ? (
            <div className="py-24 text-center">
              <RefreshCw size={26} className="mx-auto animate-spin text-[#8b75ff]" />
              <p className="mt-3 text-xs text-slate-400">Loading communication record and delivery ledger...</p>
            </div>
          ) : detailIsError || !comm ? (
            <div className="py-12 text-center text-xs">
              <AlertCircle size={28} className="mx-auto text-rose-400" />
              <p className="mt-2 font-semibold text-rose-300">Unable to load communication record</p>
              <p className="mt-1 text-slate-400">
                {detailError instanceof Error ? detailError.message : "The requested record could not be retrieved."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="border-b border-white/[0.07] pb-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-slate-300">
                    {getTypeIcon(comm.communication_type)}
                    <span className="capitalize">{comm.communication_type.replace("_", " ")}</span>
                  </span>
                  <StatusBadge tone={comm.severity === "critical" ? "danger" : comm.severity === "high" ? "warning" : "info"}>
                    {comm.severity.toUpperCase()}
                  </StatusBadge>
                  <StatusBadge tone={comm.communication_type === "incident" && comm.status === "completed" ? "warning" : getStatusBadgeTone(comm.status)}>
                    {comm.communication_type === "incident" && comm.status === "completed"
                      ? "DELIVERY COMPLETE"
                      : comm.status.toUpperCase()}
                  </StatusBadge>
                  <span className="font-mono text-[11px] text-slate-500">v{comm.version}</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-bold text-white">{comm.title}</h2>
                    <p className="text-xs text-slate-400 mt-1 font-mono">{comm.id}</p>
                  </div>

                  {/* Consequential action buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {isDraft && (
                      <>
                        <button
                          onClick={() => onEditDraft(comm)}
                          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                        >
                          <Edit size={13} />
                          Edit Draft
                        </button>
                        <button
                          onClick={() => setActiveAction("schedule")}
                          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                        >
                          <Clock size={13} />
                          Schedule
                        </button>
                        <button
                          onClick={() => setActiveAction("publish")}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          <Send size={13} />
                          Publish Now
                        </button>
                        <button
                          onClick={() => setActiveAction("cancel")}
                          className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {isScheduled && (
                      <>
                        <button
                          onClick={() => setActiveAction("publish")}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          <Send size={13} />
                          Publish Immediately
                        </button>
                        <button
                          onClick={() => setActiveAction("cancel")}
                          className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                        >
                          Cancel Schedule
                        </button>
                      </>
                    )}

                    {isPublished && (
                      <button
                        onClick={() => setActiveAction("complete")}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <CheckCircle2 size={13} />
                        {comm.communication_type === "incident" ? "Complete Delivery Campaign" : "Mark Complete"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {comm.communication_type === "incident" && (
                <IncidentLifecycleNotice completedAt={comm.completed_at} />
              )}

              {/* Message Content & Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="md:col-span-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                  <h3 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                    Message Content
                  </h3>
                  <div className="rounded-lg bg-black/40 p-3.5 text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                    {comm.body}
                  </div>
                  {comm.deep_link && (
                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <ExternalLink size={12} className="text-[#a895ff]" />
                      <span>Deep Link:</span>
                      <a
                        href={comm.deep_link}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[#a895ff] hover:underline"
                      >
                        {comm.deep_link}
                      </a>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                  <h3 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                    Audience &amp; Routing
                  </h3>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Audience Kind</span>
                      <span className="font-semibold text-slate-200 capitalize">{String(comm.audience.kind ?? "all")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Audience Size</span>
                      <span className="font-mono text-slate-200">{comm.audience_count ?? "Not resolved yet"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Channels</span>
                      <span className="font-semibold text-slate-200">{comm.channels.join(", ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Created At</span>
                      <span className="text-slate-300">{new Date(comm.created_at).toLocaleString()}</span>
                    </div>
                    {comm.scheduled_at && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Scheduled At</span>
                        <span className="text-cyan-300">{new Date(comm.scheduled_at).toLocaleString()}</span>
                      </div>
                    )}
                    {comm.published_at && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Published At</span>
                        <span className="text-emerald-300">{new Date(comm.published_at).toLocaleString()}</span>
                      </div>
                    )}
                    {comm.completed_at && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Completed At</span>
                        <span className="text-slate-300">{new Date(comm.completed_at).toLocaleString()}</span>
                      </div>
                    )}
                    {comm.cancelled_at && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cancelled At</span>
                        <span className="text-amber-300">{new Date(comm.cancelled_at).toLocaleString()}</span>
                      </div>
                    )}
                    {comm.expires_at && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Expires At</span>
                        <span className="text-slate-300">{new Date(comm.expires_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Delivery Ledger & Telemetry */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-white flex items-center gap-2">
                      <Radio size={16} className="text-[#8b75ff]" />
                      Durable Delivery Telemetry &amp; Evidence
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Provider acceptance is not device-display evidence, in-app publication is not a read, and confirmed device-delivery evidence is currently unavailable.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      {eligibleOnPage.length} eligible on this page; {selectedRecipientIds.length} selected
                    </span>
                    <button
                      onClick={() => setActiveAction("retry")}
                      disabled={selectedRecipientIds.length === 0}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 transition disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ShieldAlert size={14} />
                      Retry Selected ({selectedRecipientIds.length})
                    </button>
                  </div>
                </div>

                <DeliveryEvidenceGrid delivery={delivery} />

                {retryNotice && (
                  <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-cyan-200">
                    {retryNotice}
                  </div>
                )}

                {/* Recipient Ledger Table */}
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">
                        Recipient Ledger
                      </h4>
                      <select
                        value={recipientStatusFilter}
                        onChange={(e) => {
                          setRecipientStatusFilter(e.target.value);
                          setRecipientPage(0);
                          setSelectedRecipientIds([]);
                        }}
                        className="rounded-lg border border-white/10 bg-[#0c0f1d] px-2.5 py-1 text-xs text-slate-300 outline-none"
                      >
                        <option value="all">All Recipient Statuses</option>
                        <option value="queued">Queued</option>
                        <option value="sending">Sending</option>
                        <option value="provider_accepted">Provider Accepted</option>
                        <option value="delivered">In-app available / device unverified</option>
                        <option value="failed">Failed</option>
                        <option value="retry_scheduled">Retry Scheduled</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Total: {recipientsData?.total ?? 0}</span>
                      <button
                        onClick={() => setRecipientPageAndClearSelection(recipientPage - 1)}
                        disabled={recipientPage === 0 || recipientsLoading}
                        aria-label="Previous recipient page"
                        className="rounded p-1 hover:bg-white/10 disabled:opacity-30"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="font-mono text-[11px]">
                        Page {recipientPage + 1} of {Math.max(1, Math.ceil((recipientsData?.total ?? 0) / pageSize))}
                      </span>
                      <button
                        onClick={() => setRecipientPageAndClearSelection(recipientPage + 1)}
                        disabled={(recipientPage + 1) * pageSize >= (recipientsData?.total ?? 0) || recipientsLoading}
                        aria-label="Next recipient page"
                        className="rounded p-1 hover:bg-white/10 disabled:opacity-30"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.07] text-[10px] text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Select</th>
                          <th className="py-2.5 px-3">User ID</th>
                          <th className="py-2.5 px-3">Delivery Status</th>
                          <th className="py-2.5 px-3">Attempts</th>
                          <th className="py-2.5 px-3">Last Attempt</th>
                          <th className="py-2.5 px-3">Read At</th>
                          <th className="py-2.5 px-3">Failure Category</th>
                          <th className="py-2.5 px-3">Retry</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {recipientsLoading ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-500">
                              <RefreshCw size={16} className="mx-auto animate-spin mb-1 text-[#8b75ff]" />
                              Loading recipient ledger...
                            </td>
                          </tr>
                        ) : (recipientsData?.items ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-500">
                              No recipient records match the selected filter.
                            </td>
                          </tr>
                        ) : (
                          recipientsData?.items.map((r: RecipientOut) => (
                            <tr key={r.id} className="hover:bg-white/[0.01]">
                              <td className="py-2.5 px-3">
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${r.user_id} for retry`}
                                  checked={selectedRecipientIds.includes(r.id)}
                                  disabled={!r.retry_eligible}
                                  onChange={() => setSelectedRecipientIds((current) => toggleRetrySelection(current, r))}
                                  className="rounded border-white/20 bg-white/5 accent-[#8b75ff] disabled:opacity-30"
                                />
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-200">{r.user_id}</td>
                              <td className="py-2.5 px-3">
                                <StatusBadge tone={getStatusBadgeTone(r.status)}>
                                  {recipientStatusLabel(r.status)}
                                </StatusBadge>
                              </td>
                              <td className="py-2.5 px-3 font-mono">{r.attempt_count}</td>
                              <td className="py-2.5 px-3 text-slate-400">
                                {r.last_attempt_at ? new Date(r.last_attempt_at).toLocaleTimeString() : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400">
                                {r.read_at ? new Date(r.read_at).toLocaleTimeString() : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400">
                                {r.failure_category ? (
                                  <span className="font-mono text-rose-300 text-[11px]">{r.failure_category}</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {r.retry_eligible ? (
                                  <span className="text-emerald-400 text-[11px]">Eligible</span>
                                ) : r.status === "failed" ? (
                                  <span className="text-slate-500 text-[11px]">Exhausted</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {activeAction && comm && (
        <ConsequentialActionDialog
          action={activeAction}
          communication={comm}
          isOpen={Boolean(activeAction)}
          onClose={() => setActiveAction(null)}
          onConfirm={handleConfirmAction}
          selectedRecipientIds={selectedRecipientIds}
        />
      )}
    </>
  );
}
