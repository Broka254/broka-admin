import { AdminShell } from "@/components/layout/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import { isApiConfigured } from "@/lib/api/client";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminSession();
  return <AdminShell admin={admin} apiConfigured={isApiConfigured()}>{children}</AdminShell>;
}
