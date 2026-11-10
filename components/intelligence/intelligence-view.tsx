"use client";

import { RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { CategoryScatter, CategoryTable, SignalLegend } from "@/components/intelligence/category-matrix";
import { InsightFeed } from "@/components/intelligence/insight-feed";
import { BusiestSellers, GeographyTable, StaleListings, WaitingSellers } from "@/components/intelligence/sellers-board";
import { Panel, Segmented, StatTile } from "@/components/intelligence/visuals";
import { ResourceState, SectionEyebrow, StatusBadge } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import { formatCount, relativeTime } from "@/lib/intelligence";

const WINDOWS = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
] as const;
type IntelWindow = (typeof WINDOWS)[number]["value"];

function asWindow(value: string | null): IntelWindow {
  return value === "90" || value === "180" ? value : "30";
}

function Failure({ error, onRetry, what }: { error: unknown; onRetry: () => void; what: string }) {
  if (isEndpointMissing(error)) return <ResourceState state="unavailable" message={`${what} needs the upgraded BROKA API. It appears automatically after the backend deploy.`} />;
  return <ResourceState state="error" message={error instanceof Error ? error.message : `${what} could not be loaded.`} action={<button type="button" onClick={onRetry} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200"><RefreshCw size={12} aria-hidden="true" />Retry</button>} />;
}

export function IntelligenceView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = asWindow(searchParams.get("window"));
  const highlight = searchParams.get("category");
  const [insightRange, setInsightRange] = useState<"7" | "30">("7");

  const windowQuery = useMemo(() => new URLSearchParams({ window_days: range }), [range]);
  const insightQuery = useMemo(() => new URLSearchParams({ window_days: insightRange }), [insightRange]);
  const sellersQuery = useMemo(() => new URLSearchParams({ limit: "20" }), []);
  const insights = useAdminResource("intelligenceInsights", insightQuery);
  const categories = useAdminResource("intelligenceCategories", windowQuery);
  const geography = useAdminResource("intelligenceGeography", windowQuery);
  const sellers = useAdminResource("intelligenceSellers", sellersQuery);

  function setRange(value: IntelWindow) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "30") next.delete("window"); else next.set("window", value);
    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  const totals = categories.data?.totals ?? {};

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <SectionEyebrow>Founder intelligence</SectionEyebrow>
          <h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Where demand meets supply</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Which categories and counties need sellers, which sellers are leaving buyers waiting, and which listings no one wants. Staff accounts are excluded from every figure.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Analysis window" value={range} options={[...WINDOWS]} onChange={setRange} />
          {categories.data ? <StatusBadge tone="success">Computed {relativeTime(categories.data.generated_at)}</StatusBadge> : null}
        </div>
      </section>

      {categories.data ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Window totals">
          <StatTile label="Demand signals" value={formatCount(totals.demand)} caption="chats, interests, agent asks" />
          <StatTile label="Live listings" value={formatCount(totals.supply_live)} caption="right now" />
          <StatTile label="Buyers waiting" value={formatCount(sellers.data?.waiting_total)} caption={sellers.data ? `on ${formatCount(sellers.data.sellers_with_waiting_buyers)} sellers` : undefined} href="/intelligence#sellers" accent="text-amber-200" />
          <StatTile label="Stale listings" value={formatCount(sellers.data?.stale_total)} caption="14+ days, no buyer" href="/intelligence#stale" accent="text-cyan-200" />
        </section>
      ) : null}

      <Panel
        id="insights"
        eyebrow="Decision feed"
        title="Insights"
        description="Deterministic rules over the figures below. The same numbers always give the same advice."
        actions={<Segmented label="Insight window" value={insightRange} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} onChange={setInsightRange} />}
      >
        <InsightFeed data={insights.data} isLoading={insights.isLoading} error={insights.error} onRetry={() => void insights.refetch()} columns={3} />
      </Panel>

      <Panel id="categories" eyebrow="Categories" title="Demand against supply" description={categories.data?.definitions.demand ?? "Demand counts buyer conversations, interests and Buying Agent requests in the window; supply is what is live now."} actions={categories.data ? <SignalLegend counts={categories.data.signals} /> : null}>
        {categories.isLoading ? <ResourceState state="loading" message="Reading categories…" /> : categories.isError ? <Failure error={categories.error} onRetry={() => void categories.refetch()} what="Category intelligence" /> : categories.data ? (
          <div className="space-y-5">
            <CategoryScatter rows={categories.data.categories} />
            <CategoryTable data={categories.data} highlight={highlight} />
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel id="sellers" eyebrow="Responsiveness" title="Buyers waiting on sellers" description="Buyers whose first message has had no human seller reply for over 24 hours. Zeno answering does not count. Call these sellers first.">
          {sellers.isLoading ? <ResourceState state="loading" message="Finding waiting buyers…" /> : sellers.isError ? <Failure error={sellers.error} onRetry={() => void sellers.refetch()} what="Seller responsiveness" /> : sellers.data ? <WaitingSellers data={sellers.data} /> : null}
        </Panel>
        <Panel eyebrow="Responsiveness" title="Busiest sellers" description="Most buyer conversations in the lookback window, with the share they answered themselves.">
          {sellers.data ? <BusiestSellers data={sellers.data} /> : sellers.isLoading ? <ResourceState state="loading" message="Loading…" /> : null}
        </Panel>
      </div>

      <Panel id="geography" eyebrow="Geography" title="Counties" description="Live supply and buyer conversations by county. A county with chats but few listings is where to recruit next.">
        {geography.isLoading ? <ResourceState state="loading" message="Reading counties…" /> : geography.isError ? <Failure error={geography.error} onRetry={() => void geography.refetch()} what="County intelligence" /> : geography.data ? <GeographyTable data={geography.data} /> : null}
      </Panel>

      <Panel id="stale" eyebrow="Supply quality" title="Stale listings" description="Live for two weeks or more without a buyer message or interest. Ask the seller to re-price, add photos or mark it sold.">
        {sellers.isLoading ? <ResourceState state="loading" message="Loading…" /> : sellers.data ? <StaleListings data={sellers.data} /> : null}
      </Panel>
    </div>
  );
}
