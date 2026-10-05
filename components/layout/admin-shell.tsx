"use client";

import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  FileSearch,
  Gauge,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Search,
  ShieldAlert,
  Store,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { AdminIdentity } from "@/types/broka";
import { StatusBadge } from "@/components/ui/primitives";

type NavEntry = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

type NavGroup = { label: string; entries: NavEntry[] };

const navGroups: NavGroup[] = [
  { label: "Overview", entries: [{ label: "Command Center", href: "/", icon: LayoutDashboard }] },
  {
    label: "Marketplace",
    entries: [
      { label: "Listings", href: "/listings", icon: Store },
      { label: "Deals", href: "/deals", icon: ClipboardList },
      { label: "Stores", href: "/stores", icon: Store },
    ],
  },
  {
    label: "Users",
    entries: [
      { label: "All Users", href: "/users", icon: Users },
      { label: "Admins", href: "/users?type=admin", icon: Users },
    ],
  },
  {
    label: "Trust & Safety",
    entries: [
      { label: "Fraud", href: "/fraud", icon: ShieldAlert },
      { label: "Disputes", href: "/disputes", icon: FileSearch },
      { label: "Reports", href: "/reports", icon: CircleHelp },
    ],
  },
  {
    label: "Money",
    entries: [
      { label: "Transactions", href: "/transactions", icon: Landmark },
      { label: "Escrow", href: "/escrow", icon: BadgeDollarSign },
      { label: "Commissions", href: "/commissions", icon: BarChart3 },
    ],
  },
  {
    label: "Zeno",
    entries: [
      { label: "AI Activity", href: "/zeno/activity", icon: Bot },
      { label: "Negotiations", href: "/zeno/negotiations", icon: Bot },
      { label: "AI Savings", href: "/zeno/savings", icon: Bot },
    ],
  },
  {
    label: "Analytics",
    entries: [
      { label: "Platform", href: "/analytics/platform", icon: BarChart3 },
      { label: "Marketplace", href: "/analytics/marketplace", icon: BarChart3 },
      { label: "Users", href: "/analytics/users", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    entries: [
      { label: "Audit Logs", href: "/audit-logs", icon: ClipboardList },
      { label: "Diagnostics", href: "/diagnostics", icon: Gauge },
      { label: "Events", href: "/events", icon: Activity },
      { label: "Workflow Versions", href: "/workflow-versions", icon: Network },
    ],
  },
];

function BrandLockup() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-lg px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
      <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg border border-amber-300/30 bg-amber-300/10">
        <img src="/brand/broka-mark.png" alt="BROKA" className="h-full w-full object-cover" />
      </div>
      <div>
        <p className="font-display text-base font-black leading-none tracking-[-0.06em] text-white">BROKA</p>
        <p className="mt-1 border-t border-amber-300/30 pt-1 text-[9px] font-bold tracking-[0.3em] text-amber-200">ADMIN</p>
      </div>
    </Link>
  );
}

function RailContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="mt-7 flex-1 overflow-y-auto px-3 pb-6" aria-label="Admin navigation">
      {navGroups.map((group) => (
        <section key={group.label} className="mb-6">
          <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">{group.label}</p>
          <div className="space-y-0.5">
            {group.entries.map((entry) => {
              const isActive = entry.href === "/" ? pathname === "/" : pathname === entry.href.split("?")[0];
              const Icon = entry.icon;
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
                    isActive
                      ? "bg-amber-300/[0.11] text-amber-100 shadow-[inset_2px_0_0_0_#f2b965]"
                      : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100",
                  )}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.7} aria-hidden="true" />
                  <span className="truncate">{entry.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <section className="mb-5">
        <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Settings</p>
        <Link href="/settings" onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/[0.045] hover:text-slate-100">
          <Gauge size={16} strokeWidth={1.7} aria-hidden="true" /> Settings
        </Link>
      </section>
    </nav>
  );
}

function UserFooter({ admin }: { admin: AdminIdentity }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="border-t border-white/[0.07] p-3">
      <div className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 text-xs font-black text-slate-950" aria-hidden="true">
          {admin.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-100">{admin.displayName}</p>
          <p className="truncate text-[10px] text-slate-500">{admin.roleLabel}</p>
        </div>
        <button onClick={logout} disabled={busy} className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label="Log out">
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ children, admin, apiConfigured }: { children: React.ReactNode; admin: AdminIdentity; apiConfigured: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-white/[0.07] bg-[#0c0f15] lg:flex">
        <div className="px-4 pt-4"><BrandLockup /></div>
        <RailContent />
        <UserFooter admin={admin} />
      </aside>

      {mobileOpen ? <button className="fixed inset-0 z-40 bg-black/70 lg:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col border-r border-white/[0.08] bg-[#0c0f15] shadow-2xl transition-transform lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between px-4 pt-4"><BrandLockup /><button className="rounded-md p-2 text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
        <RailContent onNavigate={() => setMobileOpen(false)} />
        <UserFooter admin={admin} />
      </aside>

      <div className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-white/[0.07] bg-[#090b10]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button className="rounded-lg border border-white/[0.08] p-2 text-slate-300 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
          <div className="hidden min-w-0 flex-1 lg:block">
            <div className="flex max-w-md items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-slate-500">
              <Search size={15} aria-hidden="true" />
              <span className="text-xs">Search becomes available with a verified admin search contract</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <StatusBadge tone={apiConfigured ? "success" : "warning"}>{apiConfigured ? "API configured" : "API setup required"}</StatusBadge>
            <button className="relative rounded-lg border border-white/[0.07] p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-100" aria-label="Notifications unavailable until backend event delivery is configured"><Bell size={17} aria-hidden="true" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-300" /></button>
            <button className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-left sm:flex" aria-label="Authenticated administrator profile">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-300 text-[10px] font-black text-slate-950">{admin.displayName.slice(0, 1).toUpperCase()}</span>
              <span className="max-w-24 truncate text-xs font-semibold text-slate-200">{admin.displayName}</span>
              <ChevronDown size={14} className="text-slate-500" aria-hidden="true" />
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
