"use client";

import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { FinancialIntelligence } from "@/components/dashboard/financial-intelligence";
import { MarketplaceMovement } from "@/components/dashboard/marketplace-movement";
import { OperationsAndRisk } from "@/components/dashboard/operations-risk";
import { PulseHero, PulseTiles, TargetsPanel, TrustStrip, type PulseWindow } from "@/components/intelligence/founder-pulse";
import { InsightFeed } from "@/components/intelligence/insight-feed";
import { Panel } from "@/components/intelligence/visuals";
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
  const pulse = useAdminResource("intelligencePulse", windowQuery);
  const insights = useAdminResource("intelligenceInsights", windowQuery);
  const summary = useAdminResource("summary");
  const health = useAdminResource("health");
  const snapshot = useAdminResource("opsSnapshot");
  const serviceHealth = useAdminResource("serviceHealth");
  const stream = useAlertsStream();

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
  const intelligenceMissing = isEndpointMissing(pulse.error);
  const apiState = health.isLoading ? "checking" : health.isSuccess ? "healthy" : "failed";
  const connectionBadge = {
    checking: { tone: "neutral" as const, label: "Checking backend" },
    healthy: { tone: "success" as const, label: "Backend healthy" },
    failed: { tone: "danger" as const, label: "Backend health failed" },
  }[apiState];
  const liveBadge = stream.status === "connected" ? { tone: "success" as const, label: "Alert stream live" } : stream.status === "connecting" ? { tone: "warning" as const, label: "Stream connecting" } : { tone: "neutral" as const, label: "Stream offline" };

  return (
    <div className="space-y-6">
      <PulseHero
        pulse={pulse.data}
        adminName={admin.displayName}
        range={range}
        onRangeChange={changeRange}
        status={<>
          <StatusBadge tone={connectionBadge.tone}>{connectionBadge.label}</StatusBadge>
          <StatusBadge tone={liveBadge.tone}>{liveBadge.label}</StatusBadge>
        </>}
      />

      {pulse.isLoading ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-busy="true">{Array.from({ length: 10 }, (_, index) => <div key={index} className="skeleton h-[148px]" />)}</div> : null}
      {pulse.isError ? (intelligenceMissing
        ? <UnavailablePanel title="Founder intelligence needs the upgraded BROKA API" detail="GET /admin/intelligence/pulse is not served by the connected backend yet. The verified platform totals below still work; the pulse, North Star indicators and targets appear after the backend deploy." />
        : <UnavailablePanel title="The marketplace pulse could not be loaded" detail={pulse.error.message} action={<button type="button" onClick={() => void pulse.refetch()} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200"><RefreshCw size={12} aria-hidden="true" />Retry</button>} />) : null}
      {pulse.data ? <PulseTiles pulse={pulse.data} /> : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.32fr)_minmax(0,1fr)]">
        <Panel
          id="insights"
          eyebrow="Decision intelligence"
          title="What needs you, and why"
          description="Deterministic rules over the same verified figures. Each card names its evidence and the workspace where you can act; no generative confidence score is implied."
          actions={<Link href="/intelligence" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">Open intelligence <ArrowRight size={12} aria-hidden="true" /></Link>}
        >
          <InsightFeed data={insights.data} isLoading={insights.isLoading} error={insights.error} onRetry={() => void insights.refetch()} limit={6} columns={2} />
        </Panel>
        <div className="space-y-6">
          {pulse.data ? <FinancialIntelligence pulse={pulse.data} /> : (
            <Panel eyebrow="Financial intelligence" title="Platform economics">
              <div className="space-y-2" aria-busy="true"><div className="skeleton h-20" /><div className="skeleton h-20" /></div>
            </Panel>
          )}
          {pulse.data ? (
            <Panel eyebrow="Trust" title="Complaints desk" description="First-reply deadlines: urgent 4h, high 24h, normal 72h, low 5 days." actions={<Link href="/complaints" className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">Open desk <ArrowRight size={12} aria-hidden="true" /></Link>}>
              <TrustStrip pulse={pulse.data} />
            </Panel>
          ) : null}
        </div>
      </div>

      <OperationsAndRisk snapshot={snapshot.data} health={serviceHealth.data} pulse={pulse.data} snapshotState={snapshotState} healthState={healthState} />

      <MarketplaceMovement snapshot={snapshot.data} state={snapshotState} />

      {pulse.data ? <TargetsPanel pulse={pulse.data} /> : null}

      <KpiGrid state={summaryState} summary={summary.data} />
    </div>
  );
}

export function Overview({ admin }: { admin: AdminIdentity }) {
  return <Suspense fallback={null}><OverviewBody admin={admin} /></Suspense>;
}
