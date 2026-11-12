"use client";

import { ArrowDownRight, ArrowUpRight, Minus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/tooltip";
import { changeTone, formatChange, isInternalHref, relativeTime, type GoodDirection, type Tone } from "@/lib/intelligence";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-slate-300",
  success: "text-emerald-300",
  warning: "text-amber-200",
  danger: "text-rose-300",
  info: "text-cyan-200",
};

const TONE_CHIP: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/[0.04] text-slate-300",
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  danger: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  info: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
};

export function toneText(tone: Tone) {
  return TONE_TEXT[tone];
}

export function toneChip(tone: Tone) {
  return TONE_CHIP[tone];
}

/** A change against the previous period, coloured by whether it helps. */
export function DeltaChip({ change, good = "up", label = "vs previous period", className }: { change: number | null | undefined; good?: GoodDirection; label?: string; className?: string }) {
  const tone = changeTone(change, good);
  const Icon = change === null || change === undefined || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  const text = formatChange(change);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums", TONE_CHIP[tone], className)} title={`${text} ${label}`}>
      <Icon size={12} aria-hidden="true" />
      <span>{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * A numeric change expressed in absolute units (users, listings, KES) rather
 * than a percentage. Used where a percent would overstate a tiny base.
 */
export function AbsoluteDelta({ current, previous, format, good = "up", label = "vs previous window" }: {
  current: number | null | undefined;
  previous: number | null | undefined;
  format: (value: number) => string;
  good?: GoodDirection;
  label?: string;
}) {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return <span className="text-[11px] text-slate-500">No comparison</span>;
  }
  const delta = current - previous;
  const pct = previous === 0 ? null : (delta / previous) * 100;
  const tone = changeTone(delta, good);
  const Icon = delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
      <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", toneText(tone))}>
        <Icon size={12} aria-hidden="true" />
        {delta > 0 ? "+" : ""}{format(delta)}
      </span>
      {pct !== null ? <span className="tabular-nums">({formatChange(pct)})</span> : <span>from zero</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Circular gauge for a percentage, with an optional target tick. `value`
 * null renders an empty track and "—": no data is not 0%.
 */
export function Ring({ value, target, size = 136, stroke = 10, label, caption, from = "#8b75ff", to = "#54d7e9" }: {
  value: number | null | undefined; target?: number; size?: number; stroke?: number; label: string; caption?: ReactNode; from?: string; to?: string;
}) {
  const gradientId = useId();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = value === null || value === undefined || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value));
  const dash = clamped === null ? 0 : (clamped / 100) * circumference;
  const targetAngle = target === undefined ? null : (Math.max(0, Math.min(100, target)) / 100) * 2 * Math.PI - Math.PI / 2;
  const centre = size / 2;
  return (
    <figure className="relative inline-grid place-items-center" style={{ width: size, height: size }} aria-label={`${label}: ${clamped === null ? "no data" : `${clamped.toFixed(1)}%`}${target !== undefined ? `, target ${target}%` : ""}`} role="img">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={centre} cy={centre} r={radius} fill="none" stroke="rgba(195,202,226,0.09)" strokeWidth={stroke} />
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${centre} ${centre})`}
          className="ring-arc"
          style={{ filter: "drop-shadow(0 0 6px rgba(139,117,255,0.45))" }}
        />
        {targetAngle !== null ? (
          <line
            x1={centre + (radius - stroke) * Math.cos(targetAngle)}
            y1={centre + (radius - stroke) * Math.sin(targetAngle)}
            x2={centre + (radius + stroke) * Math.cos(targetAngle)}
            y2={centre + (radius + stroke) * Math.sin(targetAngle)}
            stroke="#dbb75d"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <figcaption className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-[1.65rem] font-bold leading-none tracking-[-0.04em] text-white tabular-nums">{clamped === null ? "—" : `${clamped.toFixed(clamped >= 99.95 || Number.isInteger(clamped) ? 0 : 1)}%`}</p>
          {caption ? <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{caption}</div> : null}
        </div>
      </figcaption>
    </figure>
  );
}

/** Horizontal progress toward a target. */
export function ProgressBar({ value, max = 100, tone = "info", label, target }: { value: number | null | undefined; max?: number; tone?: Tone; label: string; target?: number }) {
  const known = value !== null && value !== undefined && Number.isFinite(value) && max > 0;
  const pct = known ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const targetPct = target === undefined || max <= 0 ? null : Math.max(0, Math.min(100, (target / max) * 100));
  const fill = tone === "success" ? "from-emerald-400 to-cyan-300" : tone === "warning" ? "from-amber-300 to-[#dbb75d]" : tone === "danger" ? "from-rose-400 to-amber-300" : "from-[#8b75ff] to-[#54d7e9]";
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={known ? Math.round(pct) : undefined}>
      <div className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-700", fill)} style={{ width: `${pct}%` }} />
      {targetPct !== null ? <span className="absolute inset-y-[-2px] w-[2px] rounded-full bg-[#dbb75d]/90" style={{ left: `calc(${targetPct}% - 1px)` }} aria-hidden="true" /> : null}
    </div>
  );
}

/**
 * Two-bar comparison for a snapshot metric. The previous bar is deliberately
 * muted: it is context, not a second headline number.
 */
export function ComparisonBars({ current, previous, format, label, currentLabel = "This window", previousLabel = "Previous" }: {
  current: number;
  previous: number;
  format: (value: number) => string;
  label: string;
  currentLabel?: string;
  previousLabel?: string;
}) {
  const max = Math.max(1, current, previous);
  return (
    <figure aria-label={`${label}: ${currentLabel} ${format(current)}, ${previousLabel} ${format(previous)}`} className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] uppercase tracking-[0.1em] text-slate-500">{currentLabel}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-gradient-to-r from-[#8b75ff] to-[#54d7e9]" style={{ width: `${(current / max) * 100}%` }} /></div>
        <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-white">{format(current)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] uppercase tracking-[0.1em] text-slate-600">{previousLabel}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]"><div className="h-full rounded-full bg-slate-500/60" style={{ width: `${(previous / max) * 100}%` }} /></div>
        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{format(previous)}</span>
      </div>
    </figure>
  );
}

/** A dependency-free sparkline for compact trend context. */
export function Sparkline({ values, label, height = 34, tone = "#8b75ff" }: { values: number[]; label: string; height?: number; tone?: string }) {
  if (values.length < 2) return <div className="h-[34px] rounded-md border border-dashed border-white/[0.07]" aria-hidden="true" />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${height - ((value - min) / span) * (height - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-[34px] w-full" role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke={tone} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${height} ${points} 100,${height}`} fill={tone} opacity="0.08" stroke="none" />
    </svg>
  );
}

/** Section shell shared by every intelligence surface. */
export function Panel({ id, eyebrow, title, description, actions, children, className }: {
  id?: string; eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section id={id} className={cn("holo-panel scroll-mt-24 p-5 sm:p-6", className)} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a895ff]">{eyebrow}</p> : null}
          <h2 id={id ? `${id}-title` : undefined} className="mt-1 font-display text-lg font-bold tracking-[-0.03em] text-white">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** The consistent page header used by every operational workspace. */
export function PageHeader({ eyebrow, title, description, actions, icon, meta }: {
  eyebrow: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; icon?: ReactNode; meta?: ReactNode;
}) {
  return (
    <header className="instrument-panel px-5 py-5 sm:px-6">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-50 constellation" aria-hidden="true" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#8b75ff]/30 bg-[#8b75ff]/10 text-[#c9beff]" aria-hidden="true">{icon}</span> : null}
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a895ff]">{eyebrow}</p>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-white sm:text-[1.9rem]">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
          {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/**
 * Provenance for an analytical view: what the numbers are, when they were
 * computed and over which window. Never claims a live feed when a snapshot
 * is what the endpoint returned.
 */
export function DataFreshness({ generatedAt, windowLabel, source, state = "ready", className }: {
  generatedAt?: string | null;
  windowLabel?: string;
  source?: string;
  state?: "loading" | "ready" | "error" | "unavailable";
  className?: string;
}) {
  const label = state === "loading" ? "Loading data" : state === "error" ? "Refresh failed" : state === "unavailable" ? "Data unavailable" : "Snapshot data";
  return (
    <span className={cn("freshness-chip", className)}>
      <span className="freshness-dot" data-state={state} aria-hidden="true" />
      <span className="font-semibold text-slate-300">{label}</span>
      {generatedAt ? <span className="text-slate-500">· generated {relativeTime(generatedAt)}</span> : null}
      {windowLabel ? <span className="hidden text-slate-600 sm:inline">· {windowLabel}</span> : null}
      {source ? <InfoTip label="Data provenance">{`${source}${generatedAt ? ` Generated at ${generatedAt}.` : ""}`}</InfoTip> : null}
    </span>
  );
}

/** The band that introduces a major dashboard section outside a panel. */
export function SectionHeading({ id, eyebrow, title, description, meta, actions, className }: {
  id?: string; eyebrow: string; title: ReactNode; description?: ReactNode; meta?: ReactNode; actions?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a895ff]">
          <span className="h-1 w-1 rounded-full bg-[#54d7e9] shadow-[0_0_8px_rgba(84,215,233,0.8)]" aria-hidden="true" />
          {eyebrow}
        </p>
        <h2 id={id} className="mt-1.5 font-display text-lg font-bold tracking-[-0.03em] text-white">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{description}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** One metric with its change; links into the surface that explains it. */
export function StatTile({ label, value, change, good = "up", caption, hint, icon, href, accent = "text-[#a895ff]", unavailable = false }: {
  label: string; value: string; change?: number | null; good?: GoodDirection; caption?: ReactNode; hint?: string; icon?: ReactNode; href?: string; accent?: string; unavailable?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">{label}</p>
        {icon ? <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.035]", accent)} aria-hidden="true">{icon}</span> : null}
      </div>
      <p className={cn("mt-3 font-display text-[1.6rem] font-bold leading-none tracking-[-0.04em] tabular-nums", unavailable ? "text-slate-600" : "text-white")}>{value}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        {change !== undefined ? <DeltaChip change={change} good={good} /> : null}
        {caption ? <span className="min-w-0 truncate">{caption}</span> : null}
      </div>
    </>
  );
  const className = "stat-tile group focus-ring block";
  if (href && isInternalHref(href)) return <Link href={href} className={className} title={hint}>{body}</Link>;
  return <div className={className} title={hint}>{body}</div>;
}

/**
 * A compact metric card with a definition, optional comparison and a route.
 * Used for the marketplace pulse and the North Star indicators.
 */
export function MetricCard({ label, value, caption, change, good = "up", hint, icon, href, accent = "text-[#a895ff]", footer, badge }: {
  label: string;
  value: string;
  caption?: ReactNode;
  change?: number | null;
  good?: GoodDirection;
  hint?: string;
  icon?: ReactNode;
  href?: string;
  accent?: string;
  footer?: ReactNode;
  badge?: ReactNode;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          {hint ? <span className="pointer-events-auto"><InfoTip label={`How ${label} is calculated`}>{hint}</InfoTip></span> : null}
        </div>
        {icon ? <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04]", accent)} aria-hidden="true">{icon}</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <p className="font-display text-[1.55rem] font-bold leading-none tracking-[-0.04em] text-white tabular-nums">{value}</p>
        {badge}
      </div>
      {caption ? <div className="mt-2 text-[11px] leading-4 text-slate-500">{caption}</div> : null}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.055] pt-2.5">
        {change !== undefined ? <DeltaChip change={change} good={good} /> : <span className="text-[10px] text-slate-600">point in time</span>}
        {footer ?? (href ? <span className="text-[10px] font-semibold text-slate-600 transition group-hover:text-[#a895ff]">Open →</span> : null)}
      </div>
    </>
  );
  // The navigation target is a stretched link behind the content, so the
  // definition button remains a valid sibling button rather than a button
  // nested inside an anchor.
  return (
    <div className="stat-tile group relative h-full">
      <div className="pointer-events-none relative z-10">{content}</div>
      {href && isInternalHref(href) ? <Link href={href} className="focus-ring absolute inset-0 z-0 rounded-[1rem]" aria-label={`Open ${label}`} /> : null}
    </div>
  );
}

export function Chip({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]", TONE_CHIP[tone], className)}>{children}</span>;
}

/** A pill-shaped segmented control bound to a value. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-white/[0.08] bg-black/20 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            option.value === value ? "bg-[#8b75ff]/20 text-[#ded8ff] shadow-[inset_0_0_0_1px_rgba(139,117,255,0.45)]" : "text-slate-400 hover:text-slate-100",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A contextual side panel. It keeps the analytical page visible, traps no
 * global state, closes on Escape and returns focus to the opener.
 */
export function DetailDrawer({ open, onClose, title, subtitle, children, footer }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={title} className="drawer-panel flex h-full w-full max-w-md flex-col border-l border-[#8b75ff]/25 bg-[#080a14] shadow-[-30px_0_90px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a895ff]">Context</p>
            <h2 className="mt-1 font-display text-lg font-bold text-white">{title}</h2>
            {subtitle ? <div className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</div> : null}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="focus-ring rounded-lg border border-white/[0.09] p-2 text-slate-400 hover:text-white" aria-label="Close panel"><X size={16} aria-hidden="true" /></button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="border-t border-white/[0.07] px-5 py-4">{footer}</div> : null}
      </aside>
    </div>
  );
}
