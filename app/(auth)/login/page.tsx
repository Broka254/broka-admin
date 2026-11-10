import { BadgeCheck, ShieldCheck, Waypoints } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";

const REASONS: Record<string, string> = {
  restricted: "Sign in with an administrator account to continue.",
  session: "Your session ended. Sign in again to pick up where you left off.",
  forbidden: "That account does not have administrator access to BROKA.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const reasonKey = typeof params.reason === "string" ? params.reason : "";
  const reason = Object.hasOwn(REASONS, reasonKey) ? REASONS[reasonKey] : null;
  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#05060d] px-5 py-8 sm:px-8 lg:items-center lg:px-12">
      <div className="absolute -left-28 top-12 h-96 w-96 rounded-full bg-[#8b75ff]/[0.12] blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-0 right-0 h-[480px] w-[480px] rounded-full bg-[#54d7e9]/[0.07] blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(390px,0.75fr)] lg:items-center">
        <section className="max-w-xl pt-4 lg:pt-0">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-[#8b75ff]/35 bg-[#8b75ff]/10"><img src="/brand/broka-mark.png" alt="BROKA" className="h-full w-full object-cover" /></div><div><p className="font-display text-xl font-black tracking-[-0.06em] text-white">BROKA</p><p className="mt-0.5 text-[9px] font-bold tracking-[0.32em] text-[#a895ff]">ADMIN CONTROL CENTER</p></div></div>
          <p className="mt-12 text-[10px] font-bold uppercase tracking-[0.22em] text-[#a895ff]">Future of Intelligent Commerce</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.065em] text-white sm:text-5xl">Operational state, <span className="text-slate-500">without assumptions.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">A restricted command center for BROKA marketplace operations, financial controls, trust and safety, and Zeno intelligence.</p>
          <div className="mt-9 grid gap-3 sm:grid-cols-3">{[[ShieldCheck, "Server verified", "Admin checks stay with the API"], [BadgeCheck, "Audit-aware", "Actions require backend evidence"], [Waypoints, "Contract-led", "No fabricated platform state"]].map(([Icon, title, body]) => { const IconComponent = Icon as typeof ShieldCheck; return <div key={title as string} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><IconComponent size={17} className="text-[#a895ff]" aria-hidden="true" /><p className="mt-3 text-xs font-semibold text-slate-200">{title as string}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{body as string}</p></div>; })}</div>
        </section>
        <div className="lg:justify-self-end">{reason ? <p role="status" className={`mb-4 max-w-md rounded-xl border px-4 py-3 text-xs leading-5 ${reasonKey === "forbidden" ? "border-rose-400/25 bg-rose-400/[0.08] text-rose-100" : "border-[#8b75ff]/25 bg-[#8b75ff]/[0.08] text-[#ded8ff]"}`}>{reason}</p> : null}<LoginForm /><p className="mt-4 max-w-md text-center text-[11px] leading-5 text-slate-600">This is a separate internal application. It does not connect directly to BROKA’s database and does not store access tokens in browser storage.</p></div>
      </div>
    </main>
  );
}
