import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { DeltaChip, toneChip } from "@/components/intelligence/visuals";
import { InfoTip } from "@/components/ui/tooltip";
import { areaLabel, evidenceEntries, isInternalHref, relativeTime, formatCount } from "@/lib/intelligence";
import {
  type CommandInsight,
  type MetricRow,
  formatMetric,
  goodDirection,
  metricComparison,
  serverInstantIso,
  severityLabel,
  severityTone,
} from "@/lib/jarvis/command-centre";
import { cn } from "@/lib/utils";

/** A surface with the Jarvis glass treatment. Raised surfaces blur what sits behind them, so use them sparingly. */
export function GlassPanel({
  children,
  className,
  raised = false,
  labelledBy,
  as = "section",
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
  labelledBy?: string;
  as?: "section" | "div" | "article" | "aside";
}) {
  const Tag = as;
  return (
    <Tag aria-labelledby={labelledBy} className={cn("jv-glass p-5 sm:p-6", raised && "jv-glass-raised", className)}>
      {children}
    </Tag>
  );
}

export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  meta,
  actions,
}: {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a895ff]">{eyebrow}</p>
        <h2 id={id} className="font-display text-lg font-bold tracking-[-0.03em] text-white sm:text-xl">
          {title}
        </h2>
        {description ? <p className="max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
        {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** The one level-one heading of a Jarvis section. Sections below it use SectionHeader. */
export function PageHeading({
  eyebrow,
  title,
  description,
  meta,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a895ff]">{eyebrow}</p>
        <h1 className="font-display text-2xl font-bold tracking-[-0.04em] text-white sm:text-3xl">{title}</h1>
        {description ? <p className="max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
        {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/35 bg-[#8b75ff]/10 px-3 py-1.5 text-xs! font-semibold text-[#ded8ff] hover:border-[#8b75ff]/60"
    >
      <RefreshCw size={13} aria-hidden="true" />
      Retry
    </button>
  );
}

export type FreshnessKind = "live" | "recorded" | "snapshot" | "unavailable" | "checking";

const FRESHNESS_DOT: Record<FreshnessKind, string> = {
  live: "bg-cyan-300 shadow-[0_0_8px_rgba(84,215,233,0.8)]",
  recorded: "bg-slate-500",
  snapshot: "bg-[#8b75ff] shadow-[0_0_8px_rgba(139,117,255,0.7)]",
  unavailable: "bg-rose-400",
  checking: "bg-amber-300",
};

const FRESHNESS_TEXT: Record<FreshnessKind, string> = {
  live: "text-cyan-100",
  recorded: "text-slate-300",
  snapshot: "text-[#ded8ff]",
  unavailable: "text-rose-200",
  checking: "text-amber-100",
};

/**
 * What kind of information this is. "Live" only for values that arrived over
 * the alert stream while the page was open. "Snapshot" for an analytics
 * response with its generation time. "Recorded" for history.
 */
export function FreshnessTag({ kind, label, at }: { kind: FreshnessKind; label: string; at?: string | null }) {
  const iso = serverInstantIso(at);
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/[0.09] bg-black/25 px-2.5 py-1 text-[11px]">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", FRESHNESS_DOT[kind], kind === "live" && "live-dot")} aria-hidden="true" />
      <span className={cn("font-semibold", FRESHNESS_TEXT[kind])}>{label}</span>
      {iso ? <span className="truncate text-slate-500">· {relativeTime(iso)}</span> : null}
    </span>
  );
}

/** One headline figure. It states the value, the change, or why neither is shown. */
export function MetricTile({ label, row, href }: { label: string; row: MetricRow; href?: string }) {
  const { metric } = row;
  const value = formatMetric(metric);
  const comparison = metricComparison(metric);
  const target = href ?? metric?.href ?? null;

  let body: ReactNode;
  if (value !== null) {
    body = <p className="font-display text-[1.6rem] font-bold leading-none tracking-[-0.04em] text-white tabular-nums">{value}</p>;
  } else if (metric === null) {
    body = <p className="text-sm font-semibold text-slate-500">Not served by this backend</p>;
  } else if (!metric.available) {
    body = <p className="text-sm font-semibold text-slate-400">Unavailable</p>;
  } else {
    body = <p className="text-sm font-semibold text-slate-400">No value reported</p>;
  }

  return (
    <article className="jv-glass relative flex min-h-[9.5rem] flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        {metric?.definition ? (
          <InfoTip label={`How ${label} is measured`}>{metric.definition}</InfoTip>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {body}
        {metric && value === null && !metric.available && metric.unavailable_reason ? (
          <p className="text-xs leading-5 text-slate-500">{metric.unavailable_reason}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
        {comparison.change !== null ? (
          <DeltaChip change={comparison.change} good={goodDirection(metric?.good ?? "up")} />
        ) : (
          <span className="text-[11px] text-slate-600">No comparison</span>
        )}
        {target && isInternalHref(target) ? (
          <Link href={target} className="focus-ring inline-flex items-center gap-1 rounded-md text-[11px] font-semibold text-slate-400 hover:text-[#ded8ff]">
            Open <ArrowUpRight size={11} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/**
 * A deterministic signal from the command centre, with the figures it was
 * drawn from. The investigate button hands the signal to Zeno, which answers
 * from verified figures; it does not change anything.
 */
export function SignalCard({
  insight,
  onInvestigate,
  investigateDisabled,
}: {
  insight: CommandInsight;
  onInvestigate?: (question: string) => void;
  investigateDisabled?: boolean;
}) {
  const tone = severityTone(insight.severity);
  const entries = evidenceEntries(insight.evidence, 3);
  const action = insight.action && isInternalHref(insight.action.href) ? insight.action : null;
  return (
    <article className="jv-glass flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]", toneChip(tone))}>
          {severityLabel(insight.severity)}
        </span>
        <span className="text-[11px] text-slate-500">{areaLabel(insight.area)}</span>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold leading-5 text-slate-100">{insight.title}</p>
        {insight.detail ? <p className="line-clamp-3 text-sm leading-6 text-slate-400">{insight.detail}</p> : null}
      </div>
      {entries.length > 0 ? (
        <dl className="flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <div key={entry.key} className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1 text-[11px]">
              <dt className="inline text-slate-500">{entry.label} </dt>
              <dd className="inline font-semibold tabular-nums text-slate-200">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {onInvestigate ? (
          <button
            type="button"
            disabled={investigateDisabled}
            onClick={() => onInvestigate(`Investigate this signal: ${insight.title}`)}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/30 bg-[#8b75ff]/10 px-2.5 py-1 text-xs! font-semibold text-[#ded8ff] hover:border-[#8b75ff]/55 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Investigate with Zeno
          </button>
        ) : null}
        {action ? (
          <Link href={action.href} className="focus-ring inline-flex items-center gap-1 rounded-md text-xs font-semibold text-slate-300 hover:text-white">
            {action.label} <ArrowUpRight size={11} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/** A count with its label, for summary rows. Shows a dash when the count is not known. */
export function CountChip({ label, count, tone = "neutral" }: { label: string; count: number | null; tone?: "neutral" | "danger" | "warning" | "success" | "info" }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold", toneChip(tone))}>
      <span className="tabular-nums">{count === null ? "—" : formatCount(count)}</span>
      <span className="font-medium opacity-80">{label}</span>
    </span>
  );
}

export function EmptyNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm leading-6 text-slate-500", className)}>
      {children}
    </p>
  );
}
