"use client";

import { ArrowRight, ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CommandCenter } from "@/components/dashboard/command-center";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { PulseHero, PulseTiles, TargetsPanel, TrustStrip, type PulseWindow } from "@/components/intelligence/founder-pulse";
import { InsightFeed } from "@/components/intelligence/insight-feed";
import { Panel } from "@/components/intelligence/visuals";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import type { AdminIdentity } from "@/types/broka";
import { StatusBadge, UnavailablePanel } from "@/components/ui/primitives";

export function Overview({ admin }: { admin: AdminIdentity }) {
  const [range, setRange] = useState<PulseWindow>("7");
  const windowQuery = useMemo(() => new URLSearchParams({ window_days: range }), [range]);
  const pulse = useAdminResource("intelligencePulse", windowQuery);
  const insights = useAdminResource("intelligenceInsights", windowQuery);

  const summary = useAdminResource("summary");
  const summaryState = summary.isLoading ? "loading" : summary.isError ? "error" : summary.data ? "ready" : "schema-unavailable" as const;
  const snapshot = useAdminResource("opsSnapshot");
  const snapshotMissing = isEndpointMissing(snapshot.error);
  const snapshotState = snapshot.isLoading ? "loading" : snapshotMissing ? "not-deployed" : snapshot.isError ? "error" : snapshot.data ? "ready" : "unavailable" as const;
  const health = useAdminResource("serviceHealth");
  const healthState = health.isLoading ? "loading" : isEndpointMissing(health.error) ? "not-deployed" : health.isError ? "error" : health.data ? "ready" : "unavailable" as const;
  const someData = Boolean(summary.data || snapshot.data || pulse.data);
  const badgeTone = summary.isError ? "danger" : snapshot.isError ? "warning" : someData ? "success" : "warning";
  const badgeText = summary.isError ? "Backend unavailable" : snapshot.isError ? (snapshotMissing ? "Backend upgrade required" : "Ops snapshot unavailable") : someData ? "Live backend data" : "Loading operations data";
  const intelligenceMissing = isEndpointMissing(pulse.error);

  return <div className="space-y-6">
    <PulseHero
      pulse={pulse.data}
      adminName={admin.displayName}
      range={range}
      onRangeChange={setRange}
      status={<>
        <StatusBadge tone={badgeTone}>{badgeText}</StatusBadge>
        <Link href="/service-health" className="focus-ring inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-[#8b75ff]/40 hover:text-[#ded8ff]">Service health <ArrowUpRight size={14} aria-hidden="true" /></Link>
      </>}
    />

    {pulse.isLoading ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" aria-busy="true">{Array.from({ length: 7 }, (_, index) => <div key={index} className="h-[118px] animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.025]" />)}</div> : null}
    {pulse.isError ? (intelligenceMissing
      ? <UnavailablePanel title="Founder intelligence needs the upgraded BROKA API" detail="GET /admin/intelligence/pulse is not served by the connected backend yet. The verified platform totals below still work; the pulse, insights and targets appear after the backend deploy." />
      : <UnavailablePanel title="The marketplace pulse could not be loaded" detail={pulse.error.message} action={<button type="button" onClick={() => void pulse.refetch()} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200"><RefreshCw size={12} aria-hidden="true" />Retry</button>} />) : null}
    {pulse.data ? <PulseTiles pulse={pulse.data} /> : null}

    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,1fr)]">
      <Panel
        id="insights"
        eyebrow="Decision feed"
        title="What needs you"
        description="Ranked by urgency. Each card names the rule that fired and the numbers behind it, so you can act or disagree."
        actions={<Link href="/intelligence" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">Open intelligence <ArrowRight size={12} aria-hidden="true" /></Link>}
      >
        <InsightFeed data={insights.data} isLoading={insights.isLoading} error={insights.error} onRetry={() => void insights.refetch()} limit={6} columns={2} />
      </Panel>
      <div className="space-y-6">
        {pulse.data ? (
          <Panel
            eyebrow="Trust"
            title="Complaints desk"
            description="First-reply deadlines: urgent 4h, high 24h, normal 72h, low 5 days."
            actions={<Link href="/complaints" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">Open desk <ArrowRight size={12} aria-hidden="true" /></Link>}
          >
            <TrustStrip pulse={pulse.data} />
          </Panel>
        ) : null}
        {pulse.data ? <TargetsPanel pulse={pulse.data} /> : null}
      </div>
    </div>

    <KpiGrid state={summaryState} summary={summary.data} />
    <CommandCenter snapshot={snapshot.data} health={health.data} snapshotState={snapshotState} healthState={healthState} />
  </div>;
}
