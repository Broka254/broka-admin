"use client";

import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { FinancialIntelligence } from "@/components/dashboard/financial-intelligence";
import { MarketplaceActivity } from "@/components/dashboard/analytics/marketplace-activity";
import { MarketplaceMovement } from "@/components/dashboard/marketplace-movement";
import { OperationsAndRisk } from "@/components/dashboard/operations-risk";
import { PriorityQueue } from "@/components/dashboard/priority-queue";
import { EngagementTrends } from "@/components/dashboard/command-center/engagement-trends";
import { ExecutiveOverview } from "@/components/dashboard/command-center/executive-overview";
import { LiveActivityStrip } from "@/components/dashboard/user-intelligence/user-intelligence-view";
import { PulseHero, PulseTiles, TargetsPanel, TrustStrip, type PulseWindow } from "@/components/intelligence/founder-pulse";
import { Panel, SectionHeading } from "@/components/intelligence/visuals";
import { StatusBadge, UnavailablePanel } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import { useAlertsStream } from "@/hooks/use-alerts-stream";
import type { AdminIdentity } from "@/types/broka";

function rangeFromSearch(value: string | null): PulseWindow {
  return value === "30" ? "30" : "7";
}

function OverviewBody({ admin }: { admin: AdminIdentity }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = rangeFromSearch(searchParams.get("pulse"));
  const windowQuery = useMemo(() => new URLSearchParams({ window_days: range }), [range]);
  // One read gives the grouped figures, the decision feed and the pulse the
  // other sections render, so the pulse is computed once per refresh.
  const command = useAdminResource("commandCenter", windowQuery);
  // When that read fails - an older backend without it (404) or an error -
  // the sections that existed before it keep working from their own
  // endpoints, so one new aggregate cannot take the whole page down.
  const legacy = command.isError;
  const commandMissing = isEndpointMissing(command.error);
  const legacyPulse = useAdminResource("intelligencePulse", windowQuery, legacy);
  const legacyInsights = useAdminResource("intelligenceInsights", windowQuery, legacy);
  const summary = useAdminResource("summary");
  const health = useAdminResource("health");
  const snapshot = useAdminResource("opsSnapshot");
  const serviceHealth = useAdminResource("serviceHealth");
  const stream = useAlertsStream();

  const pulseData = command.data?.pulse ?? legacyPulse.data;
  const pulseLoading = command.isLoading || (legacy && legacyPulse.isLoading);
  const pulseError = legacy ? legacyPulse.error : command.error;
  const insightsData = command.data?.decisions ?? legacyInsights.data;
  const insightsLoading = command.isLoading || (legacy && legacyInsights.isLoading);
  const insightsError = legacy ? legacyInsights.error : command.error;
  const retryPulse = () => void (legacy ? legacyPulse.refetch() : command.refetch());

  function changeRange(value: PulseWindow) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "30") next.set("pulse", "30"); else next.delete("pulse");
    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  const summaryState = summary.isLoading ? "loading" : summary.isError ? "error" : summary.data ? "ready" : "schema-unavailable" as const;
  const snapshotMissing = isEndpointMissing(snapshot.error);
  const snapshotState = snapshot.isLoading ? "loading" : snapshotMissing ? "not-deployed" : snapshot.isError ? "error" : snapshot.data ? "ready" : "unavailable" as const;
  const healthState = serviceHealth.isLoading ? "loading" : isEndpointMissing(serviceHealth.error) ? "not-deployed" : serviceHealth.isError ? "error" : serviceHealth.data ? "ready" : "unavailable" as const;
  const intelligenceMissing = legacy && isEndpointMissing(legacyPulse.error);
  const apiState = health.isLoading ? "checking" : health.isSuccess ? "healthy" : "failed";
  const connectionBadge = {
    checking: { tone: "neutral" as const, label: "Checking backend" },
    healthy: { tone: "success" as const, label: "Backend healthy" },
    failed: { tone: "danger" as const, label: "Backend health failed" },
  }[apiState];
  const liveBadge = stream.status === "connected" ? { tone: "success" as const, label: "Alert stream live" } : stream.status === "connecting" ? { tone: "warning" as const, label: "Stream connecting" } : { tone: "neutral" as const, label: "Stream offline" };
  const windowDays = Number(range);

  return (
    <div className="space-y-8">
      <PulseHero
        pulse={pulseData}
        adminName={admin.displayName}
        range={range}
        onRangeChange={changeRange}
        status={<>
          <StatusBadge tone={connectionBadge.tone}>{connectionBadge.label}</StatusBadge>
          <StatusBadge tone={liveBadge.tone}>{liveBadge.label}</StatusBadge>
        </>}
      />

      {commandMissing ? (
        <UnavailablePanel
          compact
          title="The grouped Command Center figures need the upgraded BROKA API"
          detail="GET /admin/command-center is not served by the connected backend yet. The sections below read their own endpoints until it is."
        />
      ) : (
        <ExecutiveOverview data={command.data} isLoading={command.isLoading} error={command.error} onRetry={() => void command.refetch()} />
      )}

      <section aria-labelledby="live-activity-title" className="space-y-3">
        <SectionHeading
          id="live-activity-title"
          eyebrow="02 · Real-time activity"
          title="Who is in the app now"
          description="Foreground heartbeats only. The full picture, with DAU, WAU, MAU and retention, is on User intelligence."
          actions={<Link href="/analytics/users" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">User intelligence <ArrowRight size={12} aria-hidden="true" /></Link>}
        />
        <LiveActivityStrip />
      </section>

      <section aria-labelledby="engagement-title" className="space-y-3">
        <SectionHeading id="engagement-title" eyebrow="03 · Growth and engagement" title="How use and sign-ups are moving" />
        <EngagementTrends windowDays={windowDays} />
      </section>

      <section aria-labelledby="marketplace-title" className="space-y-4">
        <SectionHeading id="marketplace-title" eyebrow="04 · Marketplace intelligence" title="Supply, demand and activity" />
        {pulseLoading ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-busy="true">{Array.from({ length: 10 }, (_, index) => <div key={index} className="skeleton h-[148px]" />)}</div> : null}
        {!pulseLoading && !pulseData && pulseError ? (intelligenceMissing
          ? <UnavailablePanel title="Founder intelligence needs the upgraded BROKA API" detail="GET /admin/intelligence/pulse is not served by the connected backend yet. The verified platform totals below still work; the pulse, North Star indicators and targets appear after the backend deploy." />
          : <UnavailablePanel title="The marketplace pulse could not be loaded" detail={pulseError instanceof Error ? pulseError.message : "The marketplace pulse could not be loaded."} action={<button type="button" onClick={retryPulse} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200"><RefreshCw size={12} aria-hidden="true" />Retry</button>} />) : null}
        {pulseData ? <PulseTiles pulse={pulseData} /> : null}
        <MarketplaceMovement snapshot={snapshot.data} state={snapshotState} />
        <MarketplaceActivity windowDays={windowDays} />
      </section>

      <section aria-labelledby="money-title" className="space-y-3">
        <SectionHeading id="money-title" eyebrow="05 · Revenue and financial performance" title="What BROKA earned and spent" />
        {pulseData ? <FinancialIntelligence pulse={pulseData} /> : (
          <Panel eyebrow="Financial intelligence" title="Platform economics">
            <div className="space-y-2" aria-busy="true"><div className="skeleton h-20" /><div className="skeleton h-20" /></div>
          </Panel>
        )}
      </section>

      <section aria-labelledby="trust-title" className="space-y-3">
        <SectionHeading id="trust-title" eyebrow="06 · Trust and safety" title="Complaints and their deadlines" description="Flagged, suspended and restricted accounts, disputes and fraud are in the executive overview above." />
        {pulseData ? (
          <Panel
            eyebrow="Trust"
            title="Complaints desk"
            description="First-reply deadlines: urgent 4h, high 24h, normal 72h, low 5 days. Age and deadline, not colour alone."
            actions={<Link href="/complaints" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">Open desk <ArrowRight size={12} aria-hidden="true" /></Link>}
          >
            <TrustStrip pulse={pulseData} />
          </Panel>
        ) : null}
      </section>

      <section aria-labelledby="health-title" className="space-y-3">
        <SectionHeading id="health-title" eyebrow="07 · System health" title="Services, queues and risk" />
        <OperationsAndRisk snapshot={snapshot.data} health={serviceHealth.data} pulse={pulseData} snapshotState={snapshotState} healthState={healthState} />
      </section>

      <section id="decisions" aria-labelledby="decisions-title" className="scroll-mt-24 space-y-3">
        <SectionHeading id="decisions-title" eyebrow="08 · Decisions" title="What needs a decision" description="Ranked by severity from backend signals and live queues. Each item names its evidence; none acts on an account by itself." />
        <PriorityQueue
          insights={insightsData}
          insightsLoading={insightsLoading}
          insightsError={insightsError}
          onRetryInsights={retryPulse}
          snapshot={snapshot.data}
          health={serviceHealth.data}
          snapshotState={snapshotState}
          windowDays={windowDays}
        />
      </section>

      {pulseData ? <TargetsPanel pulse={pulseData} /> : null}

      <KpiGrid state={summaryState} summary={summary.data} />
    </div>
  );
}

export function Overview({ admin }: { admin: AdminIdentity }) {
  return <Suspense fallback={null}><OverviewBody admin={admin} /></Suspense>;
}
