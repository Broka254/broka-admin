"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CircleDashed, Users, X } from "lucide-react";
import { createCommunication, updateCommunication } from "@/lib/api/communications";
import { AdminRequestError } from "@/hooks/use-admin-resource";
import { useAudiencePreview } from "@/hooks/use-audience-preview";
import {
  type AudienceKind,
  type CommunicationChannel,
  type CommunicationOut,
  type CommunicationSeverity,
  type CommunicationType,
  isValidDeepLink,
} from "@/lib/api/schemas";
import { normalizeAudienceDefinition, parseExplicitUserIds } from "@/lib/communications/audience";
import { isoToLocalDateTimeInput, resolveExpiryForSave } from "@/lib/communications/datetime";
import { IdempotencyKeyLedger, operationFingerprint, SingleFlight } from "@/lib/communications/idempotency";
import { StatusBadge } from "@/components/ui/primitives";

interface CommunicationFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  communicationToEdit?: CommunicationOut | null;
}

const AUDIENCE_OPTIONS: Array<{ value: AudienceKind; label: string; description: string }> = [
  { value: "all", label: "All Users", description: "All active registered users on the BROKA platform" },
  { value: "buyers", label: "Buyers", description: "Users with buyer profile history" },
  { value: "sellers", label: "Sellers", description: "Users registered as sellers" },
  { value: "store_owners", label: "Store Owners", description: "Users with verified storefronts" },
  { value: "user_ids", label: "Specific User IDs", description: "Explicit comma or newline-separated list of user IDs" },
];

const TYPE_OPTIONS: Array<{ value: CommunicationType; label: string }> = [
  { value: "announcement", label: "Announcement" },
  { value: "maintenance", label: "Maintenance" },
  { value: "incident", label: "Incident" },
  { value: "product_update", label: "Product Update" },
];

const SEVERITY_OPTIONS: Array<{ value: CommunicationSeverity; label: string; tone: "neutral" | "info" | "warning" | "danger" }> = [
  { value: "low", label: "Low", tone: "neutral" },
  { value: "normal", label: "Normal", tone: "info" },
  { value: "high", label: "High", tone: "warning" },
  { value: "critical", label: "Critical", tone: "danger" },
];

export function CommunicationFormDialog({
  isOpen,
  onClose,
  onSaved,
  communicationToEdit,
}: CommunicationFormDialogProps) {
  const isEditing = Boolean(communicationToEdit);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [communicationType, setCommunicationType] = useState<CommunicationType>("announcement");
  const [severity, setSeverity] = useState<CommunicationSeverity>("normal");
  const [channels, setChannels] = useState<CommunicationChannel[]>(["in_app"]);
  const [audienceKind, setAudienceKind] = useState<AudienceKind>("all");
  const [userIdsText, setUserIdsText] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originalExpiryRef = useRef<{ input: string; iso: string } | null>(null);
  const idempotencyLedger = useRef(new IdempotencyKeyLedger());
  const submissionGuard = useRef(new SingleFlight());

  // Initialize or reset form
  useEffect(() => {
    let expiryLoadError: string | null = null;
    if (communicationToEdit) {
      setTitle(communicationToEdit.title);
      setBody(communicationToEdit.body);
      setCommunicationType(communicationToEdit.communication_type as CommunicationType);
      setSeverity(communicationToEdit.severity as CommunicationSeverity);
      setChannels(communicationToEdit.channels as CommunicationChannel[]);
      const audKind = (communicationToEdit.audience?.kind as AudienceKind) || "all";
      setAudienceKind(audKind);
      const uIds = Array.isArray(communicationToEdit.audience?.user_ids)
        ? (communicationToEdit.audience.user_ids as string[]).join("\n")
        : "";
      setUserIdsText(uIds);
      setDeepLink(communicationToEdit.deep_link ?? "");
      if (communicationToEdit.expires_at) {
        try {
          const localInput = isoToLocalDateTimeInput(communicationToEdit.expires_at);
          setExpiresAt(localInput);
          originalExpiryRef.current = { input: localInput, iso: communicationToEdit.expires_at };
        } catch {
          originalExpiryRef.current = null;
          setExpiresAt("");
          expiryLoadError = "The stored expiry timestamp is invalid. Enter a new expiry or clear the field before saving.";
        }
      } else {
        originalExpiryRef.current = null;
        setExpiresAt("");
      }
    } else {
      setTitle("");
      setBody("");
      setCommunicationType("announcement");
      setSeverity("normal");
      setChannels(["in_app"]);
      setAudienceKind("all");
      setUserIdsText("");
      setDeepLink("");
      setExpiresAt("");
      originalExpiryRef.current = null;
    }
    idempotencyLedger.current.reset();
    setError(expiryLoadError);
  }, [communicationToEdit, isOpen]);

  // Push byte size calculation
  const pushBytes = useMemo(() => {
    const encoder = new TextEncoder();
    let count = encoder.encode(title).length + encoder.encode(body).length;
    if (deepLink) count += encoder.encode(deepLink).length;
    return count;
  }, [title, body, deepLink]);

  const pushExceeded = channels.includes("push") && pushBytes > 3600;

  // Parsed user IDs
  const parsedUserIds = useMemo(() => {
    if (audienceKind !== "user_ids") return [];
    return parseExplicitUserIds(userIdsText);
  }, [audienceKind, userIdsText]);

  const audiencePayload = useMemo(
    () => normalizeAudienceDefinition(audienceKind, parsedUserIds),
    [audienceKind, parsedUserIds],
  );
  const audiencePreview = useAudiencePreview(audiencePayload);
  const previewResult = audiencePreview.result;
  const previewLoading = audiencePreview.loading;
  const previewError = audiencePreview.error;

  // Handle Channel Checkbox
  function toggleChannel(channel: CommunicationChannel) {
    if (channel === "in_app") {
      // in_app is required
      return;
    }
    if (channels.includes(channel)) {
      setChannels(channels.filter((c) => c !== channel));
    } else {
      setChannels([...channels, channel]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validations
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (trimmedTitle.length > 160) {
      setError("Title must not exceed 160 characters.");
      return;
    }

    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError("Body is required.");
      return;
    }
    if (trimmedBody.length > 10000) {
      setError("Body must not exceed 10000 characters.");
      return;
    }

    if (!channels.includes("in_app")) {
      setError("in_app channel is required.");
      return;
    }

    if (pushExceeded) {
      setError("Push payload exceeds the 3600 UTF-8 byte limit. Shorten the text or use in_app channel only.");
      return;
    }

    if (audienceKind === "user_ids") {
      if (parsedUserIds.length === 0) {
        setError("Specific user IDs audience requires at least one user ID.");
        return;
      }
      if (parsedUserIds.length > 5000) {
        setError("Explicit audience limit is 5,000 user IDs.");
        return;
      }
    }

    if (deepLink && !isValidDeepLink(deepLink)) {
      setError("Deep link must be an https://broka.co.ke/ or broka:// URL (app, store, listing, deal, communications).");
      return;
    }

    const expiry = resolveExpiryForSave({
      input: expiresAt,
      originalInput: originalExpiryRef.current?.input,
      originalIso: originalExpiryRef.current?.iso,
    });
    if (!expiry.ok) {
      setError(expiry.message);
      return;
    }

    if (!submissionGuard.current.tryBegin()) return;
    setBusy(true);

    try {
      const basePayload = {
        title: trimmedTitle,
        body: trimmedBody,
        communication_type: communicationType,
        severity,
        audience: audiencePayload,
        channels,
        deep_link: deepLink.trim() || null,
        expires_at: expiry.expiresAt,
      };
      const updatePayload = isEditing && communicationToEdit
        ? { ...basePayload, expected_version: communicationToEdit.version }
        : null;
      const fingerprint = operationFingerprint(
        isEditing && communicationToEdit ? `update:${communicationToEdit.id}` : "create",
        updatePayload ?? basePayload,
      );
      // Reuse this key only for the same logical payload. A network timeout or
      // ambiguous response keeps it; changing any field starts a new operation.
      const idempotencyKey = idempotencyLedger.current.keyFor(fingerprint);

      if (isEditing && communicationToEdit) {
        await updateCommunication(communicationToEdit.id, updatePayload!, idempotencyKey);
      } else {
        await createCommunication(basePayload, idempotencyKey);
      }
      idempotencyLedger.current.reset();
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save communication.";
      const ambiguous = !(err instanceof AdminRequestError) || err.status >= 500;
      setError(
        ambiguous
          ? `${msg} The outcome may be unknown. Retrying without changing the form reuses the same idempotency key; draft creation is not currently deduplicated by the backend.`
          : msg,
      );
    } finally {
      submissionGuard.current.end();
      setBusy(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="form-dialog-title">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#080a14] p-6 shadow-2xl">
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <div className="pb-4 border-b border-white/[0.07]">
          <h2 id="form-dialog-title" className="font-display text-lg font-semibold text-white">
            {isEditing ? `Edit Draft Communication (v${communicationToEdit?.version})` : "Create New Communication Draft"}
          </h2>
          <p className="text-xs text-slate-400">
            {isEditing
              ? "Update draft content, audience targeting, or delivery channels. Changes require confirmation."
              : "Draft an operational announcement, maintenance notice, or incident communication. Drafts are not sent until published."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5 text-xs">
          {/* Title */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="comm-title" className="font-semibold text-slate-200">
                Title <span className="text-rose-400">*</span>
              </label>
              <span className={`font-mono text-[11px] ${title.length > 160 ? "text-rose-400" : "text-slate-500"}`}>
                {title.length} / 160
              </span>
            </div>
            <input
              id="comm-title"
              type="text"
              required
              maxLength={160}
              placeholder="e.g. Scheduled System Maintenance Notice"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-[#8b75ff]"
            />
          </div>

          {/* Type & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="comm-type" className="font-semibold text-slate-200 block mb-1">
                Communication Type
              </label>
              <select
                id="comm-type"
                value={communicationType}
                onChange={(e) => setCommunicationType(e.target.value as CommunicationType)}
                className="w-full rounded-xl border border-white/10 bg-[#0c0f1d] px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-[#8b75ff]"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="comm-severity" className="font-semibold text-slate-200 block mb-1">
                Severity Level
              </label>
              <select
                id="comm-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as CommunicationSeverity)}
                className="w-full rounded-xl border border-white/10 bg-[#0c0f1d] px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-[#8b75ff]"
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Body */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="comm-body" className="font-semibold text-slate-200">
                Message Body <span className="text-rose-400">*</span>
              </label>
              <span className={`font-mono text-[11px] ${body.length > 10000 ? "text-rose-400" : "text-slate-500"}`}>
                {body.length} / 10,000
              </span>
            </div>
            <textarea
              id="comm-body"
              required
              rows={4}
              maxLength={10000}
              placeholder="Provide clear, concise service information for users..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs leading-5 text-slate-100 placeholder-slate-500 outline-none focus:border-[#8b75ff]"
            />
          </div>

          {/* Delivery Channels */}
          <div>
            <label className="font-semibold text-slate-200 block mb-2">Delivery Channels</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-slate-300">
                <input
                  type="checkbox"
                  id="channel-in-app"
                  checked={channels.includes("in_app")}
                  disabled
                  className="rounded border-white/20 bg-white/5 accent-[#8b75ff]"
                />
                <label htmlFor="channel-in-app" className="cursor-not-allowed">
                  <span className="font-semibold block text-slate-200">In-App Announcement</span>
                  <span className="text-[11px] text-slate-400">Required. Delivered to the in-app notice inbox.</span>
                </label>
              </div>

              <div
                onClick={() => toggleChannel("push")}
                className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                  channels.includes("push")
                    ? "border-[#8b75ff]/50 bg-[#8b75ff]/5"
                    : "border-white/[0.07] bg-white/[0.02]"
                }`}
              >
                <input
                  type="checkbox"
                  id="channel-push"
                  checked={channels.includes("push")}
                  onChange={() => toggleChannel("push")}
                  className="rounded border-white/20 bg-white/5 accent-[#8b75ff]"
                />
                <label htmlFor="channel-push" className="cursor-pointer">
                  <span className="font-semibold block text-slate-200">Push Notification</span>
                  <span className="text-[11px] text-slate-400">Optional. Dispatched via Firebase Cloud Messaging.</span>
                </label>
              </div>
            </div>

            {channels.includes("push") && (
              <div className="mt-2.5 rounded-xl border border-white/[0.07] bg-white/[0.01] p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">FCM Push Payload Budget (UTF-8 bytes)</span>
                  <span className={`font-mono font-semibold ${pushExceeded ? "text-rose-400" : "text-slate-300"}`}>
                    {pushBytes} / 3600 bytes
                  </span>
                </div>
                {pushExceeded && (
                  <p className="mt-1 text-[11px] text-rose-300">
                    Push payload limit exceeded. Reduce message length or uncheck push channel to deliver via in-app inbox.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Audience Targeting */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Users size={14} className="text-[#a895ff]" />
                Audience Targeting
              </label>
              <button
                type="button"
                onClick={() => void audiencePreview.requestPreview()}
                disabled={previewLoading}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10 transition"
              >
                {previewLoading ? <CircleDashed size={12} className="animate-spin" /> : null}
                Preview Audience
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAudienceKind(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    audienceKind === opt.value
                      ? "border-[#8b75ff] bg-[#8b75ff]/10 text-white"
                      : "border-white/10 bg-white/[0.01] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span className="font-semibold block text-xs">{opt.label}</span>
                </button>
              ))}
            </div>

            {audienceKind === "user_ids" && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">User IDs (comma or newline separated)</span>
                  <span className="font-mono text-slate-400">{parsedUserIds.length} / 5,000 IDs</span>
                </div>
                <textarea
                  rows={3}
                  placeholder="usr_1234, usr_5678, ..."
                  value={userIdsText}
                  onChange={(e) => setUserIdsText(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-2.5 font-mono text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-[#8b75ff]"
                />
              </div>
            )}

            {/* Audience preview is tied to the exact current audience definition. */}
            {previewResult && (
              <div
                className={`rounded-lg border p-3 flex items-center justify-between text-xs ${
                  previewResult.allowed
                    ? "border-emerald-400/20 bg-emerald-400/5"
                    : "border-amber-400/30 bg-amber-400/10"
                }`}
              >
                <div>
                  <span className={`font-semibold block ${previewResult.allowed ? "text-emerald-300" : "text-amber-300"}`}>
                    {previewResult.allowed ? "Current Audience Preview" : "Audience Exceeds Maximum"}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Kind: {previewResult.kind} &bull; Max allowed: {previewResult.max_audience.toLocaleString()}
                  </span>
                  <span className="text-slate-500 text-[10px] block">
                    Informational only. The backend revalidates this definition and its limits at publication.
                  </span>
                </div>
                <StatusBadge tone={previewResult.allowed ? "success" : "warning"}>
                  {previewResult.count.toLocaleString()} recipients
                </StatusBadge>
              </div>
            )}

            {previewError && (
              <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-2.5 text-xs text-rose-200">
                {previewError}
              </div>
            )}
          </div>

          {/* Deep Link & Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="comm-deep-link" className="font-semibold text-slate-200 block mb-1">
                Deep Link (Optional)
              </label>
              <input
                id="comm-deep-link"
                type="text"
                maxLength={512}
                placeholder="https://broka.co.ke/deals or broka://app"
                value={deepLink}
                onChange={(e) => setDeepLink(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-[#8b75ff]"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Must use https://broka.co.ke/ or broka:// scheme.
              </p>
            </div>

            <div>
              <label htmlFor="comm-expires-at" className="font-semibold text-slate-200 block mb-1">
                Expiry Timestamp (Optional)
              </label>
              <input
                id="comm-expires-at"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-[#8b75ff]"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Past-expiry notices are automatically retired by the worker.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3.5 text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-white/[0.07] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || pushExceeded}
              className="flex items-center gap-2 rounded-lg bg-[#8b75ff] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#7a64ee] disabled:opacity-50"
            >
              {busy && <CircleDashed size={14} className="animate-spin" />}
              {isEditing ? "Save Draft Changes" : "Create Communication Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
