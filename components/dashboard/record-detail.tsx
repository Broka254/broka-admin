"use client";

import { ArrowLeft, CircleAlert, FileText, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ResourceState, SectionEyebrow, StatusBadge } from "@/components/ui/primitives";
import { formatRouteLabel } from "@/lib/utils";

const copy = {
  listings: { title: "Listing detail", description: "Listing images, moderation history, trust information, and associated deals require an authenticated admin detail contract.", action: "Admin endpoint required", sections: ["Listing information", "Trust & moderation", "Associated deals", "Moderation history"] },
  users: { title: "User profile", description: "Identity, marketplace activity, trust history, and financial information appear only when the backend authorizes each field.", actions: ["flag", "unflag", "recompute-trust", "promote-admin"], sections: ["Identity", "Marketplace activity", "Trust & safety", "Financial visibility"] },
  disputes: { title: "Dispute detail", description: "Parties, evidence, decisions, and financial outcomes must be read from an admin-scoped case model.", action: "Admin endpoint required", sections: ["Case information", "Parties & deal", "Evidence & messages", "Audit history"] },
} as const;

type DetailResource = keyof typeof copy;

export function RecordDetail({ resource, resourceId }: { resource: DetailResource; resourceId: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [selectedAction, setSelectedAction] = useState("flag");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const config = copy[resource];
  const hasApiAction = resource === "users";

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("input")?.focus(), 0);
    function onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [href]"));
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
    if (!hasApiAction || confirmation !== "CONFIRM") return;
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch(`/api/broka/users/${encodeURIComponent(resourceId)}/${selectedAction}`, { method: "POST", credentials: "same-origin", headers: { "Idempotency-Key": crypto.randomUUID() } });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "The BROKA API could not complete this action.");
      setStatus("success");
      setMessage(payload.message ?? "BROKA accepted the action.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The BROKA API could not complete this action.");
    }
  }

  function closeDialog() { setOpen(false); setConfirmation(""); setStatus("idle"); setMessage(""); setSelectedAction("flag"); }

  return <div className="space-y-6"><section className="border-b border-white/[0.07] pb-6"><Link href={`/${resource}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-amber-200"><ArrowLeft size={14} />Back to {formatRouteLabel(resource)}</Link><div className="mt-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><SectionEyebrow>{formatRouteLabel(resource)} operations</SectionEyebrow><h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">{config.title}</h1><p className="mt-2 text-sm text-slate-500">Reference <code className="rounded bg-white/[0.05] px-1.5 py-0.5 text-slate-300">{resourceId}</code></p></div><StatusBadge tone="warning">Detail contract required</StatusBadge></div></section><div className="grid gap-4 lg:grid-cols-2">{config.sections.map((section) => <section key={section} className="data-panel p-5"><p className="text-sm font-semibold text-slate-200">{section}</p><div className="mt-4"><ResourceState state="unavailable" message="This information is unavailable until the admin detail response is documented." /></div></section>)}</div><section className="data-panel border-rose-400/15 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-rose-300/20 bg-rose-400/[0.08] text-rose-200"><ShieldAlert size={17} /></span><div><p className="text-sm font-semibold text-slate-100">Administrative action guard</p><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">This interface never executes a sensitive operation directly from a table. Each action is allowlisted, confirmed, and sent through the server-only FastAPI boundary; backend authorization and audit records remain authoritative.</p></div></div>{hasApiAction ? <div className="flex flex-wrap gap-2">{["flag", "unflag", "recompute-trust", "promote-admin"].map((action) => <button key={action} onClick={() => { setSelectedAction(action); setOpen(true); }} className="rounded-lg border border-rose-300/20 bg-rose-400/[0.08] px-3 py-2 text-xs font-semibold capitalize text-rose-100 hover:bg-rose-400/[0.13]">{action.replaceAll("-", " ")}</button>)}</div> : <button disabled title="No verified backend mutation contract is available" className="rounded-lg border border-rose-300/20 bg-rose-400/[0.08] px-3 py-2 text-xs font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-40">Admin endpoint required</button>}</div></section>{open ? <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4" role="presentation"><div ref={dialogRef} className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#121722] p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-rose-300/20 bg-rose-400/[0.1] text-rose-200"><CircleAlert size={19} /></span><div><h2 id="confirm-title" className="text-base font-semibold text-white">Confirm {selectedAction.replaceAll("-", " ")} action</h2><p className="mt-1 text-sm leading-6 text-slate-400">Type <strong className="font-mono text-rose-200">CONFIRM</strong> to acknowledge the impact. BROKA API authorization remains final and the mutation response is not exposed to the browser.</p></div></div><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-5 h-10 w-full rounded-lg border border-white/[0.1] bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-rose-300/30" placeholder="Type CONFIRM" />{message ? <p role="status" className={`mt-3 text-xs leading-5 ${status === "error" ? "text-rose-200" : "text-emerald-200"}`}>{message}</p> : null}<div className="mt-5 flex justify-end gap-2"><button onClick={closeDialog} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-white/[0.05]">{status === "success" ? "Close" : "Cancel"}</button><button onClick={confirmAction} disabled={confirmation !== "CONFIRM" || status === "sending" || status === "success"} className="rounded-lg bg-rose-400/20 px-3 py-2 text-xs font-semibold text-rose-100 disabled:opacity-40">{status === "sending" ? "Sending…" : "Send verified request"}</button></div><div className="mt-4 flex gap-2 border-t border-white/[0.07] pt-4 text-[11px] text-slate-500"><FileText size={14} />The FastAPI backend is authoritative for the action and audit record.</div></div></div> : null}</div>;
}
