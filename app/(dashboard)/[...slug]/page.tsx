import { notFound } from "next/navigation";

import { RecordDetail } from "@/components/dashboard/record-detail";
import { ResourceWorkspace } from "@/components/dashboard/resource-workspace";

const detailPrefixes = ["listings", "users", "disputes"] as const;
type DetailPrefix = (typeof detailPrefixes)[number];
const workspaceRoutes = new Set([
  "listings", "deals", "stores", "users", "fraud", "disputes", "reports", "transactions", "escrow", "commissions",
  "zeno/activity", "zeno/negotiations", "zeno/savings", "analytics/platform", "analytics/marketplace", "analytics/users",
  "audit-logs", "diagnostics", "diagnostics/client-ip", "events", "workflow-versions", "settings",
]);

function isDetailPrefix(value: string): value is DetailPrefix {
  return detailPrefixes.some((prefix) => prefix === value);
}

export default async function AdminResourcePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (slug.length === 2 && isDetailPrefix(slug[0])) return <RecordDetail resource={slug[0]} resourceId={slug[1]} />;
  if (!workspaceRoutes.has(slug.join("/"))) notFound();
  return <ResourceWorkspace slug={slug} />;
}
