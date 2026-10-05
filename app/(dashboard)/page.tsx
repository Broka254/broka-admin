import { Overview } from "@/components/dashboard/overview";
import { requireAdminSession } from "@/lib/auth/session";

export default async function OverviewPage() {
  const admin = await requireAdminSession();
  return <Overview admin={admin} />;
}
