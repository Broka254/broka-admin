"use client";

import { ArrowUpRight } from "lucide-react";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { CommandCenter } from "@/components/dashboard/command-center";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { PlatformActivity } from "@/components/dashboard/platform-activity";
import { useAdminResource } from "@/hooks/use-admin-resource";
import { formatLocalDate, timeGreeting } from "@/lib/utils";
import type { AdminIdentity } from "@/types/broka";
import { SectionEyebrow, StatusBadge } from "@/components/ui/primitives";

export function Overview({ admin }: { admin: AdminIdentity }) {
  const summary = useAdminResource("summary");
  const summaryState = summary.isLoading ? "loading" : summary.isError ? "error" : "schema-unavailable" as const;
  const snapshot = useAdminResource("opsSnapshot");
  const snapshotState = snapshot.isLoading ? "loading" : snapshot.isError ? "error" : "unavailable" as const;
  const health = useAdminResource("serviceHealth");
  const healthState = health.isLoading ? "loading" : health.isError ? "error" : "unavailable" as const;
  const someData = Boolean(summary.data || snapshot.data);

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-[1.25rem] border border-[#8b75ff]/20 bg-[linear-gradient(120deg,rgba(19,24,43,0.96),rgba(8,10,20,0.92))] px-6 py-7 shadow-[0_25px_80px_rgba(0,0,0,0.18)] sm:px-8">
      <div className="pointer-events-none absolute -right-12 -top-28 h-72 w-72 rounded-full bg-[#8b75ff]/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-[-120px] left-[35%] h-56 w-56 rounded-full bg-[#54d7e9]/[0.06] blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <SectionEyebrow>Internal control center · Kenya</SectionEyebrow>
          <h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white sm:text-4xl">{timeGreeting()}, {admin.displayName}</h1>
          <p className="mt-2 text-sm text-slate-400">Monitor intelligent commerce, trust, money, and platform health <span className="mx-2 text-slate-700">•</span> {formatLocalDate()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={summary.isError && snapshot.isError ? "danger" : someData ? "success" : "warning"}>{summary.isError && snapshot.isError ? "Backend unavailable" : someData ? "Live backend data" : "Loading operations data"}</StatusBadge>
          <a href="/service-health" className="focus-ring inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-[#8b75ff]/40 hover:text-[#ded8ff]">Service health <ArrowUpRight size={14} /></a>
        </div>
      </div>
    </section>
    <KpiGrid state={summaryState} summary={summary.data} />
    <CommandCenter snapshot={snapshot.data} health={health.data} snapshotState={snapshotState} healthState={healthState} />
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.85fr)]">
      <PlatformActivity snapshot={snapshot.data} state={snapshotState} />
      <ActivityFeed state={summaryState} />
    </div>
  </div>;
}
