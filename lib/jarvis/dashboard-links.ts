import { isDetailPrefix, WORKSPACE_ROUTES } from "@/lib/workspaces";

// Zeno names dashboard pages in its recommendations. A link is rendered only
// when the path is a page this dashboard actually serves, so a reference to
// a page that does not exist (or to something outside the dashboard) is shown
// as plain text instead of a dead link.

/** Pages with their own route file under app/(dashboard). Others go through WORKSPACE_ROUTES. */
const PAGE_ROUTES = new Set([
  "/",
  "/alerts",
  "/assistant",
  "/communications",
  "/complaints",
  "/email-reply",
  "/growth",
  "/intelligence",
  "/market",
  "/operations",
  "/production-costs",
  "/reports",
  "/reports/builder",
  "/revenue",
]);

const QUERY_PATTERN = /^[a-z_]+=[A-Za-z0-9_-]+(?:&[a-z_]+=[A-Za-z0-9_-]+)*$/;
const RECORD_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export type DashboardLink = { href: string; label: string };

function labelFor(path: string): string {
  if (path === "/") return "Command Center";
  const words = path.split("/").filter(Boolean).join(" ").replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A safe internal link for a dashboard path, or null when the path is not a page of this dashboard. */
export function dashboardLink(value: string | null | undefined): DashboardLink | null {
  if (typeof value !== "string" || value.length > 240) return null;
  const parts = value.split("?");
  if (parts.length > 2) return null;
  const [rawPath, query] = parts;
  if (query !== undefined && !QUERY_PATTERN.test(query)) return null;
  if (!rawPath.startsWith("/") || rawPath.startsWith("//") || rawPath.includes("\\") || rawPath.includes("..")) {
    return null;
  }
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  const segments = path.split("/").slice(1);
  const isRecord = segments.length === 2 && isDetailPrefix(segments[0]) && RECORD_ID_PATTERN.test(segments[1]);
  const known = PAGE_ROUTES.has(path) || WORKSPACE_ROUTES.has(segments.join("/")) || isRecord;
  if (!known) return null;
  return {
    href: query ? `${path}?${query}` : path,
    label: isRecord ? "Open record" : labelFor(path),
  };
}
