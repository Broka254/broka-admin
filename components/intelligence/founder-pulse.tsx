"use client";

import { Coins, Gauge, Handshake, Layers, MessageCircle, MessageSquareWarning, PackageOpen, Scale, ShieldAlert, ShoppingBag, Sparkles, Store, Target, TrendingUp, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Chip, Panel, ProgressBar, Ring, Segmented, StatTile } from "@/components/intelligence/visuals";
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
};

const TILES: TileSpec[] = [
  { key: "new_users", label: "New users", icon: Users, good: "up", href: "/users" },
  { key: "new_sellers", label: "New sellers", icon: Store, good: "up", href: "/growth", definition: "new_sellers" },
  { key: "new_listings", label: "New listings", icon: PackageOpen, good: "up", href: "/listings" },
  { key: "live_listings", label: "Live now", icon: Layers, good: "up", href: "/listings?status=active", noChange: true },
  { key: "active_buyers", label: "Active buyers", icon: ShoppingBag, good: "up", href: "/intelligence", definition: "active_buyers" },
  { key: "active_sellers", label: "Active sellers", icon: Store, good: "up", href: "/intelligence#sellers", definition: "active_sellers" },
  { key: "conversations_started", label: "Buyer conversations", icon: MessageCircle, good: "up", href: "/intelligence#sellers" },
  { key: "deals_agreed", label: "Deals agreed", icon: Handshake, good: "up", href: "/deals", definition: "deals_agreed" },
  { key: "buy_agent_requests", label: "Buying Agent asks", icon: Sparkles, good: "up", href: "/intelligence" },
  { key: "complaints_filed", label: "Complaints filed", icon: MessageSquareWarning, good: "down", href: "/complaints" },
  { key: "disputes_opened", label: "Disputes opened", icon: Scale, good: "down", href: "/disputes" },
  { key: "fraud_flags", label: "Fraud flags", icon: ShieldAlert, good: "down", href: "/fraud?state=open" },
  { key: "income_minor", label: "Income", icon: Coins, good: "up", href: "/revenue", unit: "kes_minor" },
  { key: "profit_minor", label: "Profit", icon: TrendingUp, good: "up", href: "/revenue", unit: "kes_minor" },
];

function useClientNow(): Date | null {
  // Rendered on the server in UTC and in the browser in local time; the
  // greeting only appears once mounted so the two never disagree.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);
  return now;
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
  return (
    <section className="hero-cockpit relative overflow-hidden rounded-[1.4rem] border border-[#8b75ff]/25 px-5 py-6 sm:px-8 sm:py-8" aria-labelledby="pulse-hero-title">
      <div className="cockpit-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#8b75ff]/15 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-36 left-[30%] h-72 w-72 rounded-full bg-[#54d7e9]/10 blur-3xl" aria-hidden="true" />
      <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="live-dot" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a895ff]">Founder cockpit · Kenya</p>
            {pulse ? <span className="text-[10px] text-slate-600">updated {relativeTime(pulse.generated_at)}</span> : null}
          </div>
          <h1 id="pulse-hero-title" className="mt-3 font-display text-3xl font-bold tracking-[-0.05em] text-white sm:text-4xl">
            {now ? greetingFor(now) : "Welcome back"}, {adminName}
          </h1>
          <p className="mt-2 text-sm text-slate-400">{now ? formatLocalDate(now) : "\u00a0"}</p>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-slate-200">
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
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Segmented label="Pulse window" value={range} options={PULSE_WINDOWS} onChange={onRangeChange} />
            {status}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="gauge-card">
            <Ring value={liquidity?.current.rate_pct} target={liquidity?.target_pct} label="Liquidity" caption="liquidity" />
            <p className="mt-3 text-xs font-semibold text-slate-200">North star · target {formatPctValue(liquidity?.target_pct ?? 50, 0)}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500" title={pulse?.definitions.liquidity}>
              {liquidity ? `${formatCount(liquidity.current.with_buyer_contact)} of ${formatCount(liquidity.current.eligible)} listings · prev ${formatPctValue(liquidity.previous.rate_pct)}` : "—"}
            </p>
          </div>
          <div className="gauge-card">
            <Ring value={reply?.current.rate_pct} target={reply?.target_pct} label="Seller replies within 24 hours" caption="replied 24h" from="#54d7e9" to="#34d399" />
            <p className="mt-3 text-xs font-semibold text-slate-200">Seller response · target {formatPctValue(reply?.target_pct ?? 50, 0)}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500" title={pulse?.definitions.seller_reply}>
              {reply ? `median ${formatMinutes(reply.current.median_reply_minutes)} · prev ${formatPctValue(reply.previous.rate_pct)}` : "—"}
            </p>
          </div>
          <div className="gauge-card">
            <div className="grid h-[136px] w-[136px] place-items-center rounded-full border border-white/[0.07] bg-[radial-gradient(circle,rgba(219,183,93,0.12),transparent_70%)]">
              <div className="text-center">
                <p className="font-display text-[1.65rem] font-bold leading-none tracking-[-0.04em] text-white tabular-nums">{pulse?.balance.buyers_per_seller ?? "—"}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">buyers / seller</p>
              </div>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-200">Market balance</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">{pulse ? `${formatCount(pulse.balance.active_buyers)} buyers · ${formatCount(pulse.balance.active_sellers)} sellers active` : "—"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PulseTiles({ pulse }: { pulse: Pulse }) {
  const metrics = pulse.metrics;
  return (
    <section aria-label="Marketplace pulse" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {TILES.map((tile) => {
        const metric = metrics[tile.key];
        if (!metric) return null;
        const Icon = tile.icon;
        const caption = tile.key === "buy_agent_requests"
          ? `${formatCount(metrics.buy_agent_unmet_open?.current)} unmatched`
          : tile.noChange
            ? "point in time"
            : metric.previous !== null
              ? `prev ${formatUnitValue(metric.previous, tile.unit ?? "count")}`
              : undefined;
        return (
          <StatTile
            key={tile.key}
            label={tile.label}
            value={formatUnitValue(metric.current, tile.unit ?? "count")}
            change={tile.noChange ? undefined : metric.change_pct}
            good={tile.good}
            caption={caption}
            hint={tile.definition ? pulse.definitions[tile.definition] : undefined}
            icon={<Icon size={14} />}
            href={tile.href}
          />
        );
      })}
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
        <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
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
