"use client";

import { ArrowLeft, BadgeCheck, CircleAlert, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAdminDetail } from "@/hooks/use-admin-resource";
import { ResourceState, SectionEyebrow, StatusBadge } from "@/components/ui/primitives";
import { ValidatedResourceView } from "@/components/dashboard/validated-resource-view";
import { formatRouteLabel } from "@/lib/utils";

const copy = {
  listings: { title: "Listing detail", description: "The backend exposes listing enumeration only; a per-listing admin detail contract does not exist.", action: "Admin detail endpoint required", actions: [] as string[], sections: ["Listing information", "Moderation history"] },
  users: { title: "User profile", description: "Identity, marketplace activity and trust history from GET /admin/users/{id}. Administrative actions are audited and idempotent.", actions: ["flag", "unflag", "recompute-trust", "promote-admin"] as string[], sections: [] as string[] },
  disputes: { title: "Dispute detail", description: "Dispute cases are fully enumerated in the admin queue; a separate detail endpoint does not exist.", action: "Admin detail endpoint required", actions: [] as string[], sections: ["Case information", "Evidence & messages"] },
  deals: { title: "Deal detail", description: "Deal state with its ledger entries, escrow payments and dispute cases. Read-only: money movement stays with the escrow engine.", actions: [] as string[], sections: [] as string[] },
};

type DetailResource = keyof typeof copy;
type UserAction = "flag" | "unflag" | "recompute-trust" | "promote-admin";

const ACTION_LABELS: Record<UserAction, string> = { flag: "Flag user", unflag: "Clear flag", "recompute-trust": "Recompute trust", "promote-admin": "Promote to admin" };
const REASON_REQUIRED: Record<UserAction, boolean> = { flag: true, unflag: false, "recompute-trust": false, "promote-admin": true };

export function RecordDetail({ resource, resourceId }: { resource: DetailResource; resourceId: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [selectedAction, setSelectedAction] = useState<UserAction>("flag");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  // Keep one key per action attempt so a retry after a network failure cannot
  // be applied twice. A different action gets a fresh key.
  const [attempt, setAttempt] = useState<{ action: UserAction; key: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const config = copy[resource];

  const userDetail = useAdminDetail("userDetail", resourceId, resource === "users");
  const dealDetail = useAdminDetail("dealDetail", resourceId, resource === "deals");

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("textarea, input")?.focus(), 0);
    function onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href]"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeydown);
    return () => { window.clearTimeout(focusTimer); document.removeEventListener("keydown", onKeydown); previous?.focus(); };
  }, [open]);

  async function confirmAction() {
    if (resource !== "users" || confirmation !== "CONFIRM") return;
    if (REASON_REQUIRED[selectedAction] && reason.trim().length < 3) { setStatus("error"); setMessage("A written reason (3-500 characters) is required for this action."); return; }
    setStatus("sending");
    setMessage("");
    const idempotencyKey = attempt?.action === selectedAction ? attempt.key : crypto.randomUUID();
    if (attempt?.action !== selectedAction) setAttempt({ action: selectedAction, key: idempotencyKey });
    try {
      const response = await fetch(`/api/broka/users/${encodeURIComponent(resourceId)}/${selectedAction}`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; changed?: boolean; already_flagged?: boolean; trust_score?: number; trust_band?: string; is_admin?: boolean };
      if (!response.ok) throw new Error(payload.message ?? "The BROKA API could not complete this action.");
      setStatus("success");
      void queryClient.invalidateQueries({ queryKey: ["broka-admin"] });
      const outcome = payload.changed === true ? "applied" : payload.changed === false ? "was already in that state (no duplicate change)" : "accepted";
      const detail = payload.trust_score !== undefined ? ` Trust score: ${payload.trust_score}${payload.trust_band ? ` (${payload.trust_band})` : ""}.` : payload.is_admin !== undefined ? ` is_admin: ${payload.is_admin}.` : "";
      setMessage(`${ACTION_LABELS[selectedAction]} ${outcome}.${detail} The action is recorded in the audit log.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The BROKA API could not complete this action.");
    }
  }

  function closeDialog() { setOpen(false); setConfirmation(""); setReason(""); setStatus("idle"); setMessage(""); setSelectedAction("flag"); setAttempt(null); }
  const hasApiAction = resource === "users";
  const user = userDetail.data?.user;

  return <div className="space-y-6">
    <section className="border-b border-white/[0.07] pb-6">
      <Link href={`/${resource}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-amber-200"><ArrowLeft size={14} />Back to {formatRouteLabel(resource)}</Link>
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div><SectionEyebrow>{formatRouteLabel(resource)} operations</SectionEyebrow><h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">{user ? user.name : config.title}</h1><p className="mt-2 text-sm text-slate-500">{config.description} <code className="ml-1 rounded bg-white/[0.05] px-1.5 py-0.5 text-slate-300">{resourceId.slice(0, 8)}</code></p></div>
        {user ? <div className="flex flex-wrap gap-2"><StatusBadge tone={user.is_flagged ? "danger" : "success"}>{user.is_flagged ? "Flagged" : "Not flagged"}</StatusBadge><StatusBadge tone="info">Trust {user.trust_score} · {user.trust_band}</StatusBadge>{user.is_admin ? <StatusBadge tone="warning">Admin</StatusBadge> : null}</div> : null}
      </div>
    </section>

    {resource === "users" ? <>
      {userDetail.isLoading ? <div className="data-panel p-5"><ResourceState state="loading" message="Loading user detail" /></div> : userDetail.isError ? <div className="data-panel p-5"><ResourceState state={userDetail.error && "status" in userDetail.error && userDetail.error.status === 404 ? "empty" : "error"} message={userDetail.error instanceof Error ? userDetail.error.message : "Unable to load this user."} /></div> : userDetail.data ? <div className="grid gap-4 lg:grid-cols-2">
        <section className="data-panel p-5"><p className="text-sm font-semibold text-slate-200">Identity</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Name</dt><dd className="mt-1 text-slate-200">{userDetail.data.user.name}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Account type</dt><dd className="mt-1 text-slate-200">{userDetail.data.user.account_type ?? "—"}{userDetail.data.user.seller_tier ? ` · ${userDetail.data.user.seller_tier}` : ""}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Phone</dt><dd className="mt-1 text-slate-200">{userDetail.data.user.phone ?? "—"}{userDetail.data.user.phone_verified ? " ✓" : " (unverified)"}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Email</dt><dd className="mt-1 text-slate-200">{userDetail.data.user.email ?? "—"}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Joined</dt><dd className="mt-1 text-slate-200">{userDetail.data.user.created_at ? new Date(userDetail.data.user.created_at).toLocaleString("en-KE") : "—"}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Last seen</dt><dd className="mt-1 text-slate-200">{userDetail.data.user.last_seen ? new Date(userDetail.data.user.last_seen).toLocaleString("en-KE") : "—"}</dd></div>
        </dl></section>
        <section className="data-panel p-5"><p className="text-sm font-semibold text-slate-200">Marketplace & trust</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{Object.entries(userDetail.data.stats).map(([key, count]) => <div key={key} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-[10px] uppercase tracking-[0.1em] text-slate-600">{key.replaceAll("_", " ")}</p><p className="mt-1 font-display text-lg font-bold text-slate-100">{count}</p></div>)}</div></section>
        <section className="data-panel p-5"><p className="text-sm font-semibold text-slate-200">Recent deals ({userDetail.data.recent_deals.length})</p><div className="mt-3 space-y-2">{userDetail.data.recent_deals.map((deal) => <a key={deal.id} href={`/deals/${deal.id}`} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs transition hover:border-[#8b75ff]/30"><span className="text-slate-300">deal {deal.id.slice(0, 8)} · KES {deal.agreed_price.toLocaleString()}</span><span className="text-slate-500">{deal.status} · {deal.created_at ? new Date(deal.created_at).toLocaleDateString("en-KE") : "—"}</span></a>)}{!userDetail.data.recent_deals.length ? <p className="text-xs text-slate-500">No deals recorded.</p> : null}</div></section>
        <section className="data-panel p-5"><p className="text-sm font-semibold text-slate-200">Fraud events ({userDetail.data.fraud_events.length})</p><div className="mt-3 space-y-2">{userDetail.data.fraud_events.map((event) => <div key={event.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="text-slate-300">{event.reason}</span><StatusBadge tone={event.resolved ? "success" : "warning"}>{event.resolved ? "resolved" : "open"}</StatusBadge></div><p className="mt-1 text-slate-500">{event.triggered_by ? `trigger: ${event.triggered_by} · ` : ""}trust at flag: {event.trust_score_at_flag ?? "—"} · {event.created_at ? new Date(event.created_at).toLocaleString("en-KE") : "—"}</p></div>)}{!userDetail.data.fraud_events.length ? <p className="text-xs text-slate-500">No fraud events recorded.</p> : null}</div>
          <p className="mt-4 text-xs font-semibold text-slate-400">Recent audit</p>
          <div className="mt-2 space-y-1.5">{userDetail.data.recent_audit.map((entry) => <p key={entry.id} className="text-[11px] leading-5 text-slate-500"><span className="text-slate-300">{entry.action}</span> by {entry.actor_id} · {entry.created_at ? new Date(entry.created_at).toLocaleString("en-KE") : "—"}</p>)}{!userDetail.data.recent_audit.length ? <p className="text-xs text-slate-500">No audit rows for this user yet.</p> : null}</div>
        </section>
      </div> : null}
    </> : null}

    {resource === "deals" ? <>{dealDetail.isLoading ? <div className="data-panel p-5"><ResourceState state="loading" message="Loading deal detail" /></div> : dealDetail.isError ? <div className="data-panel p-5"><ResourceState state={dealDetail.error && "status" in dealDetail.error && dealDetail.error.status === 404 ? "empty" : "error"} message={dealDetail.error instanceof Error ? dealDetail.error.message : "Unable to load this deal."} /></div> : dealDetail.data ? <section className="data-panel overflow-hidden"><ValidatedResourceView resource="dealDetail" data={dealDetail.data} /></section> : null}</> : null}

    {resource !== "users" && resource !== "deals" ? <div className="grid gap-4 lg:grid-cols-2">{config.sections.map((section) => <section key={section} className="data-panel p-5"><p className="text-sm font-semibold text-slate-200">{section}</p><div className="mt-4"><ResourceState state="unavailable" message="This information has no admin-scoped backend contract. Use the list view for the verified fields." /></div></section>)}</div> : null}

    {hasApiAction ? <section className="data-panel border-rose-400/15 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-rose-300/20 bg-rose-400/[0.08] text-rose-200"><ShieldAlert size={17} /></span><div><p className="text-sm font-semibold text-slate-100">Administrative action guard</p><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Actions are allowlisted, reason-gated where required, confirmed, sent idempotently through the server-only FastAPI boundary, and recorded in the audit log. The backend remains authoritative.</p></div></div>
        <button onClick={() => { setOpen(true); setStatus("idle"); setMessage(""); setAttempt(null); }} className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/20"><CircleAlert size={14} />Open action panel</button>
      </div>
      {status === "success" && message ? <p className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-200"><BadgeCheck size={13} />{message}</p> : null}
      {status === "error" && message && !open ? <p className="mt-3 text-xs text-rose-200">{message}</p> : null}
    </section> : null}

    {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Administrative action">
      <div ref={dialogRef} className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0a0d18] p-5 shadow-2xl">
        <p className="font-display text-base font-semibold text-slate-100">Confirm administrative action</p>
        <p className="mt-1 text-xs text-slate-500">Target user {resourceId}. This is written to the audit log with your admin id, reason and request id.</p>
        <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Action
          <select value={selectedAction} onChange={(event) => setSelectedAction(event.target.value as UserAction)} className="mt-2 w-full rounded-lg border border-white/[0.08] bg-black/30 p-3 text-xs font-semibold text-slate-200 outline-none [&>option]:bg-[#0b0e1a]">{(config.actions ?? []).map((action) => <option key={action} value={action}>{ACTION_LABELS[action as UserAction]}</option>)}</select>
        </label>
        <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{REASON_REQUIRED[selectedAction] ? "Reason (required)" : "Reason (optional)"}
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="Why is this action being taken?" className="mt-2 w-full rounded-lg border border-white/[0.08] bg-black/30 p-3 text-xs text-slate-200 placeholder:text-slate-600" />
        </label>
        <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Type CONFIRM to proceed
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-lg border border-white/[0.08] bg-black/30 p-3 text-xs text-slate-200" />
        </label>
        {status === "error" ? <p className="mt-3 text-xs text-rose-200" role="alert">{message}</p> : null}
        {status === "success" ? <p className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-200" role="status"><BadgeCheck size={13} />{message}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={closeDialog} className="focus-ring rounded-lg border border-white/[0.09] px-3 py-2 text-xs font-semibold text-slate-400 transition hover:text-slate-200">{status === "success" ? "Close" : "Cancel"}</button>
          <button onClick={confirmAction} disabled={confirmation !== "CONFIRM" || status === "sending" || status === "success"} className="focus-ring rounded-lg bg-rose-400/15 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:opacity-40">{status === "sending" ? "Sending…" : "Confirm action"}</button>
        </div>
      </div>
    </div> : null}
  </div>;
}
