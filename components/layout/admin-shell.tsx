"use client";

import {
  Activity, BadgeDollarSign, BarChart3, Bell, Bot, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  CornerDownLeft, FileSearch, FileText, Gauge, Landmark, LayoutDashboard, LogOut, Megaphone, Menu,
  MessageSquareWarning, Network, Radar, Receipt, Search, ShieldAlert, Store, TrendingUp, Users, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { cn, formatRouteLabel } from "@/lib/utils";
import { useUnreadAlerts } from "@/hooks/use-alerts";
import { useAlertsStream } from "@/hooks/use-alerts-stream";
import { useAdminResource } from "@/hooks/use-admin-resource";
import type { AdminIdentity } from "@/types/broka";
import { StatusBadge } from "@/components/ui/primitives";
import { InfoTip } from "@/components/ui/tooltip";

type NavEntry = { label: string; href: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; badge?: "complaints" };
type NavGroup = { label: string; entries: NavEntry[] };

const navGroups: NavGroup[] = [
  { label: "Founder", entries: [{ label: "Command Center", href: "/", icon: LayoutDashboard }, { label: "Intelligence", href: "/intelligence", icon: Radar }, { label: "Growth", href: "/growth", icon: TrendingUp }, { label: "Reports", href: "/reports", icon: FileText }] },
  { label: "Respond", entries: [{ label: "Complaints", href: "/complaints", icon: MessageSquareWarning, badge: "complaints" }, { label: "Alert Centre", href: "/alerts", icon: Bell }] },
  { label: "Marketplace", entries: [{ label: "Listings", href: "/listings", icon: Store }, { label: "Deals", href: "/deals", icon: ClipboardList }, { label: "Stores", href: "/stores", icon: Store }] },
  { label: "Identity", entries: [{ label: "All Users", href: "/users", icon: Users }, { label: "Admins", href: "/users?type=admin", icon: Users }] },
  { label: "Trust & Safety", entries: [{ label: "Fraud", href: "/fraud", icon: ShieldAlert }, { label: "Disputes", href: "/disputes", icon: FileSearch }] },
  { label: "Money", entries: [{ label: "Revenue", href: "/revenue", icon: BarChart3 }, { label: "Production Costs", href: "/production-costs", icon: Receipt }, { label: "Payments", href: "/payments", icon: Landmark }, { label: "Finance Integrity", href: "/finance-integrity", icon: BadgeDollarSign }, { label: "Transactions", href: "/transactions", icon: Landmark }, { label: "Escrow", href: "/escrow", icon: BadgeDollarSign }, { label: "Commissions", href: "/commissions", icon: BarChart3 }] },
  { label: "Zeno", entries: [{ label: "AI Activity", href: "/zeno/activity", icon: Bot }, { label: "Negotiations", href: "/zeno/negotiations", icon: Bot }, { label: "AI Savings", href: "/zeno/savings", icon: Bot }] },
  { label: "Analytics", entries: [{ label: "Platform", href: "/analytics/platform", icon: BarChart3 }, { label: "Marketplace", href: "/analytics/marketplace", icon: BarChart3 }, { label: "Users", href: "/analytics/users", icon: BarChart3 }] },
  { label: "System", entries: [{ label: "Service Communications", href: "/communications", icon: Megaphone }, { label: "Service Health", href: "/service-health", icon: Gauge }, { label: "Audit Logs", href: "/audit-logs", icon: ClipboardList }, { label: "Diagnostics", href: "/diagnostics", icon: Gauge }, { label: "Events", href: "/events", icon: Activity }, { label: "Workflow Versions", href: "/workflow-versions", icon: Network }, { label: "Settings", href: "/settings", icon: Gauge }] },
];

const allEntries = navGroups.flatMap((group) => group.entries.map((entry) => ({ ...entry, group: group.label })));

type ComplaintBadge = { count: number; urgent: boolean } | null;

function useComplaintBadge(enabled: boolean): ComplaintBadge {
  const stats = useAdminResource("feedbackStats", undefined, enabled);
  if (!stats.data) return null;
  return { count: stats.data.unanswered, urgent: stats.data.sla_breached > 0 };
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="BROKA Admin command center" className={cn("focus-ring flex items-center rounded-xl px-2 py-2", compact ? "justify-center" : "gap-3")}>
      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#8b75ff]/35 bg-[#8b75ff]/10 shadow-[0_0_24px_rgba(139,117,255,0.25)]">
        <img src="/brand/broka-mark.png" alt="" className="h-full w-full object-cover" />
      </div>
      {compact ? null : (
        <div>
          <p className="font-display text-base font-black leading-none tracking-[-0.05em] text-white">BROKA</p>
          <p className="mt-1 border-t border-[#8b75ff]/35 pt-1 text-[9px] font-bold tracking-[0.3em] text-[#a895ff]">ADMIN</p>
        </div>
      )}
    </Link>
  );
}

function entryIsActive(pathname: string, href: string, currentSearch: string) {
  const [path, query] = href.split("?");
  if (pathname !== path) return false;
  if (query) {
    const target = new URLSearchParams(query);
    const current = new URLSearchParams(currentSearch);
    return Array.from(target.entries()).every(([key, value]) => current.get(key) === value);
  }
  return !(path === "/users" && new URLSearchParams(currentSearch).get("type") === "admin");
}

function RailContent({ onNavigate, complaints, collapsed = false }: { onNavigate?: () => void; complaints: ComplaintBadge; collapsed?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <nav className={cn("scroll-thin mt-4 flex-1 overflow-y-auto pb-6", collapsed ? "px-2" : "px-3")} aria-label="Admin navigation">
      {navGroups.map((group) => (
        <section key={group.label} className="mb-5">
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-white/[0.08]" aria-hidden="true" />
          ) : (
            <p className="nav-group-label px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">{group.label}</p>
          )}
          <div className="space-y-0.5">
            {group.entries.map((entry) => {
              const isActive = entryIsActive(pathname, entry.href, searchParams.toString());
              const Icon = entry.icon;
              const badge = entry.badge === "complaints" && complaints && complaints.count > 0 ? complaints : null;
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={collapsed ? entry.label : undefined}
                  title={collapsed ? `${entry.label} · ${group.label}` : undefined}
                  className={cn(
                    "focus-ring group relative flex items-center rounded-lg text-[13px] font-medium transition-colors",
                    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
                    isActive ? "bg-[#8b75ff]/[0.14] text-[#ded8ff]" : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100",
                  )}
                >
                  {isActive ? <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-gradient-to-b from-[#8b75ff] to-[#54d7e9] shadow-[0_0_10px_rgba(139,117,255,0.7)]" aria-hidden="true" /> : null}
                  <Icon size={collapsed ? 18 : 16} strokeWidth={isActive ? 2.2 : 1.7} aria-hidden="true" />
                  {collapsed ? null : <span className="truncate">{entry.label}</span>}
                  {badge ? <span className={cn("rounded-full text-[10px] font-black tabular-nums", collapsed ? "absolute right-1 top-1 h-2 w-2 p-0 text-transparent" : "ml-auto px-1.5 py-0.5", badge.urgent ? "bg-rose-400/90 text-white shadow-[0_0_12px_rgba(251,113,133,0.55)]" : "bg-white/[0.08] text-slate-200")} aria-label={`${badge.count} awaiting a reply${badge.urgent ? ", some past deadline" : ""}`} title={collapsed ? `${badge.count} awaiting a reply` : undefined}>{badge.count > 99 ? "99+" : badge.count}</span> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

function UserFooter({ admin, collapsed = false }: { admin: AdminIdentity; collapsed?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className={cn("border-t border-white/[0.07] p-3", collapsed && "px-2")}>
      <div className={cn("flex items-center rounded-xl bg-white/[0.035] p-2.5", collapsed ? "flex-col gap-2 px-1" : "gap-3")}>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ded8ff] to-[#8b75ff] text-xs font-black text-slate-950" aria-hidden="true">{admin.displayName.slice(0, 1).toUpperCase()}</div>
        {collapsed ? null : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-100">{admin.displayName}</p>
            <p className="truncate text-[10px] text-slate-500">{admin.roleLabel}</p>
          </div>
        )}
        <button onClick={logout} disabled={busy} className="focus-ring rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-rose-300" aria-label="Log out" title={collapsed ? "Log out" : undefined}>
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

type PaletteItem = { key: string; label: string; hint: string; href: string; icon: NavEntry["icon"]; group: string };
type RecentRoute = { href: string; label: string };

// Session-only: the authenticated shell forbids browser storage, so recent
// destinations live in memory and disappear with the tab.
const recentRoutes: RecentRoute[] = [];
function rememberRoute(route: RecentRoute) {
  const existing = recentRoutes.findIndex((entry) => entry.href === route.href);
  if (existing >= 0) recentRoutes.splice(existing, 1);
  recentRoutes.unshift(route);
  if (recentRoutes.length > 5) recentRoutes.length = 5;
}

/** Ctrl/⌘+K: jump to any surface, or search users and complaints. */
function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => previous?.focus();
  }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim();
    const needle = q.toLowerCase();
    const pages = allEntries
      .filter((entry) => !needle || entry.label.toLowerCase().includes(needle) || entry.group.toLowerCase().includes(needle))
      .map((entry) => ({ key: entry.href, label: entry.label, hint: entry.group, href: entry.href, icon: entry.icon, group: entry.group }));
    if (!q) {
      const recents: PaletteItem[] = recentRoutes.map((route) => {
        const match = allEntries.find((entry) => entry.href === route.href);
        return { key: `recent-${route.href}`, label: route.label, hint: route.href, href: route.href, icon: match?.icon ?? LayoutDashboard, group: "Jump back in" };
      });
      const quick: PaletteItem[] = [
        { key: "quick-overdue", label: "Complaints past their deadline", hint: "Trust desk", href: "/complaints?queue=overdue", icon: MessageSquareWarning, group: "Quick actions" },
        { key: "quick-fraud", label: "Open fraud queue", hint: "Trust & Safety", href: "/fraud?state=open", icon: ShieldAlert, group: "Quick actions" },
        { key: "quick-integrity", label: "Finance integrity controls", hint: "Money", href: "/finance-integrity", icon: BadgeDollarSign, group: "Quick actions" },
      ];
      return [...recents, ...quick, ...pages];
    }
    const searches: PaletteItem[] = [
      { key: "search-users", label: `Search users for “${q}”`, hint: "Name, email or phone", href: `/users?search=${encodeURIComponent(q)}`, icon: Users, group: "Search records" },
      { key: "search-complaints", label: `Search complaints for “${q}”`, hint: /^#?[0-9a-f]{6}$/i.test(q) ? "Complaint reference" : "Subject or reference", href: `/complaints?search=${encodeURIComponent(q)}&queue=all`, icon: MessageSquareWarning, group: "Search records" },
    ];
    return [...pages, ...searches];
  }, [query]);

  const groups = useMemo(() => {
    const buckets = new Map<string, PaletteItem[]>();
    for (const item of items) {
      const bucket = buckets.get(item.group);
      if (bucket) bucket.push(item); else buckets.set(item.group, [item]);
    }
    return Array.from(buckets.entries());
  }, [items]);
  const positionOf = useMemo(() => new Map(items.map((item, position) => [item.key, position])), [items]);

  useEffect(() => { setIndex(0); }, [query]);

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); setIndex((current) => (items.length ? (current + 1) % items.length : 0)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setIndex((current) => (items.length ? (current - 1 + items.length) % items.length : 0)); }
    else if (event.key === "Enter") { event.preventDefault(); go(items[index]); }
    else if (event.key === "Tab") event.preventDefault();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 px-4 pt-[10vh] backdrop-blur-sm" onKeyDown={onKeyDown}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close command palette" tabIndex={-1} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="palette-panel relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#8b75ff]/30 bg-[#0a0d18]/95 shadow-[0_30px_120px_rgba(0,0,0,0.6),0_0_60px_rgba(139,117,255,0.18)]">
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          <Search size={16} className="text-[#a895ff]" aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jump to a page, or search users and complaints…" aria-label="Command" aria-controls="palette-results" aria-activedescendant={items[index] ? `palette-${items[index].key}` : undefined} role="combobox" aria-expanded="true" className="h-9 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600" />
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">Esc</kbd>
        </div>
        <ul id="palette-results" role="listbox" aria-label="Results" className="scroll-thin max-h-[54vh] overflow-y-auto p-2">
          {groups.map(([group, entries]) => (
            <li key={group} role="presentation">
              <p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">{group}</p>
              <ul role="group" aria-label={group}>
                {entries.map((item) => {
                  const Icon = item.icon;
                  const position = positionOf.get(item.key) ?? -1;
                  const active = position === index;
                  return (
                    <li key={item.key} id={`palette-${item.key}`} role="option" aria-selected={active}>
                      <button type="button" tabIndex={-1} onMouseEnter={() => setIndex(position)} onClick={() => go(item)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition", active ? "bg-[#8b75ff]/15 text-white" : "text-slate-300")}>
                        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border", active ? "border-[#8b75ff]/40 bg-[#8b75ff]/15 text-[#ded8ff]" : "border-white/[0.07] bg-white/[0.03] text-slate-400")} aria-hidden="true"><Icon size={15} /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.label}</span><span className="block truncate text-[11px] text-slate-500">{item.hint}</span></span>
                        {active ? <CornerDownLeft size={14} className="text-slate-500" aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {!items.length ? <li className="px-3 py-6 text-center text-xs text-slate-500">No page matches. Type a name to search users.</li> : null}
        </ul>
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-4 py-2 text-[10px] text-slate-600">
          <span className="inline-flex items-center gap-1"><kbd className="rounded border border-white/10 px-1">↑</kbd><kbd className="rounded border border-white/10 px-1">↓</kbd> navigate</span>
          <span className="inline-flex items-center gap-1"><kbd className="rounded border border-white/10 px-1">↵</kbd> open</span>
          <span className="inline-flex items-center gap-1"><kbd className="rounded border border-white/10 px-1">Esc</kbd> close</span>
          <span className="ml-auto">Users and complaints only, where the backend supports the search. Nothing is stored.</span>
        </div>
      </div>
    </div>
  );
}

function Breadcrumbs({ pathname, group, title }: { pathname: string; group?: string; title: string }) {
  const segments = pathname.split("/").filter(Boolean);
  const root = segments[0];
  const isDetail = segments.length > 1;
  const rootEntry = root ? allEntries.find((entry) => entry.href.split("?")[0] === `/${root}` && !entry.href.includes("?")) : undefined;
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-500 lg:flex">
      {pathname === "/" ? <><span className="text-slate-400">Founder</span><ChevronRight size={11} aria-hidden="true" /><span className="truncate text-slate-300">Overview</span></> : <>
        <Link href="/" className="focus-ring whitespace-nowrap rounded hover:text-slate-200">Command Center</Link>
        {root ? <><ChevronRight size={11} aria-hidden="true" /><Link href={`/${root}`} className="focus-ring rounded hover:text-slate-200">{rootEntry?.label ?? formatRouteLabel(root)}</Link></> : null}
        {isDetail ? <><ChevronRight size={11} aria-hidden="true" /><span className="truncate text-slate-300">{formatRouteLabel(segments[1])}</span></> : null}
        {group && !root ? <><ChevronRight size={11} aria-hidden="true" /><span className="truncate text-slate-300">{title}</span></> : null}
      </>}
    </nav>
  );
}

export function AdminShell({ children, admin, apiConfigured }: { children: React.ReactNode; admin: AdminIdentity; apiConfigured: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeEntry = allEntries.find((entry) => entryIsActive(pathname, entry.href, searchParams.toString()));
  const knownTitle = activeEntry?.label;
  const pageTitle = pathname === "/" ? "Command Center" : knownTitle ?? pathname.split("/").filter(Boolean).map((part) => part.replaceAll("-", " ")).join(" / ");
  const groupLabel = activeEntry?.group;

  // A configured URL is not evidence of connectivity or contract
  // compatibility. Only a validated /health response may show green.
  const health = useAdminResource("health", undefined, apiConfigured);
  const unread = useUnreadAlerts(apiConfigured);
  const stream = useAlertsStream(apiConfigured);
  const complaints = useComplaintBadge(apiConfigured);
  const unreadCount = unread.data ?? 0;
  const apiState = !apiConfigured ? "not-configured" : health.isLoading ? "checking" : health.isSuccess ? "healthy" : "failed";
  const apiBadge = {
    "not-configured": { tone: "warning" as const, label: "API not configured", detail: "BROKA_API_URL is not set for this deployment." },
    checking: { tone: "neutral" as const, label: "Checking API", detail: "Verifying /health through the server proxy." },
    healthy: { tone: "success" as const, label: "API healthy", detail: "API health verified: the public /health endpoint responded and matched its contract. This does not prove every admin endpoint is deployed." },
    failed: { tone: "danger" as const, label: "API health failed", detail: "API health check failed: the BROKA API health response was unreachable or invalid." },
  }[apiState];
  const streamBadge = {
    connected: { tone: "success" as const, label: "Live", detail: "The persisted alert stream is connected. Alerts arrive without a page refresh." },
    connecting: { tone: "warning" as const, label: "Connecting", detail: "The alert stream is opening. Persisted alerts still load over HTTP." },
    offline: { tone: "neutral" as const, label: "Offline", detail: "The live alert stream is not connected. Alerts still refresh on demand; this is not proof of backend health." },
  }[stream.status === "connected" ? "connected" : stream.status === "connecting" ? "connecting" : "offline"];

  // The rail preference is intentionally in-memory only: the dashboard
  // security contract forbids browser storage in the authenticated shell.
  function toggleCollapsed() {
    setCollapsed((value) => !value);
  }

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Record the destination for the palette's in-memory "Jump back in" group.
  useEffect(() => {
    const query = searchParams.toString();
    rememberRoute({ href: query ? `${pathname}?${query}` : pathname, label: pageTitle });
  }, [pathname, searchParams, pageTitle]);

  return (
    <div className="min-h-screen bg-[#05060d] text-slate-100">
      <a className="skip-link print-hidden" href="#admin-main">Skip to main content</a>
      <aside
        className={cn("print-hidden fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/[0.07] bg-[#080a14]/95 transition-[width] duration-200 lg:flex", collapsed ? "w-[76px]" : "w-[268px]")}
        aria-label="Primary navigation"
      >
        <div className={cn("flex items-center pt-4", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          <BrandLockup compact={collapsed} />
          {collapsed ? null : (
            <button type="button" onClick={toggleCollapsed} className="focus-ring rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Collapse navigation">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {collapsed ? (
          <button type="button" onClick={toggleCollapsed} className="focus-ring mx-auto mt-2 rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Expand navigation">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : null}
        <RailContent complaints={complaints} collapsed={collapsed} />
        {!collapsed ? <UserFooter admin={admin} /> : <UserFooter admin={admin} collapsed />}
      </aside>

      {mobileOpen ? <button className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px] lg:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}
      {/* Off-screen while closed: inert keeps its links out of the tab order and the accessibility tree. */}
      <aside inert={!mobileOpen} aria-hidden={!mobileOpen} className={cn("print-hidden fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col border-r border-white/[0.08] bg-[#080a14] shadow-2xl transition-transform lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")} aria-label="Mobile navigation">
        <div className="flex items-center justify-between px-4 pt-4">
          <BrandLockup />
          <button className="focus-ring rounded-md p-2 text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <RailContent complaints={complaints} onNavigate={() => setMobileOpen(false)} />
        <UserFooter admin={admin} />
      </aside>

      <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[268px]")}>
        <header className="print-hidden sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-white/[0.07] bg-[#05060d]/88 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button className="focus-ring shrink-0 rounded-lg border border-white/[0.08] p-2.5 text-slate-300 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}><Menu size={18} /></button>
          <div className="min-w-0 flex-1">
            <Breadcrumbs pathname={pathname} group={groupLabel} title={pageTitle} />
            <div className="mt-0.5 flex min-w-0 items-center gap-2">
              <p className="truncate font-display text-[13px] font-semibold tracking-[-0.01em] text-slate-200">{pageTitle}</p>
              <span className="hidden shrink-0 items-center gap-1 rounded-full border border-[#8b75ff]/20 bg-[#8b75ff]/[0.07] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#b7a9ff] sm:inline-flex">
                <span className="h-1 w-1 rounded-full bg-[#54d7e9]" aria-hidden="true" />
                {groupLabel ?? "BROKA operations"}
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => setPaletteOpen(true)} className="focus-ring hidden min-w-[230px] items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-left text-xs text-slate-500 transition hover:border-[#8b75ff]/35 hover:text-slate-300 xl:flex" aria-label="Open command palette"><Search size={15} aria-hidden="true" /><span className="flex-1">Search or jump to…</span><kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">Ctrl K</kbd></button>
            <button type="button" onClick={() => setPaletteOpen(true)} className="focus-ring rounded-lg border border-white/[0.07] p-2.5 text-slate-400 xl:hidden" aria-label="Search or jump"><Search size={17} aria-hidden="true" /></button>
            <span className="hidden items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 sm:inline-flex">
              <span className="pl-0.5 pr-1 text-[8px] font-bold uppercase tracking-[0.16em] text-slate-600">System</span>
              <StatusBadge tone={apiBadge.tone}>{apiBadge.label}</StatusBadge>
              <InfoTip label="Backend connectivity">{apiBadge.detail}</InfoTip>
              <span className="mx-0.5 h-3 w-px bg-white/10" aria-hidden="true" />
              <StatusBadge tone={streamBadge.tone}>{streamBadge.label}</StatusBadge>
              <InfoTip label="Live alert stream">{streamBadge.detail}</InfoTip>
            </span>
            {complaints && complaints.count > 0 ? <Link href="/complaints" className={cn("focus-ring relative rounded-lg border p-2.5 transition", complaints.urgent ? "border-rose-400/35 text-rose-200 hover:bg-rose-400/10" : "border-white/[0.07] text-slate-400 hover:bg-white/[0.05] hover:text-slate-100")} aria-label={`Open complaints, ${complaints.count} awaiting a reply`}><MessageSquareWarning size={17} aria-hidden="true" /><span className={cn("absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-black text-white", complaints.urgent ? "bg-rose-500" : "bg-slate-600")} aria-hidden="true">{complaints.count > 99 ? "99+" : complaints.count}</span></Link> : null}
            <Link href="/alerts" className="focus-ring relative rounded-lg border border-white/[0.07] p-2.5 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-100" aria-label={unreadCount > 0 ? `Open alert centre, ${unreadCount} unread alerts` : "Open alert centre, no unread alerts"}><Bell size={17} aria-hidden="true" />{unreadCount > 0 ? <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#8b75ff] px-1 text-[10px] font-black text-white" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Link>
            <div className="ml-0.5 hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-1.5 sm:flex" aria-label={`Signed in as ${admin.displayName}, ${admin.roleLabel}`}>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#ded8ff] to-[#8b75ff] text-[10px] font-black text-slate-950" aria-hidden="true">{admin.displayName.slice(0, 1).toUpperCase()}</span>
              <span className="hidden max-w-24 truncate text-xs font-semibold text-slate-200 md:inline">{admin.displayName}</span>
              <ChevronDown size={13} className="hidden text-slate-600 md:inline" aria-hidden="true" />
            </div>
          </div>
        </header>
        <main id="admin-main" className="mx-auto w-full max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
}
