"use client";

import { Activity, BadgeDollarSign, BarChart3, Bell, Bot, ChevronDown, CircleHelp, ClipboardList, FileSearch, Gauge, Landmark, LayoutDashboard, LogOut, Megaphone, Menu, Network, Search, ShieldAlert, Store, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { cn } from "@/lib/utils";
import { useUnreadAlerts } from "@/hooks/use-alerts";
import { useAlertsStream } from "@/hooks/use-alerts-stream";
import { useAdminResource } from "@/hooks/use-admin-resource";
import type { AdminIdentity } from "@/types/broka";
import { StatusBadge } from "@/components/ui/primitives";

type NavEntry = { label: string; href: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> };
type NavGroup = { label: string; entries: NavEntry[] };

const navGroups: NavGroup[] = [
  { label: "Overview", entries: [{ label: "Command Center", href: "/", icon: LayoutDashboard }, { label: "Alert Centre", href: "/alerts", icon: Bell }] },
  { label: "Marketplace", entries: [{ label: "Listings", href: "/listings", icon: Store }, { label: "Deals", href: "/deals", icon: ClipboardList }, { label: "Stores", href: "/stores", icon: Store }] },
  { label: "Users", entries: [{ label: "All Users", href: "/users", icon: Users }, { label: "Admins", href: "/users?type=admin", icon: Users }] },
  { label: "Trust & Safety", entries: [{ label: "Fraud", href: "/fraud", icon: ShieldAlert }, { label: "Disputes", href: "/disputes", icon: FileSearch }, { label: "Reports", href: "/reports", icon: CircleHelp }] },
  { label: "Money", entries: [{ label: "Revenue", href: "/revenue", icon: BarChart3 }, { label: "Payments", href: "/payments", icon: Landmark }, { label: "Finance Integrity", href: "/finance-integrity", icon: BadgeDollarSign }, { label: "Transactions", href: "/transactions", icon: Landmark }, { label: "Escrow", href: "/escrow", icon: BadgeDollarSign }, { label: "Commissions", href: "/commissions", icon: BarChart3 }] },
  { label: "Zeno", entries: [{ label: "AI Activity", href: "/zeno/activity", icon: Bot }, { label: "Negotiations", href: "/zeno/negotiations", icon: Bot }, { label: "AI Savings", href: "/zeno/savings", icon: Bot }] },
  { label: "Analytics", entries: [{ label: "Platform", href: "/analytics/platform", icon: BarChart3 }, { label: "Marketplace", href: "/analytics/marketplace", icon: BarChart3 }, { label: "Users", href: "/analytics/users", icon: BarChart3 }] },
  { label: "System", entries: [{ label: "Service Communications", href: "/communications", icon: Megaphone }, { label: "Service Health", href: "/service-health", icon: Gauge }, { label: "Audit Logs", href: "/audit-logs", icon: ClipboardList }, { label: "Diagnostics", href: "/diagnostics", icon: Gauge }, { label: "Events", href: "/events", icon: Activity }, { label: "Workflow Versions", href: "/workflow-versions", icon: Network }] },
];

function HeaderSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = value.trim();
    router.push(q ? `/users?search=${encodeURIComponent(q)}` : "/users");
  }
  return <form onSubmit={onSubmit} role="search" aria-label="Search users" className="hidden min-w-[200px] items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-slate-400 xl:flex"><Search size={15} aria-hidden="true" /><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search users" aria-label="Search users" className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600" /></form>;
}

function BrandLockup() {
  return <Link href="/" className="focus-ring flex items-center gap-3 rounded-lg px-2 py-2"><div className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-[#8b75ff]/35 bg-[#8b75ff]/10"><img src="/brand/broka-mark.png" alt="BROKA" className="h-full w-full object-cover" /></div><div><p className="font-display text-base font-black leading-none tracking-[-0.06em] text-white">BROKA</p><p className="mt-1 border-t border-[#8b75ff]/35 pt-1 text-[9px] font-bold tracking-[0.3em] text-[#a895ff]">ADMIN</p></div></Link>;
}

function entryIsActive(pathname: string, href: string, currentSearch: string) {
  const [path, query] = href.split("?");
  if (pathname !== path) return false;
  if (query) {
    const target = new URLSearchParams(query);
    const current = new URLSearchParams(currentSearch);
    return Array.from(target.entries()).every(([key, value]) => current.get(key) === value);
  }
  // "All Users" and the filtered "Admins" entry share a pathname.
  return !(path === "/users" && new URLSearchParams(currentSearch).get("type") === "admin");
}

function RailContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <nav className="mt-7 flex-1 overflow-y-auto px-3 pb-6" aria-label="Admin navigation">{navGroups.map((group) => <section key={group.label} className="mb-6"><p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">{group.label}</p><div className="space-y-0.5">{group.entries.map((entry) => { const isActive = entryIsActive(pathname, entry.href, searchParams.toString()); const Icon = entry.icon; return <Link key={entry.href} href={entry.href} onClick={onNavigate} aria-current={isActive ? "page" : undefined} className={cn("focus-ring group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors", isActive ? "bg-[#8b75ff]/[0.14] text-[#ded8ff] shadow-[inset_2px_0_0_0_#8b75ff]" : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100")}><Icon size={16} strokeWidth={isActive ? 2.2 : 1.7} aria-hidden="true" /><span className="truncate">{entry.label}</span></Link>; })}</div></section>)}<section className="mb-5"><p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Settings</p><Link href="/settings" onClick={onNavigate} className="focus-ring flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/[0.045] hover:text-slate-100"><Gauge size={16} strokeWidth={1.7} aria-hidden="true" /> Settings</Link></section></nav>;
}

function UserFooter({ admin }: { admin: AdminIdentity }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() { setBusy(true); await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined); router.replace("/login"); router.refresh(); }
  return <div className="border-t border-white/[0.07] p-3"><div className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-2.5"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ded8ff] to-[#8b75ff] text-xs font-black text-slate-950" aria-hidden="true">{admin.displayName.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-100">{admin.displayName}</p><p className="truncate text-[10px] text-slate-500">{admin.roleLabel}</p></div><button onClick={logout} disabled={busy} className="focus-ring rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-rose-300" aria-label="Log out"><LogOut size={15} aria-hidden="true" /></button></div></div>;
}

export function AdminShell({ children, admin, apiConfigured }: { children: React.ReactNode; admin: AdminIdentity; apiConfigured: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const pageTitle = pathname === "/" ? "Command Center" : pathname.split("/").filter(Boolean).map((part) => part.replaceAll("-", " ")).join(" / ");
  // A configured URL is not evidence of connectivity or contract
  // compatibility. Only a validated /health response may show green.
  const health = useAdminResource("health", undefined, apiConfigured);
  const unread = useUnreadAlerts(apiConfigured);
  const stream = useAlertsStream();
  const unreadCount = unread.data ?? 0;
  const apiState = !apiConfigured ? "not-configured" : health.isLoading ? "checking" : health.isSuccess ? "healthy" : "failed";
  const apiBadge = {
    "not-configured": { tone: "warning" as const, label: "API not configured", detail: "BROKA_API_URL is not set for this deployment." },
    checking: { tone: "neutral" as const, label: "Checking API health", detail: "Verifying /health through the server proxy." },
    healthy: { tone: "success" as const, label: "API health verified", detail: "The public /health endpoint responded and matched its contract. This does not prove every admin endpoint is deployed." },
    failed: { tone: "danger" as const, label: "API health check failed", detail: "The BROKA API health response was unreachable or invalid." },
  }[apiState];
  return <div className="min-h-screen bg-[#05060d] text-slate-100"><aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-white/[0.07] bg-[#080a14]/95 lg:flex"><div className="px-4 pt-4"><BrandLockup /></div><RailContent /><UserFooter admin={admin} /></aside>{mobileOpen ? <button className="fixed inset-0 z-40 bg-black/70 lg:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}<aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col border-r border-white/[0.08] bg-[#080a14] shadow-2xl transition-transform lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}><div className="flex items-center justify-between px-4 pt-4"><BrandLockup /><button className="focus-ring rounded-md p-2 text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button></div><RailContent onNavigate={() => setMobileOpen(false)} /><UserFooter admin={admin} /></aside><div className="min-h-screen lg:pl-[252px]"><header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-white/[0.07] bg-[#05060d]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8"><button className="focus-ring rounded-lg border border-white/[0.08] p-2 text-slate-300 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={18} /></button><div className="hidden min-w-0 flex-1 lg:block"><p className="font-display text-sm font-semibold capitalize text-slate-200">{pageTitle}</p><p className="mt-0.5 text-[11px] text-slate-600">Broka operations control center</p></div><div className="ml-auto flex items-center gap-2 sm:gap-3"><HeaderSearch /><span title={apiBadge.detail}><StatusBadge tone={apiBadge.tone}>{apiBadge.label}</StatusBadge></span><StatusBadge tone={stream.status === "connected" ? "success" : stream.status === "connecting" ? "warning" : "neutral"}>{stream.status === "connected" ? "Live" : stream.status === "connecting" ? "Connecting" : "Offline"}</StatusBadge><Link href="/alerts" className="focus-ring relative rounded-lg border border-white/[0.07] p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-100" aria-label={unreadCount > 0 ? `Open alert centre, ${unreadCount} unread alerts` : "Open alert centre, no unread alerts"}><Bell size={17} aria-hidden="true" />{unreadCount > 0 ? <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#8b75ff] px-1 text-[10px] font-black text-white" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Link><button className="focus-ring hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-left sm:flex" aria-label="Authenticated administrator profile"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#8b75ff] text-[10px] font-black text-white">{admin.displayName.slice(0, 1).toUpperCase()}</span><span className="max-w-24 truncate text-xs font-semibold text-slate-200">{admin.displayName}</span><ChevronDown size={14} className="text-slate-500" aria-hidden="true" /></button></div></header><main className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main></div></div>;
}
