"use client";

import { ArrowRight, LockKeyhole, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  // State updates are asynchronous; a second Enter before the re-render
  // used to send a second sign-in.
  const inFlight = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ phone, password }),
      });
      // A proxy or gateway error page is not JSON; say so plainly instead of
      // showing a parser error.
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Unable to sign in.");
      router.replace("/");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      inFlight.current = false;
      setStatus((current) => (current === "error" ? current : "idle"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#0c1020]/90 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-7">
      <div className="mb-7 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl border border-[#8b75ff]/30 bg-[#8b75ff]/10 text-[#ded8ff]"><LockKeyhole size={19} /></div><div><p className="text-base font-semibold text-slate-100">Administrator sign in</p><p className="mt-0.5 text-xs text-slate-500">BROKA API authentication</p></div></div>
      <div className="space-y-4"><label className="block"><span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">Phone number</span><div className="relative"><Smartphone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" required className="h-11 w-full rounded-lg border border-white/[0.09] bg-black/20 pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-[#8b75ff]/45 focus:ring-2 focus:ring-[#8b75ff]/15" placeholder="Your BROKA phone number" /></div></label><label className="block"><span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">Password</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required className="h-11 w-full rounded-lg border border-white/[0.09] bg-black/20 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-[#8b75ff]/45 focus:ring-2 focus:ring-[#8b75ff]/15" placeholder="Your BROKA password" /></label></div>
      {status === "error" ? <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-rose-400/20 bg-rose-400/[0.08] p-3 text-xs leading-5 text-rose-200"><TriangleAlert size={15} className="mt-0.5 shrink-0" />{message}</div> : null}
      <button disabled={status === "loading"} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#8b75ff] px-4 text-sm font-bold text-white shadow-[0_0_30px_rgba(139,117,255,0.35)] transition hover:bg-[#9d8bff] disabled:cursor-wait disabled:opacity-70">{status === "loading" ? "Verifying access…" : "Continue to Control Center"}<ArrowRight size={16} /></button>
      <div className="mt-5 flex gap-2 border-t border-white/[0.07] pt-4 text-[11px] leading-5 text-slate-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-300" />Only accounts verified by <code className="mx-1 rounded bg-white/[0.05] px-1 text-slate-300">/auth/me</code> with administrative access can enter. Access tokens remain in HttpOnly cookies.</div>
    </form>
  );
}
