import Link from "next/link";
import { ArrowUpRight, Bot } from "lucide-react";
import { useMemo } from "react";

import { DataFreshness, Panel } from "@/components/intelligence/visuals";
import { SkeletonPanel } from "@/components/ui/primitives";
import { JarvisRequestError, type useJarvisBriefing } from "@/hooks/use-jarvis";
import type { ZenoBriefing, ZenoBriefingFinding, ZenoBriefingOpportunity, ZenoEvidence } from "@/lib/api/jarvis-schemas";
import { dashboardLink } from "@/lib/jarvis/dashboard-links";
import {
  areaLabel,
  BRIEFING_GROUP_ORDER,
  describeEvidence,
  formatUtc,
  freshnessRows,
  GROUP_TITLES,
  jarvisErrorKind,
  periodText,
  SEVERITY_META,
  WINDOW_OPTIONS,
  windowLabel,
  type BriefingGroup,
} from "@/lib/jarvis/presentation";
import { cn } from "@/lib/utils";

import { EvidenceList } from "@/components/jarvis/evidence";
import { JarvisNotice } from "@/components/jarvis/readiness";

function WindowSelect({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-400">
      <span className="whitespace-nowrap">Briefing window</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="focus-ring rounded-lg border border-white/12 bg-[#080a14] px-2.5 py-1.5 text-xs font-semibold text-slate-100"
      >
        {WINDOW_OPTIONS.map((days) => (
          <option key={days} value={days}>
            {windowLabel(days)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** One cited figure in compact form. The full card, with every detail, is in the list at the foot of the briefing. */
function CitedFigure({ evidence }: { evidence: ZenoEvidence }) {
  const view = describeEvidence(evidence);
  const value =
    view.state === "value"
      ? view.valueText
      : view.state === "unavailable"
        ? `Unavailable: ${view.unavailableReason}`
        : "No value reported";
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2">
      <span className="min-w-0 text-slate-300">{view.label}</span>
      <span className={cn("text-right tabular-nums", view.state === "value" ? "text-slate-200" : "text-slate-500")}>
        {value}
      </span>
    </li>
  );
}

function FindingCard({
  finding,
  figures,
  onInvestigate,
  investigateDisabled,
}: {
  finding: ZenoBriefingFinding;
  figures: Map<string, ZenoEvidence>;
  onInvestigate: (question: string) => void;
  investigateDisabled: boolean;
}) {
  const meta = SEVERITY_META[finding.severity];
  const link = dashboardLink(finding.href);
  const resolved = finding.evidence.map((reference) => ({ reference, item: figures.get(reference) ?? null }));
  const figureCount = resolved.filter((entry) => entry.item !== null).length;
  return (
    <article className="priority-row space-y-3" data-tone={meta.railTone}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
            meta.chip,
          )}
        >
          {meta.label}
        </span>
        <span className="text-[11px] text-slate-500">{areaLabel(finding.area)}</span>
        {finding.evidence_backed && figureCount > 0 ? (
          <span className="text-[11px] text-slate-500">
            {figureCount} figure{figureCount === 1 ? "" : "s"} behind this signal
          </span>
        ) : (
          <span className="text-[11px] italic text-slate-500">Signal only. No quantitative figure is attached.</span>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold leading-5 text-slate-100">{finding.title}</p>
        {finding.detail ? <p className="text-sm leading-6 text-slate-400">{finding.detail}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={investigateDisabled}
          onClick={() => onInvestigate(`Investigate this signal: ${finding.title}`)}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/30 bg-[#8b75ff]/10 px-2.5 py-1 text-xs! font-semibold text-[#ded8ff] hover:border-[#8b75ff]/55 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Bot size={12} aria-hidden="true" />
          Ask Zeno to investigate
        </button>
        {link ? (
          <Link
            href={link.href}
            className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Open {link.label}
            <ArrowUpRight size={12} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {resolved.length > 0 ? (
        <details className="group border-t border-white/[0.06] pt-3 text-xs text-slate-400">
          <summary className="focus-ring inline-flex cursor-pointer list-none items-center gap-1 rounded-md font-semibold text-[#a895ff] hover:text-[#ded8ff] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show the figures behind this signal</span>
            <span className="hidden group-open:inline">Hide the figures</span>
          </summary>
          <ul className="mt-3 space-y-2">
            {resolved.map(({ reference, item }) =>
              item ? (
                <CitedFigure key={reference} evidence={item} />
              ) : (
                <li key={reference} className="text-slate-500">
                  The figure <span className="font-mono text-[11px]">{reference}</span> was not returned with this briefing.
                </li>
              ),
            )}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

function FindingGroup({
  group,
  title,
  findings,
  figures,
  onInvestigate,
  investigateDisabled,
}: {
  group: BriefingGroup;
  title: string;
  findings: ZenoBriefingFinding[];
  figures: Map<string, ZenoEvidence>;
  onInvestigate: (question: string) => void;
  investigateDisabled: boolean;
}) {
  return (
    <section aria-labelledby={`briefing-group-${group}`} className="space-y-3">
      <h3 id={`briefing-group-${group}`} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {title}
        <span className="tabular-nums text-slate-600">({findings.length})</span>
      </h3>
      {findings.length === 0 ? (
        <p className="text-sm text-slate-500">None in this window.</p>
      ) : (
        <ul className="space-y-3">
          {findings.map((finding) => (
            <li key={finding.id}>
              <FindingCard
                finding={finding}
                figures={figures}
                onInvestigate={onInvestigate}
                investigateDisabled={investigateDisabled}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OpportunityItem({ opportunity }: { opportunity: ZenoBriefingOpportunity }) {
  const link = dashboardLink(opportunity.href);
  return (
    <li className="space-y-1 border-l border-emerald-400/30 pl-3">
      <p className="text-sm font-semibold text-slate-100">{opportunity.title}</p>
      {opportunity.detail ? <p className="text-xs leading-5 text-slate-400">{opportunity.detail}</p> : null}
      {link ? (
        <Link
          href={link.href}
          className="focus-ring inline-flex items-center gap-1 text-xs font-semibold text-emerald-200 hover:text-emerald-100"
        >
          Open {link.label}
          <ArrowUpRight size={11} aria-hidden="true" />
        </Link>
      ) : null}
    </li>
  );
}

function BriefingBody({
  data,
  windowDays,
  onInvestigate,
  investigateDisabled,
}: {
  data: ZenoBriefing;
  windowDays: number;
  onInvestigate: (question: string) => void;
  investigateDisabled: boolean;
}) {
  const figures = useMemo(() => new Map(data.evidence.map((item) => [item.metric_key, item])), [data.evidence]);
  const groups = useMemo(() => {
    const byGroup = new Map<BriefingGroup, ZenoBriefingFinding[]>(BRIEFING_GROUP_ORDER.map((group) => [group, []]));
    for (const finding of data.priority_findings) {
      byGroup.get(SEVERITY_META[finding.severity].group)?.push(finding);
    }
    return byGroup;
  }, [data.priority_findings]);
  const freshness = freshnessRows(data.data_freshness);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="font-display text-lg font-semibold leading-7 tracking-[-0.02em] text-white sm:text-xl">{data.headline}</p>
        <p className="max-w-4xl whitespace-pre-line text-sm leading-6 text-slate-300">{data.executive_summary}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <DataFreshness
            generatedAt={data.generated_at}
            label={data.cached ? "Recent briefing" : "Current briefing"}
            windowLabel={windowLabel(windowDays)}
            source="Built from BROKA's deterministic analytics. No language model writes the briefing."
          />
          <span>Reporting period: {periodText(data.period)}</span>
        </div>
      </div>

      {data.priority_findings.length === 0 ? (
        <p className="rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm text-slate-400">
          No priority signals were raised for this window. The limitations below state what this briefing does not cover.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {BRIEFING_GROUP_ORDER.map((group) => {
            const findings = groups.get(group) ?? [];
            if (group === "context" && findings.length === 0) return null;
            return (
              <FindingGroup
                key={group}
                group={group}
                title={GROUP_TITLES[group]}
                findings={findings}
                figures={figures}
                onInvestigate={onInvestigate}
                investigateDisabled={investigateDisabled}
              />
            );
          })}
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Opportunities, investigations and limitations">
          <section aria-labelledby="briefing-opportunities" className="space-y-3">
            <h3 id="briefing-opportunities" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Business and marketplace opportunities
            </h3>
            {data.opportunities.length === 0 ? (
              <p className="text-sm text-slate-500">No opportunities were identified in this window.</p>
            ) : (
              <ul className="space-y-3">
                {data.opportunities.map((opportunity, index) => (
                  <OpportunityItem key={`${opportunity.title}-${index}`} opportunity={opportunity} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="briefing-investigations" className="space-y-3">
            <h3 id="briefing-investigations" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Recommended investigations
            </h3>
            {data.recommended_investigations.length === 0 ? (
              <p className="text-sm text-slate-500">No investigations are recommended for this window.</p>
            ) : (
              <ul className="space-y-2">
                {data.recommended_investigations.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <button
                      type="button"
                      disabled={investigateDisabled}
                      onClick={() => onInvestigate(`Investigate: ${item}`)}
                      className="focus-ring w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-left text-xs! leading-5 text-slate-300 transition hover:border-[#8b75ff]/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="briefing-freshness" className="space-y-3">
            <h3 id="briefing-freshness" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Data freshness
            </h3>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Generated</dt>
                <dd className="text-right text-slate-300">{formatUtc(data.generated_at)}</dd>
              </div>
              {freshness.map((row) => (
                <div key={row.label} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd className="text-right text-slate-300">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {data.limitations.length > 0 ? (
            <section aria-labelledby="briefing-limitations" className="space-y-3">
              <h3 id="briefing-limitations" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Limitations
              </h3>
              <ul className="list-disc space-y-1.5 pl-4 text-xs leading-5 text-slate-400">
                {data.limitations.map((limitation, index) => (
                  <li key={index}>{limitation}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <EvidenceList
        evidence={data.evidence}
        title="Figures used in this briefing"
        emptyText="This briefing carries no quantitative figures."
      />
    </div>
  );
}

export function BriefingPanel({
  query,
  windowDays,
  onWindowChange,
  onInvestigate,
  investigateDisabled,
}: {
  query: ReturnType<typeof useJarvisBriefing>;
  windowDays: number;
  onWindowChange: (days: number) => void;
  onInvestigate: (question: string) => void;
  investigateDisabled: boolean;
}) {
  const error = query.error instanceof JarvisRequestError ? query.error : null;
  return (
    <Panel
      id="jarvis-briefing"
      eyebrow="Zeno briefing"
      title="Executive briefing"
      description="The state of the business for the window you choose, with the figures behind each signal. A signal without a figure is labelled as one."
      actions={<WindowSelect value={windowDays} onChange={onWindowChange} />}
    >
      {query.isPending ? (
        <div aria-busy="true">
          <p className="sr-only" role="status">
            Loading the briefing
          </p>
          <SkeletonPanel rows={3} />
        </div>
      ) : query.error ? (
        <JarvisNotice
          kind={jarvisErrorKind(error?.code, error?.status ?? 0)}
          onRetry={() => void query.refetch()}
          retryAfterSeconds={error?.retryAfterSeconds ?? null}
        />
      ) : query.data ? (
        <BriefingBody
          data={query.data}
          windowDays={windowDays}
          onInvestigate={onInvestigate}
          investigateDisabled={investigateDisabled}
        />
      ) : null}
    </Panel>
  );
}
