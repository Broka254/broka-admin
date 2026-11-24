"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ResourceState, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { AdminRequestError } from "@/hooks/use-admin-resource";
import {
  DURATION_LABELS,
  canSubmitAccountChange,
  parseEvidenceRefs,
  statusLabel,
  submitAccountChange,
  useAccountModeration,
  type AccountChange,
  type SuspensionDuration,
} from "@/lib/api/account-status";
import type { AccountStatusChangeIn } from "@/lib/api/schemas";
import { formatDateTime } from "@/lib/format";

const CHANGE_LABELS: Record<AccountChange, string> = {
  restrict: "Restrict account",
  suspend: "Suspend account",
  reinstate: "Reinstate account",
};

const ACTION_LABELS: Record<string, string> = {
  restricted: "Restricted",
  suspended: "Suspended",
  suspension_expired: "Suspension ended",
  reinstated: "Reinstated",
};

/**
 * Restriction and suspension of one account. The backend enforces every change
 * and records it; this panel only sends the change, with the version the
 * administrator last read, so a change made meanwhile is refused.
 */
export function AccountStatusPanel({ userId }: { userId: string }) {
  const moderation = useAccountModeration(userId);
  const queryClient = useQueryClient();
  const [change, setChange] = useState<AccountChange | null>(null);
  const [duration, setDuration] = useState<SuspensionDuration>("7d");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function openDialog(next: AccountChange) {
    setChange(next);
    setReason("");
    setNotes("");
    setEvidence("");
    setConfirmation("");
    setError(null);
    setDone(null);
  }

  function closeDialog() {
    setChange(null);
    setConfirmation("");
    setSending(false);
  }

  async function submit() {
    if (!change || !moderation.data) return;
    const input: AccountStatusChangeIn = {
      reason: reason.trim(),
      expected_version: moderation.data.status_version,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(change === "suspend" ? { duration } : {}),
      ...(parseEvidenceRefs(evidence).length ? { evidence_refs: parseEvidenceRefs(evidence) } : {}),
    };
    setSending(true);
    setError(null);
    try {
      const state = await submitAccountChange(change, userId, input);
      setDone(`${CHANGE_LABELS[change]}: now ${statusLabel(state)}. Recorded in the audit log.`);
      closeDialog();
      void queryClient.invalidateQueries({ queryKey: ["broka-admin"] });
    } catch (failure) {
      setError(failure instanceof AdminRequestError || failure instanceof Error ? failure.message : "The account change was not applied.");
      setSending(false);
    }
  }

  if (moderation.isLoading) return <Skeleton className="h-40" />;
  if (moderation.isError || !moderation.data) {
    const notFound = moderation.error instanceof AdminRequestError && moderation.error.status === 404;
    return (
      <div className="data-panel p-5">
        <ResourceState
          state={notFound ? "unavailable" : "error"}
          message={moderation.error instanceof Error ? moderation.error.message : "Unable to load the account status."}
        />
      </div>
    );
  }

  const state = moderation.data;
  const current = state.status;
  const tone = current === "active" ? "success" : current === "restricted" ? "warning" : "danger";
  const canChange: Record<AccountChange, boolean> = {
    restrict: current === "active",
    suspend: true,
    reinstate: current !== "active",
  };

  return (
    <section aria-label="Account status" className="data-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-200">Account status</p>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">
            Restriction and suspension are enforced by the backend on every request, including sign-in. Flagging (above) only records a concern.
          </p>
        </div>
        <StatusBadge tone={tone}>{statusLabel(state)}</StatusBadge>
      </div>

      {state.status_changed_at ? (
        <p className="text-xs text-slate-500">
          Last changed {formatDateTime(state.status_changed_at)} by {state.status_changed_by ?? "unknown"}
          {state.status_reason ? `: ${state.status_reason}` : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(CHANGE_LABELS) as AccountChange[]).map((option) => (
          <button
            key={option}
            type="button"
            disabled={!canChange[option]}
            onClick={() => openDialog(option)}
            className={`focus-ring rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${option === "reinstate" ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20" : "border-rose-300/25 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20"}`}
          >
            {CHANGE_LABELS[option]}
          </button>
        ))}
      </div>

      {done ? <p role="status" className="text-xs text-emerald-200">{done}</p> : null}

      <div>
        <p className="text-xs font-semibold text-slate-400">History</p>
        <ul className="mt-2 divide-y divide-white/[0.05] rounded-lg border border-white/[0.06]">
          {state.history.length ? state.history.map((event) => (
            <li key={event.id} className="space-y-1 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-200">{ACTION_LABELS[event.action] ?? event.action}</span>
                <span className="tabular-nums text-slate-500">{formatDateTime(event.created_at)}</span>
              </div>
              <p className="text-slate-400">{event.reason}</p>
              <p className="text-slate-600">
                {event.from_status} → {event.to_status}
                {event.suspended_until ? ` · until ${formatDateTime(event.suspended_until)}` : event.to_status === "suspended" ? " · permanent" : ""}
                {` · by ${event.actor_id}`}
              </p>
            </li>
          )) : <li className="px-3 py-3 text-xs text-slate-500">No status changes recorded.</li>}
        </ul>
      </div>

      {change ? (
        <div role="dialog" aria-modal="true" aria-label={CHANGE_LABELS[change]} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onKeyDown={(event) => { if (event.key === "Escape") closeDialog(); }}>
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0a0d18] p-5 shadow-2xl">
            <p className="font-display text-base font-semibold text-slate-100">{CHANGE_LABELS[change]}</p>
            <p className="mt-1 text-xs text-slate-500">
              Applied against version {state.status_version}. The backend refuses it if the account has changed since.
            </p>
            {change === "suspend" ? (
              <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Duration
                <select value={duration} onChange={(event) => setDuration(event.target.value as SuspensionDuration)} className="mt-2 w-full rounded-lg border border-white/[0.08] bg-black/30 p-3 text-xs font-semibold text-slate-200 outline-none [&>option]:bg-[#0b0e1a]">
                  {(Object.keys(DURATION_LABELS) as SuspensionDuration[]).map((option) => <option key={option} value={option}>{DURATION_LABELS[option]}</option>)}
                </select>
              </label>
            ) : null}
            <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Reason (required, shown in the history)
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} className="mt-2 w-full rounded-lg border border-white/[0.08] bg-black/30 p-3 text-xs text-slate-200" />
            </label>
            <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Internal notes (optional)
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={2000} className="mt-2 w-full rounded-lg border border-white/[0.08] bg-black/30 p-3 text-xs text-slate-200" />
            </label>
            <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Evidence references (optional, comma or line separated)
              <input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="e.g. complaint 4411, case 2291" className="mt-2 w-full rounded-lg border border-white/[0.08] bg-black/30 p-3 text-xs text-slate-200" />
            </label>
            <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Type CONFIRM to proceed
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-lg border border-white/[0.08] bg-black/30 p-3 text-xs text-slate-200" />
            </label>
            {error ? <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeDialog} className="focus-ring rounded-lg border border-white/[0.09] px-3 py-2 text-xs font-semibold text-slate-400 transition hover:text-slate-200">Cancel</button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={sending || !canSubmitAccountChange({ change, duration: change === "suspend" ? duration : null, reason, confirmation, expectedVersion: state.status_version })}
                className="focus-ring rounded-lg bg-rose-400/15 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? "Applying…" : CHANGE_LABELS[change]}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
