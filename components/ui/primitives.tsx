import { AlertCircle, CheckCircle2, CircleDashed, Info, LockKeyhole, ShieldX, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/[0.035] text-slate-300",
  success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  warning: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  danger: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  info: "border-sky-400/20 bg-sky-400/10 text-sky-200",
};

export function StatusBadge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]", toneClasses[tone], className)}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{children}</span>;
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/80">{children}</p>;
}

export function UnavailablePanel({ title, detail, action, compact = false }: { title: string; detail: string; action?: ReactNode; compact?: boolean }) {
  return <div className={cn("contract-panel", compact ? "p-4" : "p-6")}><div className="flex items-start gap-3"><div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-300/15 bg-amber-300/10 text-amber-200"><Info size={16} aria-hidden="true" /></div><div className="min-w-0"><p className="text-sm font-semibold text-slate-100">{title}</p><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{detail}</p>{action ? <div className="mt-4">{action}</div> : null}</div></div></div>;
}

type ResourceStateName = "loading" | "error" | "empty" | "unavailable" | "unauthorized" | "forbidden";

export function ResourceState({ state, message, action }: { state: ResourceStateName; message: string; action?: ReactNode }) {
  const icon = {
    loading: <CircleDashed className="animate-spin" size={18} aria-hidden="true" />,
    error: <WifiOff size={18} aria-hidden="true" />,
    empty: <CheckCircle2 size={18} aria-hidden="true" />,
    unavailable: <AlertCircle size={18} aria-hidden="true" />,
    unauthorized: <LockKeyhole size={18} aria-hidden="true" />,
    forbidden: <ShieldX size={18} aria-hidden="true" />,
  }[state];
  const tone = state === "error" || state === "forbidden" ? "danger" : state === "unavailable" ? "warning" : "info";
  return <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10 p-5 text-center"><div><div className={cn("mx-auto grid h-10 w-10 place-items-center rounded-full", toneClasses[tone])}>{icon}</div><p className="mt-3 text-sm font-medium text-slate-200">{message}</p>{action ? <div className="mt-3">{action}</div> : null}</div></div>;
}
