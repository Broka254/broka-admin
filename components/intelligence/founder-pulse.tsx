"use client";

import { ArrowUpRight, ChevronDown, ChevronUp, Clock3, Coins, Gauge, Handshake, Layers, MessageCircle, MessageSquareWarning, PackageOpen, Scale, ShieldAlert, ShoppingBag, Sparkles, Store, Target, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Chip, DeltaChip, MetricCard, Panel, ProgressBar, Ring, Segmented, StatTile } from "@/components/intelligence/visuals";
import { InfoTip } from "@/components/ui/tooltip";
import type { Pulse } from "@/lib/api/intelligence-schemas";
import { formatKES } from "@/lib/format";
import { formatCount, formatDuration, formatMinutes, formatPctValue, formatUnitValue, greetingFor, relativeTime, type GoodDirection } from "@/lib/intelligence";
import { formatLocalDate } from "@/lib/utils";

export type PulseWindow = "7" | "30";
export const PULSE_WINDOWS: Array<{ value: PulseWindow; label: string }> = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
];

type TileSpec = {
  key: string;
  label: string;
  icon: typeof Users;
  good: GoodDirection;
  href?: string;
  unit?: "count" | "kes_minor";
  definition?: string;
  noChange?: boolean;
  primary?: boolean;
};

// The complete pulse set the backend returns. Cards outside the opening view
// remain one click away instead of being dropped or crowded into the hero.
const TILES: TileSpec[] = [
  { key: "new_users", label: "New users", icon: Users, good: "up", href: "/users", primary: true },
  { key: "new_sellers", label: "New sellers", icon: Store, good: "up", href: "/growth", definition: "new_sellers", primary: true },
  { key: "new_listings", label: "New listings", icon: PackageOpen, good: "up", href: "/listings", primary: true },
  { key: "live_listings", label: "Live listings", icon: Layers, good: "up", href: "/listings?status=active", noChange: true, primary: true },
  { key: "active_buyers", label: "Active buyers", icon: ShoppingBag, good: "up", href: "/intelligence", definition: "active_buyers", primary: true },
  { key: "active_sellers", label: "Active sellers", icon: Store, good: "up", href: "/intelligence#sellers", definition: "active_sellers", primary: true },
  { key: "conversations_started", label: "Buyer conversations", icon: MessageCircle, good: "up", href: "/intelligence#sellers", primary: true },
  { key: "deals_agreed", label: "Deals agreed", icon: Handshake, good: "up", href: "/deals", definition: "deals_agreed", primary: true },
  { key: "buy_agent_requests", label: "Buying Agent asks", icon: Sparkles, good: "up", href: "/intelligence", primary: true },
  { key: "buy_agent_unmet_open", label: "Unmatched asks", icon: Sparkles, good: "down", href: "/intelligence?category=", primary: true },
  { key: "complaints_filed", label: "Complaints filed", icon: MessageSquareWarning, good: "down", href: "/complaints" },
  { key: "disputes_opened", label: "Disputes opened", icon: Scale, good: "down", href: "/disputes" },
  { key: "fraud_flags", label: "Fraud flags", icon: ShieldAlert, good: "down", href: "/fraud?state=open" },
  { key: "income_minor", label: "Platform income", icon: Coins, good: "up", href: "/revenue", unit: "kes_minor" },
  { key: "profit_minor", label: "Reported profit", icon: TrendingUp, good: "up", href: "/revenue", unit: "kes_minor" },
];

function useClientNow(): Date | null {
  // Rendered on the server in UTC and in the browser in local time; the
  // greeting only appears once mounted so the two never disagree.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function NorthStarPercent({ label, href, rate, target, numerator, denominator, previous, median, definition, accent }: {
  label: string;
  href: string;
  rate: number | null | undefined;
  target: number;
  numerator: number | null | undefined;
  denominator: number | null | undefined;
  previous: number | null | undefined;
  median?: number | null;
  definition?: string;
  accent: "violet" | "cyan";
}) {
  const met = rate !== null && rate !== undefined && rate >= target;
  return (
    <article className="gauge-card relative !items-stretch text-left">
      <div className="pointer-events-none relative z-10">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          {definition ? <span className="pointer-events-auto"><InfoTip label={`How ${label} is calculated`}>{definition}</InfoTip></span> : null}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Ring
            value={rate}
            target={target}
            size={92}
            stroke={8}
            label={label}
            from={accent === "violet" ? "#8b75ff" : "#54d7e9"}
            to={accent === "violet" ? "#54d7e9" : "#34d399"}
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-200">Target {formatPctValue(target, 0)}</p>
            <p className="mt-1 text-[11px] tabular-nums text-slate-400">{formatCount(numerator)} / {formatCount(denominator)}</p>
            <p className="mt-1 text-[10px] text-slate-600">previous {formatPctValue(previous)}</p>
            {median !== undefined ? <p className="mt-1 text-[10px] text-slate-600">median {formatMinutes(median)}</p> : null}
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={rate} max={Math.max(100, target)} target={target} tone={met ? "success" : "warning"} label={`${label} progress toward target`} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Chip tone={met ? "success" : "warning"}>{met ? "Target met" : rate === null || rate === undefined ? "No cohort yet" : "Below target"}</Chip>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">Explore <ArrowUpRight size={11} aria-hidden="true" /></span>
        </div>
      </div>
      <Link href={href} className="focus-ring absolute inset-0 z-0 rounded-[1.1rem]" aria-label={`Open the analysis behind ${label}`} />
    </article>
  );
}

export function PulseHero({ pulse, adminName, range, onRangeChange, status }: {
  pulse?: Pulse; adminName: string; range: PulseWindow; onRangeChange: (value: PulseWindow) => void; status: ReactNode;
}) {
  const now = useClientNow();
  const metrics = pulse?.metrics;
  const liquidity = pulse?.liquidity;
  const reply = pulse?.seller_response;
  const periodWord = range === "7" ? "This week" : "These 30 days";
  const liquidityRate = liquidity?.current.rate_pct ?? null;
  const liquidityTarget = liquidity?.target_pct ?? 50;
  const replyRate = reply?.current.rate_pct ?? null;
  const replyTarget = reply?.target_pct ?? 50;
  return (
    <section className="hero-cockpit relative overflow-hidden rounded-[1.4rem] border border-[#8b75ff]/25 px-5 py-6 sm:px-7 sm:py-7" aria-labelledby="pulse-hero-title">
      <div className="cockpit-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="constellation pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#8b75ff]/15 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-36 left-[30%] h-72 w-72 rounded-full bg-[#54d7e9]/10 blur-3xl" aria-hidden="true" />
      <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,1.18fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="live-dot" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a895ff]">Founder cockpit · Kenya</p>
            {pulse ? <span className="text-[10px] text-slate-500">last data update {relativeTime(pulse.generated_at)}</span> : null}
          </div>
          <h1 id="pulse-hero-title" className="mt-3 font-display text-3xl font-bold tracking-[-0.055em] text-white sm:text-[2.35rem]">
            {now ? greetingFor(now) : "Welcome back"}, {adminName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Clock3 size={12} className="text-[#a895ff]" aria-hidden="true" />{now ? `${formatLocalDate(now)} · ${now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}` : "\u00a0"}</span>
            <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
            <span>{range === "7" ? "7-day pulse window" : "30-day pulse window"}</span>
          </div>
          <p className="mt-4 max-w-2xl text-[14px] leading-7 text-slate-200">
            {metrics ? (
              <>
                {periodWord}: <strong className="text-white">{formatCount(metrics.new_users?.current)}</strong> new users,{" "}
                <strong className="text-white">{formatCount(metrics.new_listings?.current)}</strong> new listings and{" "}
                <strong className="text-white">{formatCount(metrics.conversations_started?.current)}</strong> buyer conversations.{" "}
                {liquidityRate !== null ? (
                  <>
                    <strong className={liquidityRate >= liquidityTarget ? "text-emerald-300" : "text-amber-200"}>{formatPctValue(liquidityRate)}</strong> of new listings heard from a buyer within a week.
                  </>
                ) : (
                  <>No listing has finished its first week in this window yet.</>
                )}
              </>
            ) : (
              <span className="text-slate-500">Reading the marketplace…</span>
            )}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Segmented label="Pulse window" value={range} options={PULSE_WINDOWS} onChange={onRangeChange} />
            {status}
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
            <span>Every figure excludes administrator accounts.</span>
            <Link href="/service-health" className="focus-ring inline-flex items-center gap-1 font-semibold text-amber-200/80 hover:text-amber-100">Service health <ArrowUpRight size={10} aria-hidden="true" /></Link>
            <span className="hidden sm:inline">·</span>
            <span title={pulse?.generated_at}>Generated {pulse ? relativeTime(pulse.generated_at) : "—"}</span>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3" aria-label="Marketplace North Star indicators">
          <NorthStarPercent
            label="Marketplace liquidity"
            href="/intelligence#categories"
            rate={liquidityRate}
            target={liquidityTarget}
            numerator={liquidity?.current.with_buyer_contact}
            denominator={liquidity?.current.eligible}
            previous={liquidity?.previous.rate_pct}
            median={liquidity?.current.median_hours_to_first_contact}
            definition={pulse?.definitions.liquidity ?? "The share of new listings in the cohort that received a human buyer contact within seven days. Target 50%."}
            accent="violet"
          />
          <NorthStarPercent
            label="Seller response · 24h"
            href="/intelligence#sellers"
            rate={replyRate}
            target={replyTarget}
            numerator={reply?.current.replied_24h}
            denominator={reply?.current.eligible}
            previous={reply?.previous.rate_pct}
            median={reply?.current.median_reply_minutes}
            definition={pulse?.definitions.seller_reply ?? "The share of buyer conversations that received a human seller reply within 24 hours. Zeno replies do not count. Target 50%."}
            accent="cyan"
          />
          <article className="gauge-card relative !items-stretch text-left">
            <div className="pointer-events-none relative z-10">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Buyer ↔ seller balance</p>
                <span className="pointer-events-auto"><InfoTip label="How market balance is calculated">{pulse?.definitions.active_buyers ?? "Distinct buyers active in the window, divided by distinct sellers active in the same window. A ratio above 1 means more buyers than sellers."}</InfoTip></span>
              </div>
              <div className="mt-3 grid place-items-center rounded-2xl border border-[#dbb75d]/15 bg-[radial-gradient(circle,rgba(219,183,93,0.12),transparent_70%)] py-3">
                <p className="font-display text-[2.1rem] font-bold leading-none tracking-[-0.04em] text-white tabular-nums">{pulse?.balance.buyers_per_seller ?? "—"}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">buyers per seller</p>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-400">
                {pulse ? <>{formatCount(pulse.balance.active_buyers)} active buyers<br />{formatCount(pulse.balance.active_sellers)} active sellers</> : "—"}
              </p>
              <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-600">Point-in-time demand balance <ArrowUpRight size={10} aria-hidden="true" /></p>
            </div>
            <Link href="/intelligence#geography" className="focus-ring absolute inset-0 z-0 rounded-[1.1rem]" aria-label="Open county market balance analysis" />
          </article>
        </div>
      </div>
    </section>
  );
}

export function PulseTiles({ pulse }: { pulse: Pulse }) {
  const [expanded, setExpanded] = useState(false);
  const metrics = pulse.metrics;
  const available = TILES.filter((tile) => metrics[tile.key] !== undefined);
  const primary = available.filter((tile) => tile.primary);
  const rest = available.filter((tile) => !tile.primary);
  const shown = expanded ? available : primary;
  return (
    <section aria-labelledby="pulse-metrics-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a895ff]">Marketplace intelligence</p>
          <h2 id="pulse-metrics-title" className="mt-1 font-display text-lg font-bold tracking-[-0.03em] text-white">Marketplace KPI intelligence</h2>
          <p className="mt-1 text-xs text-slate-500">Compared with the previous {pulse.window.days}-day window. Live counts are point-in-time.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200/70">{shown.length} of {available.length} metrics</span>
          {rest.length ? (
            <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.025] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-[#8b75ff]/40 hover:text-white">
              {expanded ? <>Fewer metrics <ChevronUp size={13} aria-hidden="true" /></> : <>Show all {available.length} <ChevronDown size={13} aria-hidden="true" /></>}
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {shown.map((tile) => {
          const metric = metrics[tile.key];
          const Icon = tile.icon;
          const unmatched = metrics.buy_agent_unmet_open?.current;
          const caption = metric === undefined
            ? "Not reported by this backend"
            : tile.key === "buy_agent_requests"
              ? `${formatCount(unmatched)} unmatched asks`
              : tile.noChange
                ? "point in time"
                : metric.previous !== null
                  ? `prev ${formatUnitValue(metric.previous, tile.unit ?? "count")}`
                  : "no previous value";
          return (
            <MetricCard
              key={tile.key}
              label={tile.label}
              value={metric ? formatUnitValue(metric.current, tile.unit ?? "count") : "—"}
              change={tile.noChange || metric === undefined ? undefined : metric.change_pct}
              good={tile.good}
              caption={caption}
              hint={tile.definition ? pulse.definitions[tile.definition] : undefined}
              icon={<Icon size={14} />}
              href={tile.href}
              accent={tile.good === "down" ? "text-amber-200" : "text-[#a895ff]"}
            />
          );
        })}
      </div>
    </section>
  );
}

const MONETISATION_LABELS: Record<string, string> = {
  listing_fees_enabled: "Listing fees",
  premium_enabled: "Premium",
  store_billing_enabled: "Store billing",
  in_app_payments_enabled: "In-app payments",
};

export function TargetsPanel({ pulse }: { pulse: Pulse }) {
  const breakEven = pulse.break_even;
  const coverage = breakEven.coverage_pct;
  return (
    <Panel id="targets" eyebrow="Day-30 plan" title="Targets and break-even" description={pulse.definitions.targets}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ul className="space-y-4">
          {pulse.targets.map((target) => (
            <li key={target.key}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex items-center gap-2 text-sm text-slate-200"><Target size={14} className="text-[#a895ff]" aria-hidden="true" />{target.label}</p>
                <p className="text-xs tabular-nums text-slate-400">
                  <span className="font-semibold text-white">{formatUnitValue(target.actual, target.unit)}</span> / {formatUnitValue(target.target, target.unit)}
                  {target.met ? <Chip tone="success" className="ml-2">Met</Chip> : null}
                </p>
              </div>
              <div className="mt-2"><ProgressBar value={target.progress_pct} tone={target.met ? "success" : (target.progress_pct ?? 0) < 40 ? "warning" : "info"} label={`${target.label} progress`} /></div>
            </li>
          ))}
        </ul>
        <div className="inset-panel p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><Gauge size={14} className="text-[#dbb75d]" aria-hidden="true" />Break-even (trailing 30 days)</div>
          <p className="mt-3 font-display text-3xl font-bold tracking-[-0.04em] text-white tabular-nums">{coverage === null ? "—" : formatPctValue(Math.max(-999, coverage), 0)}</p>
          <p className="mt-1 text-xs text-slate-400">of the {formatKES(breakEven.fixed_monthly_cost_minor)} monthly running cost covered</p>
          <div className="mt-3"><ProgressBar value={coverage === null ? 0 : Math.max(0, coverage)} tone={coverage !== null && coverage >= 100 ? "success" : "warning"} label="Break-even coverage" /></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div><dt className="text-slate-500">Income</dt><dd className="mt-0.5 font-semibold text-slate-100 tabular-nums">{formatKES(breakEven.income_30d_minor)}</dd></div>
            <div><dt className="text-slate-500">Recorded costs</dt><dd className="mt-0.5 font-semibold text-slate-100 tabular-nums">{formatKES(breakEven.costs_30d_minor)}</dd></div>
            <div><dt className="text-slate-500">Net</dt><dd className={breakEven.net_30d_minor >= 0 ? "mt-0.5 font-semibold text-emerald-300 tabular-nums" : "mt-0.5 font-semibold text-rose-300 tabular-nums"}>{formatKES(breakEven.net_30d_minor)}</dd></div>
            <div><dt className="text-slate-500">Gap to break-even</dt><dd className="mt-0.5 font-semibold text-amber-200 tabular-nums">{breakEven.gap_minor > 0 ? formatKES(breakEven.gap_minor) : "None"}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Monetisation switches">
            {Object.entries(pulse.monetisation).map(([key, enabled]) => (
              <Chip key={key} tone={enabled ? "success" : "neutral"}>{MONETISATION_LABELS[key] ?? key}: {enabled ? "on" : "off"}</Chip>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** Complaints at a glance, for the overview. */
export function TrustStrip({ pulse }: { pulse: Pulse }) {
  const complaints = pulse.complaints;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label="Open complaints" value={formatCount(complaints.open)} caption={`${formatCount(complaints.unanswered)} without a reply`} icon={<MessageSquareWarning size={14} />} href="/complaints?queue=open" accent="text-amber-200" />
      <StatTile label="Past deadline" value={formatCount(complaints.sla_breached)} caption={complaints.sla_breached_urgent ? `${complaints.sla_breached_urgent} urgent` : "none urgent"} icon={<ShieldAlert size={14} />} href="/complaints?queue=overdue" accent={complaints.sla_breached ? "text-rose-300" : "text-emerald-300"} />
      <StatTile label="Oldest unanswered" value={formatDuration(complaints.oldest_unanswered_hours)} caption="waiting for a first reply" icon={<MessageCircle size={14} />} href="/complaints?queue=unanswered" accent="text-cyan-200" />
      <StatTile label="Median first reply" value={formatDuration(complaints.median_response_hours_90d)} caption="last 90 days" icon={<Gauge size={14} />} href="/complaints" accent="text-[#a895ff]" />
    </div>
  );
}

export { DeltaChip };
