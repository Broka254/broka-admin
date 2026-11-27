import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import type {
  ZenoClaim,
  ZenoEvidence,
  ZenoFinding,
  ZenoInvestigation,
  ZenoRecommendation,
} from "@/lib/api/jarvis-schemas";
import { dashboardLink, type DashboardLink } from "@/lib/jarvis/dashboard-links";
import { describeValue } from "@/lib/jarvis/presentation";
import { cn } from "@/lib/utils";

import { ConfidenceChip, EvidenceList } from "@/components/jarvis/evidence";

const DERIVATION_LABELS: Record<ZenoClaim["derivation"], string> = {
  value: "Stated value",
  previous_value: "Previous value",
  delta: "Change",
  pct_change: "Percent change",
};

const SYNTHESIS_TEXT: Record<ZenoInvestigation["synthesis"], string> = {
  model: "Written by the model from verified figures.",
  fallback: "Built from verified figures only, because the model's wording did not pass validation.",
  clarify: "Zeno needs more detail before it can investigate.",
  no_evidence: "No verified figures were available for this question.",
};

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{children}</h3>;
}

function ClaimRow({ claim }: { claim: ZenoClaim }) {
  const value = describeValue(claim.asserted_value, claim.unit);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
      <span className="font-mono text-[11px] text-slate-300">{claim.metric_key}</span>
      <span className="tabular-nums text-slate-200">
        {value.kind === "value" ? value.text : "No value stated"}
      </span>
      <span>{DERIVATION_LABELS[claim.derivation]}</span>
      <ConfidenceChip confidence={claim.confidence} />
    </li>
  );
}

function FindingItem({ finding, figures }: { finding: ZenoFinding; figures: Map<string, ZenoEvidence> }) {
  const resolved = finding.evidence.filter((reference) => figures.has(reference)).length;
  const missing = finding.evidence.length - resolved;
  // A finding with no figure behind it is an assertion, not a finding. It is
  // labelled that way and never styled as one.
  const unsupported = resolved === 0;
  return (
    <li className={cn("inset-panel space-y-3 p-4", unsupported && "border-dashed")}>
      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceChip confidence={finding.confidence} />
        {unsupported ? (
          <span className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100">
            No figures attached
          </span>
        ) : (
          <span className="text-[11px] text-slate-500">
            {resolved} figure{resolved === 1 ? "" : "s"} behind this finding
          </span>
        )}
      </div>
      <p className="text-sm leading-6 text-slate-200">{finding.statement}</p>
      {missing > 0 ? (
        <p className="text-xs text-amber-200/90">
          {missing} cited figure{missing === 1 ? " was" : "s were"} not returned with this answer.
        </p>
      ) : null}
      {finding.claims.length > 0 ? (
        <ul className="space-y-2 border-t border-white/[0.06] pt-3" aria-label="Stated figures">
          {finding.claims.map((claim, index) => (
            <ClaimRow key={`${claim.metric_key}-${index}`} claim={claim} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function PageLink({ page }: { page: DashboardLink }) {
  return (
    <Link
      href={page.href}
      className="focus-ring inline-flex items-center gap-1 rounded-lg border border-[#8b75ff]/25 bg-[#8b75ff]/10 px-2.5 py-1 text-xs font-semibold text-[#ded8ff] hover:border-[#8b75ff]/50"
    >
      {page.label}
      <ArrowUpRight size={12} aria-hidden="true" />
    </Link>
  );
}

function RecommendationItem({ recommendation }: { recommendation: ZenoRecommendation }) {
  const page = dashboardLink(recommendation.page);
  return (
    <li className="space-y-1.5 border-l border-white/10 pl-3">
      <p className="text-sm font-medium text-slate-100">{recommendation.action}</p>
      {recommendation.rationale ? <p className="text-xs leading-5 text-slate-400">{recommendation.rationale}</p> : null}
      {page ? <PageLink page={page} /> : null}
    </li>
  );
}

function InvestigationNote({ investigation }: { investigation: ZenoInvestigation }) {
  return (
    <details className="text-xs text-slate-500">
      <summary className="focus-ring inline-flex cursor-pointer list-none items-center gap-1 rounded-md font-semibold text-slate-400 hover:text-slate-200 [&::-webkit-details-marker]:hidden">
        How this answer was produced
      </summary>
      <div className="mt-2 space-y-1.5 rounded-lg border border-white/[0.06] bg-black/20 p-3 leading-5">
        <p className="text-slate-300">{SYNTHESIS_TEXT[investigation.synthesis]}</p>
        <p>
          Tools run: {investigation.tools_used.length ? investigation.tools_used.join(", ") : "none"}
        </p>
        {investigation.tool_errors.length > 0 ? (
          <p>Tools that returned no data: {investigation.tool_errors.join(", ")}</p>
        ) : null}
        <p>
          Provider: {investigation.provider ?? "not recorded"}
          {investigation.model ? ` · Model: ${investigation.model}` : ""}
        </p>
        <p>Time taken: {investigation.latency_ms.toLocaleString("en-KE")} ms</p>
      </div>
    </details>
  );
}

export type AnswerBlockProps = {
  headline: string;
  summary: string;
  evidence: ZenoEvidence[];
  limitations?: string[];
  findings?: ZenoFinding[];
  possibleCauses?: Array<{ statement: string }>;
  recommendations?: ZenoRecommendation[];
  relatedPages?: string[];
  suggestedQuestions?: string[];
  investigation?: ZenoInvestigation | null;
  onSuggest?: (question: string) => void;
  suggestionsDisabled?: boolean;
};

/**
 * One answer from Zeno. Findings are shown as claims only when the figures they
 * cite were returned with the answer. Possible causes are labelled as
 * hypotheses, and every figure can be opened to see where it came from.
 */
export function AnswerBlock({
  headline,
  summary,
  evidence,
  limitations = [],
  findings = [],
  possibleCauses = [],
  recommendations = [],
  relatedPages = [],
  suggestedQuestions = [],
  investigation = null,
  onSuggest,
  suggestionsDisabled = false,
}: AnswerBlockProps) {
  const figures = useMemo(() => new Map(evidence.map((item) => [item.metric_key, item])), [evidence]);
  const pages = relatedPages.map((page) => dashboardLink(page)).filter((page): page is DashboardLink => page !== null);

  return (
    <section aria-label="Zeno answer" className="space-y-5 border-l-2 border-[#8b75ff]/40 pl-4">
      <div className="space-y-2">
        <p className="font-display text-base font-semibold leading-6 tracking-[-0.02em] text-white">{headline}</p>
        {summary ? <p className="whitespace-pre-line text-sm leading-6 text-slate-300">{summary}</p> : null}
      </div>

      {findings.length > 0 ? (
        <div className="space-y-3">
          <SectionLabel>Findings</SectionLabel>
          <ul className="space-y-3">
            {findings.map((finding, index) => (
              <FindingItem key={index} finding={finding} figures={figures} />
            ))}
          </ul>
        </div>
      ) : null}

      {possibleCauses.length > 0 ? (
        <div className="space-y-2">
          <SectionLabel>Possible causes (hypotheses, not verified)</SectionLabel>
          <ul className="space-y-2">
            {possibleCauses.map((cause, index) => (
              <li key={index} className="text-sm italic leading-6 text-slate-400">
                {cause.statement}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div className="space-y-3">
          <SectionLabel>Recommended next steps</SectionLabel>
          <ul className="space-y-3">
            {recommendations.map((recommendation, index) => (
              <RecommendationItem key={index} recommendation={recommendation} />
            ))}
          </ul>
        </div>
      ) : null}

      {limitations.length > 0 ? (
        <div className="space-y-2">
          <SectionLabel>Limitations</SectionLabel>
          <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-slate-400">
            {limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {pages.length > 0 ? (
        <div className="space-y-2">
          <SectionLabel>Related pages</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {pages.map((page) => (
              <PageLink key={page.href} page={page} />
            ))}
          </div>
        </div>
      ) : null}

      {suggestedQuestions.length > 0 && onSuggest ? (
        <div className="space-y-2">
          <SectionLabel>Follow-up questions</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((question) => (
              <button
                key={question}
                type="button"
                disabled={suggestionsDisabled}
                onClick={() => onSuggest(question)}
                className="focus-ring rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-xs! text-slate-300 transition hover:border-[#8b75ff]/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <EvidenceList
        evidence={evidence}
        title="Evidence behind this answer"
        emptyText="No figures were attached. Treat this answer as context, not as a measured result."
      />

      {investigation ? <InvestigationNote investigation={investigation} /> : null}
    </section>
  );
}

/**
 * A question the administrator asked, kept compact so the answers stay the focus.
 * `step` labels a follow-up within its investigation; the first question has none.
 */
export function QuestionBubble({ text, pending = false, step }: { text: string; pending?: boolean; step?: number }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {step !== undefined ? (
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Step {step}</p>
      ) : null}
      <p
        className={cn(
          "max-w-[min(34rem,92%)] whitespace-pre-line rounded-2xl rounded-br-md border border-[#8b75ff]/25 bg-[#8b75ff]/10 px-4 py-2.5 text-sm leading-6 text-[#ece9ff]",
          pending && "opacity-70",
        )}
      >
        <span className="sr-only">You asked: </span>
        {text}
      </p>
    </div>
  );
}
