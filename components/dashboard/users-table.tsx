"use client";

import type { AdminResourcePayloads } from "@/lib/api/schemas";
import Link from "next/link";
import { formatLocalDate } from "@/lib/utils";

type AdminUser = AdminResourcePayloads["users"][number];

export function UsersTable({ users, filter = "all" }: { users: AdminUser[]; filter?: string }) {
  const visibleUsers = filter === "admin" ? users.filter((user) => user.is_admin) : users;
  if (!visibleUsers.length) return <div className="p-5 text-sm text-slate-500">No users matched the backend response.</div>;
  return <div className="divide-y divide-white/[0.06]">{visibleUsers.map((user) => <div key={user.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(190px,1.4fr)_120px_120px_120px_minmax(150px,1fr)] sm:items-center"><div><Link href={`/users/${encodeURIComponent(user.id)}`} className="text-sm font-semibold text-slate-100 hover:text-amber-200">{user.name}</Link><p className="mt-1 truncate text-xs text-slate-500">{user.email ?? user.phone ?? "No contact supplied"}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Trust</p><p className="mt-1 text-sm text-slate-300">{user.trust_score} · {user.trust_band}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Deals</p><p className="mt-1 text-sm text-slate-300">{user.completed_deals.toLocaleString()}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Status</p><p className="mt-1 text-sm text-slate-300">{user.is_flagged ? "Flagged" : user.is_admin ? "Admin" : user.is_verified ? "Verified" : "Standard"}</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Registered</p><p className="mt-1 text-sm text-slate-400">{user.created_at ? formatLocalDate(new Date(user.created_at)) : "—"}</p></div></div>)}</div>;
}
