import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { ZenoConfidence, ZenoEvidence } from "@/lib/api/jarvis-schemas";
import { describeEvidence, CONFIDENCE_META, type EvidenceView } from "@/lib/jarvis/presentation";
import { cn } from "@/lib/utils";

/** The certainty of a figure or claim. The label is text, so it never depends on colour alone. */
export function ConfidenceChip({ confidence, className }: { confidence: ZenoConfidence; className?: string }) {
  const meta = CONFIDENCE_META[confidence];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
        meta.chip,
        className,
      )}
      title={meta.hint}
    >
      {meta.label}
    </span>
  );
}

function FigureLine({ view }: { view: EvidenceView }) {
  if (view.state === "value") {
    return <p className="font-display text-xl font-bold tracking-[-0.03em] text-white tabular-nums">{view.valueText}</p>;
  }
  if (view.state === "unavailable") {
    return (
      <div>
        <p className="font-display text-base font-semibold text-slate-400">Unavailable</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{view.unavailableReason}</p>
      </div>
    );
  }
  if (view.state === "missing") {
    return <p className="text-sm font-medium text-slate-400">No value was reported for this period.</p>;
  }
  return <p className="text-sm text-slate-400">A structured value. Its metric key is in the details.</p>;
}

/**
 * One figure with the context needed to judge it. It states the value or the
 * reason there is none, and never shows an unavailable figure as zero.
 */
export function EvidenceCard({ evidence }: { evidence: ZenoEvidence }) {
  const view = describeEvidence(evidence);
  const unavailable = view.state === "unavailable";
  return (
    <article
      className={cn("inset-panel flex min-w-0 flex-col gap-3 p-4", unavailable && "border-dashed opacity-90")}
      aria-label={`${view.label}, ${view.confidenceMeta.label.toLowerCase()}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold leading-5 text-slate-100">{view.label}</p>
        <ConfidenceChip confidence={view.confidence} />
      </div>

      <div className="space-y-1">
        <FigureLine view={view} />
        {view.state !== "structured" ? (
          <p className="text-[11px] text-slate-500">Unit: {view.unitShort}</p>
        ) : null}
      </div>

      {!unavailable && view.previousText ? (
        <p className="text-xs text-slate-400">
          Previous value: <span className="tabular-nums text-slate-300">{view.previousText}</span>
        </p>
      ) : !unavailable ? (
        <p className="text-xs text-slate-500">Previous value: not reported</p>
      ) : null}

      <p className="text-[11px] leading-4 text-slate-500">
        {view.periodText}. Source: {view.source}
      </p>

      <details className="group text-xs text-slate-400">
        <summary className="focus-ring inline-flex cursor-pointer list-none items-center gap-1 rounded-md font-semibold text-[#a895ff] hover:text-[#ded8ff] [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Show figure details</span>
          <span className="hidden group-open:inline">Hide figure details</span>
        </summary>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-[11px] leading-4">
          <dt className="text-slate-500">Metric key</dt>
          <dd className="break-all font-mono text-slate-300">{view.metricKey}</dd>
          <dt className="text-slate-500">Unit</dt>
          <dd className="text-slate-300">{view.unitLabel}</dd>
          <dt className="text-slate-500">Source</dt>
          <dd className="break-all text-slate-300">{view.source}</dd>
          <dt className="text-slate-500">Definition</dt>
          <dd className="text-slate-300">{view.definition || "No definition was supplied."}</dd>
          <dt className="text-slate-500">Period</dt>
          <dd className="text-slate-300">{view.periodText}</dd>
          <dt className="text-slate-500">Generated</dt>
          <dd className="text-slate-300">{view.generatedText}</dd>
          <dt className="text-slate-500">Availability</dt>
          <dd className="text-slate-300">
            {unavailable ? `Unavailable. ${view.unavailableReason ?? ""}`.trim() : "Available"}
          </dd>
          <dt className="text-slate-500">Confidence</dt>
          <dd className="text-slate-300">
            {view.confidenceMeta.label}. {view.confidenceMeta.hint}
          </dd>
        </dl>
        {view.href ? (
          <Link
            href={view.href.href}
            className="focus-ring mt-3 inline-flex items-center gap-1 rounded-md font-semibold text-[#a895ff] hover:text-[#ded8ff]"
          >
            {view.href.label}
            <ArrowUpRight size={12} aria-hidden="true" />
          </Link>
        ) : null}
      </details>
    </article>
  );
}

/** Every figure behind an answer or briefing, collapsed until an administrator opens it. */
export function EvidenceList({
  evidence,
  title = "Evidence",
  emptyText = "No figures were attached to this answer.",
  defaultOpen = false,
}: {
  evidence: ZenoEvidence[];
  title?: string;
  emptyText?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group rounded-xl border border-white/[0.07] bg-black/15" open={defaultOpen || undefined}>
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs font-semibold text-slate-200 [&::-webkit-details-marker]:hidden">
        <span>
          {title} <span className="tabular-nums text-slate-500">({evidence.length})</span>
        </span>
        <span className="text-[#a895ff] group-open:hidden">Expand</span>
        <span className="hidden text-[#a895ff] group-open:inline">Collapse</span>
      </summary>
      <div className="border-t border-white/[0.06] p-4">
        {evidence.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyText}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {evidence.map((item) => (
              <EvidenceCard key={item.id} evidence={item} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
