import { notFound } from "next/navigation";

import { RecordDetail } from "@/components/dashboard/record-detail";
import { ResourceWorkspace } from "@/components/dashboard/resource-workspace";
import { isDetailPrefix, isKnownWorkspaceRoute } from "@/lib/workspaces";

export default async function AdminResourcePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (slug.length === 2 && isDetailPrefix(slug[0])) return <RecordDetail resource={slug[0]} resourceId={slug[1]} />;
  if (!isKnownWorkspaceRoute(slug)) notFound();
  return <ResourceWorkspace slug={slug} />;
}
