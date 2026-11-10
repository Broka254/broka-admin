"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Link from "next/link";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { changeTone, formatChange, isInternalHref, type GoodDirection, type Tone } from "@/lib/intelligence";

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
export function ProgressBar({ value, max = 100, tone = "info", label }: { value: number | null | undefined; max?: number; tone?: Tone; label: string }) {
  const pct = value === null || value === undefined || !Number.isFinite(value) || max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const fill = tone === "success" ? "from-emerald-400 to-cyan-300" : tone === "warning" ? "from-amber-300 to-[#dbb75d]" : tone === "danger" ? "from-rose-400 to-amber-300" : "from-[#8b75ff] to-[#54d7e9]";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-700", fill)} style={{ width: `${pct}%` }} />
    </div>
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

/** One metric with its change; links into the surface that explains it. */
export function StatTile({ label, value, change, good = "up", caption, hint, icon, href, accent = "text-[#a895ff]" }: {
  label: string; value: string; change?: number | null; good?: GoodDirection; caption?: ReactNode; hint?: string; icon?: ReactNode; href?: string; accent?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">{label}</p>
        {icon ? <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.035]", accent)} aria-hidden="true">{icon}</span> : null}
      </div>
      <p className="mt-3 font-display text-[1.6rem] font-bold leading-none tracking-[-0.04em] text-white tabular-nums">{value}</p>
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
