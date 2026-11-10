"use client";

import { BellRing, CheckCircle2, ExternalLink, Flag, MessageSquareWarning, Package, Send, ShieldAlert, Smartphone, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { Chip } from "@/components/intelligence/visuals";
import { ResourceState } from "@/components/ui/primitives";
import { useAdminDetail } from "@/hooks/use-admin-resource";
import { REPLY_TEMPLATES, useTriageFeedback } from "@/hooks/use-complaints";
import type { FeedbackAdminItem, FeedbackDetail, FeedbackStatus } from "@/lib/api/intelligence-schemas";
import { formatDateTime } from "@/lib/format";
import {
  feedbackCategoryLabel,
  feedbackReference,
  feedbackSeverityMeta,
  feedbackStatusMeta,
  formatCount,
  humanizeKey,
  isOpenFeedback,
  notificationOutcome,
  relativeTime,
  slaSummary,
} from "@/lib/intelligence";
import { cn } from "@/lib/utils";

const REPLY_LIMIT = 5000;

const STATUS_CHOICES: Array<{ value: FeedbackStatus | ""; label: string }> = [
  { value: "", label: "Keep current status" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "open", label: "Reopen as new" },
];

const TIMELINE_LABELS: Record<string, string> = {
  user_feedback_submitted: "Filed by the user",
  user_feedback_created: "Filed by the user",
  user_feedback_triaged: "Updated by an administrator",
  user_feedback_followup: "User added a follow-up",
};

function pushPreview(kind: string, reply: string): { title: string; body: string } {
  const noun = kind === "complaint" ? "complaint" : "feedback";
  const text = reply.split(/\s+/).filter(Boolean).join(" ");
  return { title: `BROKA replied to your ${noun}`, body: text.length > 140 ? `${text.slice(0, 137)}...` : text };
}

function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{9,15}$/.test(digits) ? `tel:${digits}` : null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Related({ detail }: { detail: FeedbackDetail }) {
  const { related_listing: listing, related_user: user, related_deal: deal } = detail;
  if (!listing && !user && !deal && !detail.related_listing_id && !detail.related_user_id && !detail.related_deal_id) return null;
  return (
    <Section title="What it is about">
      <div className="space-y-3">
        {listing || detail.related_listing_id ? (
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-cyan-200" aria-hidden="true"><Package size={14} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{listing?.name ?? "Listing"}</p>
              <p className="text-[11px] text-slate-500">{[listing?.category, listing?.status, listing?.price !== null && listing?.price !== undefined ? `KES ${formatCount(listing.price)}` : null].filter(Boolean).join(" · ") || "No longer available"}</p>
            </div>
            {detail.related_listing_id ? <Link href={`/listings/${encodeURIComponent(detail.related_listing_id)}`} className="focus-ring shrink-0 text-[11px] font-semibold text-[#a895ff] hover:text-[#ded8ff]">Open</Link> : null}
          </div>
        ) : null}
        {user || detail.related_user_id ? (
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-amber-200" aria-hidden="true"><ShieldAlert size={14} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.name || "Reported account"}{user?.is_flagged ? <Chip tone="danger" className="ml-2">Flagged</Chip> : null}</p>
              {user ? <p className="text-[11px] text-slate-500">Trust {user.trust_score} · {formatCount(user.complaints_against_total)} complaints about them ({formatCount(user.complaints_against_open)} open)</p> : null}
            </div>
            {detail.related_user_id ? (
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Link href={`/users/${encodeURIComponent(detail.related_user_id)}`} className="focus-ring text-[11px] font-semibold text-[#a895ff] hover:text-[#ded8ff]">Profile</Link>
                <Link href={`/complaints?about=${encodeURIComponent(detail.related_user_id)}&queue=all`} className="focus-ring text-[11px] font-semibold text-slate-400 hover:text-white">All about them</Link>
              </div>
            ) : null}
          </div>
        ) : null}
        {deal || detail.related_deal_id ? (
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-emerald-200" aria-hidden="true"><CheckCircle2 size={14} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Deal {deal?.status ? `· ${humanizeKey(deal.status)}` : ""}</p>
              <p className="text-[11px] text-slate-500">{deal?.agreed_price !== null && deal?.agreed_price !== undefined ? `Agreed KES ${formatCount(deal.agreed_price)}` : "No agreed price"}{deal?.created_at ? ` · ${formatDateTime(deal.created_at)}` : ""}</p>
            </div>
            {detail.related_deal_id ? <Link href={`/deals/${encodeURIComponent(detail.related_deal_id)}`} className="focus-ring shrink-0 text-[11px] font-semibold text-[#a895ff] hover:text-[#ded8ff]">Open</Link> : null}
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function Composer({ item, onSaved }: { item: FeedbackAdminItem; onSaved: (message: string) => void }) {
  const triage = useTriageFeedback();
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState<FeedbackStatus | "">("");
  const replyId = useId();
  const statusId = useId();
  const trimmed = reply.trim();
  const canSubmit = !triage.isPending && (trimmed.length > 0 || status !== "") && reply.length <= REPLY_LIMIT;
  const preview = trimmed ? pushPreview(item.kind, trimmed) : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    triage.mutate(
      { id: item.id, input: { ...(status ? { status } : {}), ...(trimmed ? { admin_response: trimmed } : {}) } },
      {
        onSuccess: (result) => {
          setReply("");
          setStatus("");
          onSaved(notificationOutcome(result.notified_devices) ?? `Saved. Status is now ${feedbackStatusMeta(result.status).label.toLowerCase()}.`);
        },
      },
    );
  }

  function quick(next: FeedbackStatus) {
    triage.mutate(
      { id: item.id, input: { status: next } },
      { onSuccess: (result) => onSaved(notificationOutcome(result.notified_devices) ?? `Status is now ${feedbackStatusMeta(result.status).label.toLowerCase()}.`) },
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[#8b75ff]/25 bg-[#8b75ff]/[0.05] p-4" aria-label="Reply and update status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={replyId} className="text-xs font-semibold text-slate-100">Reply to the reporter</label>
        <span className={cn("text-[10px] tabular-nums", reply.length > REPLY_LIMIT ? "text-rose-300" : "text-slate-500")}>{reply.length.toLocaleString()} / {REPLY_LIMIT.toLocaleString()}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Reply templates">
        {REPLY_TEMPLATES.map((template) => (
          <button
            key={template.key}
            type="button"
            onClick={() => { setReply(template.text); if (template.status) setStatus(template.status); }}
            className="focus-ring rounded-full border border-white/[0.09] bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-[#8b75ff]/40 hover:text-white"
          >
            {template.label}
          </button>
        ))}
      </div>
      <textarea
        id={replyId}
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        rows={5}
        placeholder="Write what you did or what you need from them. They get a push and see it in the app."
        className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm leading-6 text-slate-100 placeholder:text-slate-600 focus:border-[#8b75ff]/50 focus:outline-none"
      />
      {preview ? (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/30 p-3" aria-label="Push notification preview">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#8b75ff]/20 text-[#ded8ff]" aria-hidden="true"><Smartphone size={14} /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-white">{preview.title}</p>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{preview.body}</p>
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label htmlFor={statusId} className="text-[11px] text-slate-400">
          Status
          <select id={statusId} value={status} onChange={(event) => setStatus(event.target.value as FeedbackStatus | "")} className="mt-1 block rounded-lg border border-white/10 bg-[#080a14] px-3 py-2 text-xs text-slate-100">
            {STATUS_CHOICES.filter((choice) => choice.value === "" || choice.value !== item.status).map((choice) => <option key={choice.value || "keep"} value={choice.value}>{choice.label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={!canSubmit} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[#8b75ff] px-4 py-2.5 text-xs font-bold text-white shadow-[0_0_24px_rgba(139,117,255,0.35)] transition hover:bg-[#9d8bff] disabled:cursor-not-allowed disabled:opacity-50">
          <Send size={13} aria-hidden="true" />
          {triage.isPending ? "Saving…" : trimmed ? (status ? "Send reply & update" : "Send reply") : "Update status"}
        </button>
      </div>
      {isOpenFeedback(item.status) ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
          <span className="text-[11px] text-slate-500">Without a reply:</span>
          {item.status !== "in_progress" ? <button type="button" disabled={triage.isPending} onClick={() => quick("in_progress")} className="focus-ring text-[11px] font-semibold text-cyan-200 hover:text-white disabled:opacity-50">Mark in progress</button> : null}
          <button type="button" disabled={triage.isPending} onClick={() => quick("resolved")} className="focus-ring text-[11px] font-semibold text-emerald-200 hover:text-white disabled:opacity-50">Resolve</button>
          <button type="button" disabled={triage.isPending} onClick={() => quick("closed")} className="focus-ring text-[11px] font-semibold text-slate-300 hover:text-white disabled:opacity-50">Close</button>
        </div>
      ) : null}
      {triage.isError ? <p role="alert" className="mt-3 text-xs text-rose-300">{triage.error.message}</p> : null}
    </form>
  );
}

export function ComplaintDrawer({ id, preview, onClose }: { id: string; preview?: FeedbackAdminItem; onClose: () => void }) {
  const detail = useAdminDetail("feedbackDetail", id);
  const [saved, setSaved] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    setSaved(null);
  }, [id]);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), textarea, select, input"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const item: FeedbackAdminItem | undefined = detail.data ?? preview;
  const sla = item ? slaSummary(item) : null;
  const severity = item ? feedbackSeverityMeta(item.severity) : null;
  const reporter = item?.reporter ?? null;
  const tel = telHref(reporter?.phone);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onKeyDown={onKeyDown}>
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" aria-label="Close complaint" tabIndex={-1} onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="drawer-panel relative flex h-full w-full max-w-[640px] flex-col border-l border-white/[0.08] bg-[#080a14] shadow-2xl">
        <header className="flex items-start gap-3 border-b border-white/[0.07] p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-200" aria-hidden="true"><MessageSquareWarning size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {item ? <Chip tone={item.kind === "complaint" ? "warning" : "info"}>{item.kind}</Chip> : null}
              {severity ? <Chip tone={severity.tone}>{severity.label}</Chip> : null}
              {item ? <Chip>{feedbackCategoryLabel(item.category)}</Chip> : null}
              {item ? <span className="font-mono text-[11px] text-slate-500">{feedbackReference(item.id)}</span> : null}
            </div>
            <h2 id={titleId} className="mt-2 text-lg font-semibold leading-snug text-white">{item?.subject ?? "Loading…"}</h2>
            {item && sla ? <p className="mt-1 text-xs text-slate-400">Filed {relativeTime(item.created_at)} · <span className={sla.overdue ? "font-semibold text-rose-300" : sla.tone === "warning" ? "text-amber-200" : "text-slate-300"}>{sla.label}</span> · {feedbackStatusMeta(item.status).label}</p> : null}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="focus-ring rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!item && detail.isLoading ? <ResourceState state="loading" message="Opening the case…" /> : null}
          {!item && detail.isError ? <ResourceState state="error" message={detail.error.message} /> : null}
          {item ? (
            <>
              <Section title="What they wrote">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{item.body}</p>
              </Section>

              {reporter ? (
                <Section title="Who filed it">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ded8ff] to-[#8b75ff] text-xs font-black text-slate-950" aria-hidden="true"><UserRound size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{reporter.name || "Unnamed user"}{reporter.is_flagged ? <Chip tone="danger" className="ml-2"><Flag size={10} aria-hidden="true" />Flagged</Chip> : null}</p>
                      <p className="text-[11px] text-slate-500">{[reporter.account_type ? humanizeKey(reporter.account_type) : null, `trust ${reporter.trust_score}`, reporter.created_at ? `joined ${formatDateTime(reporter.created_at)}` : null].filter(Boolean).join(" · ")}</p>
                      {detail.data ? <p className="mt-1 text-[11px] text-slate-400">{formatCount(detail.data.reporter_history.submissions)} submissions, {formatCount(detail.data.reporter_history.complaints)} complaints in total</p> : null}
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold">
                        {tel ? <a href={tel} className="focus-ring text-emerald-200 hover:text-white">Call {reporter.phone}</a> : null}
                        <Link href={`/users/${encodeURIComponent(reporter.id)}`} className="focus-ring inline-flex items-center gap-1 text-[#a895ff] hover:text-[#ded8ff]"><ExternalLink size={11} aria-hidden="true" />Profile</Link>
                        <Link href={`/complaints?user=${encodeURIComponent(reporter.id)}&queue=all`} className="focus-ring text-slate-400 hover:text-white">Everything they filed</Link>
                      </div>
                    </div>
                  </div>
                </Section>
              ) : null}

              {detail.data ? <Related detail={detail.data} /> : null}

              {item.admin_response ? (
                <Section title="Last reply sent">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{item.admin_response}</p>
                  {item.responded_at ? <p className="mt-2 text-[11px] text-slate-500">Sent {formatDateTime(item.responded_at)}</p> : null}
                </Section>
              ) : null}

              {saved ? <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3 text-xs leading-5 text-emerald-100"><BellRing size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{saved}</p> : null}

              <Composer item={item} onSaved={setSaved} />

              {detail.data?.timeline.length ? (
                <Section title="History">
                  <ol className="space-y-2.5 border-l border-white/[0.08] pl-4">
                    <li className="relative text-xs text-slate-300"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border border-white/20 bg-[#13182b]" aria-hidden="true" />Filed <span className="text-slate-500">· {formatDateTime(item.created_at)}</span></li>
                    {detail.data.timeline.map((entry, index) => (
                      <li key={`${entry.at}-${index}`} className="relative text-xs text-slate-300">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border border-[#8b75ff]/50 bg-[#8b75ff]/30" aria-hidden="true" />
                        {TIMELINE_LABELS[entry.action] ?? humanizeKey(entry.action.replace(/^user_feedback_/, ""))}
                        {entry.status ? <> → <span className="font-semibold text-white">{feedbackStatusMeta(entry.status).label}</span></> : null}
                        <span className="text-slate-500"> · {entry.at ? formatDateTime(entry.at) : "—"}</span>
                      </li>
                    ))}
                  </ol>
                </Section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
