"use client";

import type { AdminResourcePayloads } from "@/lib/api/schemas";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/dashboard/data-table";

type AdminUser = AdminResourcePayloads["users"][number];

export function UsersTable({ users, filter = "all" }: { users: AdminUser[]; filter?: string }) {
  const visibleUsers = filter === "admin" ? users.filter((user) => user.is_admin) : users;
  if (!visibleUsers.length) return <div className="p-5 text-sm text-slate-500">No users matched the backend response.</div>;
  const columns: Column<AdminUser>[] = [
    {
      key: "identity",
      header: "User",
      primary: true,
      render: (user) => (
        <div className="min-w-0">
          <Link href={`/users/${encodeURIComponent(user.id)}`} className="focus-ring cell-primary hover:text-[#ded8ff]">{user.name}</Link>
          <p className="cell-secondary truncate">{user.email ?? user.phone ?? "No contact supplied"}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (user) => <StatusBadge tone={user.is_admin ? "warning" : user.is_flagged ? "danger" : user.is_verified ? "info" : "neutral"}>{user.is_admin ? "Admin" : user.is_flagged ? "Flagged" : user.is_verified ? "Verified" : "Standard"}</StatusBadge>,
    },
    {
      key: "trust",
      header: "Trust",
      align: "right",
      render: (user) => <div className="text-right"><span className="text-[12px] font-semibold tabular-nums text-slate-200">{user.trust_score}</span><span className="block text-[10px] text-slate-500">{user.trust_band}</span></div>,
    },
    {
      key: "deals",
      header: "Completed deals",
      align: "right",
      render: (user) => <span className="tabular-nums text-slate-300">{user.completed_deals.toLocaleString("en-KE")}</span>,
    },
    {
      key: "rating",
      header: "Rating",
      align: "right",
      render: (user) => <span className="tabular-nums text-slate-300">{user.rating ?? "—"}</span>,
    },
    {
      key: "registered",
      header: "Registered",
      render: (user) => <span className="text-[11px] text-slate-400">{user.created_at ? formatDateTime(user.created_at) : "—"}</span>,
    },
  ];
  return <DataTable rows={visibleUsers} columns={columns} label="Users" rowKey={(user) => user.id} />;
}
