"use client";

import { RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { CategoryDetail, CategoryScatter, CategoryTable, SignalLegend } from "@/components/intelligence/category-matrix";
import { InsightFeed } from "@/components/intelligence/insight-feed";
import { GeographyTable, BusiestSellers, StaleListings, WaitingSellers } from "@/components/intelligence/sellers-board";
import { DataFreshness, DetailDrawer, PageHeader, Panel, Segmented, StatTile } from "@/components/intelligence/visuals";
import { InfoTip } from "@/components/ui/tooltip";
import { ResourceState } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import { formatCount } from "@/lib/intelligence";

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

  const selectedRow = categories.data?.categories.find((row) => row.key === highlight) ?? null;

  function updateUrl(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key); else next.set(key, value);
    }
    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function setRange(value: IntelWindow) {
    updateUrl({ window: value === "30" ? null : value });
  }

  function selectCategory(key: string) {
    updateUrl({ category: key });
  }

  const totals = categories.data?.totals ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Founder intelligence"
        title="Where demand meets supply"
        description="Which categories and counties need sellers, which sellers leave buyers waiting, and which listings no one wants. Staff accounts are excluded from every figure; rules are deterministic."
        meta={<DataFreshness
          state={categories.isLoading ? "loading" : categories.isError ? "error" : categories.data ? "ready" : "unavailable"}
          generatedAt={categories.data?.generated_at}
          windowLabel={`last ${range} days`}
          source="GET /admin/intelligence/categories, /admin/intelligence/geography and /admin/intelligence/sellers. Rule signals use /admin/intelligence/insights."
        />}
        actions={<Segmented label="Analysis window" value={range} options={[...WINDOWS]} onChange={setRange} />}
      />

      {categories.data ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Window totals">
          <StatTile label="Demand signals" value={formatCount(totals.demand)} caption="chats, interests, agent asks" hint={categories.data.definitions.demand ?? "Buyer conversations, interests and Buying Agent requests in the selected window."} />
          <StatTile label="Live listings" value={formatCount(totals.supply_live)} caption="right now" />
          <StatTile label="Buyers waiting" value={formatCount(sellers.data?.waiting_total)} caption={sellers.data ? `on ${formatCount(sellers.data.sellers_with_waiting_buyers)} sellers` : undefined} href="/intelligence#sellers" accent="text-amber-200" />
          <StatTile label="Stale listings" value={formatCount(sellers.data?.stale_total)} caption="14+ days, no buyer" href="/intelligence#stale" accent="text-cyan-200" />
        </section>
      ) : null}

      <Panel
        id="insights"
        eyebrow="Decision intelligence"
        title="Insights"
        description="Deterministic rules over the figures below. The same numbers always give the same advice; the backend returns no model confidence."
        actions={<Segmented label="Insight window" value={insightRange} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} onChange={setInsightRange} />}
      >
        <InsightFeed data={insights.data} isLoading={insights.isLoading} error={insights.error} onRetry={() => void insights.refetch()} columns={3} />
      </Panel>

      <Panel
        id="categories"
        eyebrow="Category intelligence"
        title="Demand against supply"
        description={categories.data?.definitions.demand ?? "Demand counts buyer conversations, interests and Buying Agent requests in the window; supply is what is live now. Select a point or category to inspect it without leaving this page."}
        actions={categories.data ? <SignalLegend counts={categories.data.signals} /> : null}
      >
        {categories.isLoading ? <ResourceState state="loading" message="Reading categories…" /> : categories.isError ? <Failure error={categories.error} onRetry={() => void categories.refetch()} what="Category intelligence" /> : categories.data ? (
          <div className="space-y-5">
            <CategoryScatter rows={categories.data.categories} selected={highlight} onSelect={selectCategory} />
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
              <InfoTip label="Above the diagonal">Points above the diagonal have more buyer demand signals than live listings. Those are the clearest signals to recruit sellers.</InfoTip>
              <span>Above the dashed diagonal: demand exceeds live supply.</span>
              {highlight ? <span className="rounded-full border border-[#8b75ff]/35 bg-[#8b75ff]/10 px-2 py-0.5 font-semibold text-[#ded8ff]">Selected: {highlight}</span> : null}
            </div>
            <CategoryTable data={categories.data} highlight={highlight} onSelect={selectCategory} />
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

      <Panel id="geography" eyebrow="Geography" title="Counties" description="Live supply and buyer conversations by county. A county with chats but few listings is where to recruit next. Reorder by the dimension you are investigating.">
        {geography.isLoading ? <ResourceState state="loading" message="Reading counties…" /> : geography.isError ? <Failure error={geography.error} onRetry={() => void geography.refetch()} what="County intelligence" /> : geography.data ? <GeographyTable data={geography.data} /> : null}
      </Panel>

      <Panel id="stale" eyebrow="Supply quality" title="Stale listings" description="Live for two weeks or more without a buyer message or interest. Ask the seller to re-price, add photos or mark it sold.">
        {sellers.isLoading ? <ResourceState state="loading" message="Loading…" /> : sellers.data ? <StaleListings data={sellers.data} /> : null}
      </Panel>

      <DetailDrawer
        open={Boolean(selectedRow)}
        onClose={() => updateUrl({ category: null })}
        title={selectedRow?.label ?? "Category"}
        subtitle="Demand, supply, liquidity and the backend's deterministic recommendation."
      >
        {selectedRow && categories.data ? <CategoryDetail row={selectedRow} definitions={categories.data.definitions} onClose={() => updateUrl({ category: null })} /> : null}
      </DetailDrawer>
    </div>
  );
}
