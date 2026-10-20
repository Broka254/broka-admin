"use client";

import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AdminRequestError, useAdminResource, useAdminUsers } from "@/hooks/use-admin-resource";
import type { ApiResource } from "@/types/broka";
import { ResourceState, SectionEyebrow, StatusBadge, UnavailablePanel } from "@/components/ui/primitives";
import { UsersTable } from "@/components/dashboard/users-table";
import { ValidatedResourceView } from "@/components/dashboard/validated-resource-view";

type StaticAdminResource = Exclude<ApiResource, "userDetail" | "dealDetail">;
type WsFilter =
  | { kind: "search"; param: string; placeholder: string }
  | { kind: "select"; param: string; label: string; options: Array<{ value: string; label: string }> };
type WorkspaceDefinition = {
  title: string; eyebrow: string; description: string; missing: string;
  resource?: StaticAdminResource; endpoint?: string;
  filters?: WsFilter[]; pageSize?: number; defaults?: Record<string, string>;
};

const ALL = { value: "all", label: "All" };
const DEAL_STATUSES = ["negotiating", "agreed", "paid", "released", "refunded", "disputed", "cancelled", "awaiting_condition_check", "awaiting_resolution", "awaiting_replacement", "goods_not_arrived"];
const LISTING_STATUSES = ["active", "pending", "completed", "cancelled"];
const DISPUTE_STATES = ["open", "waiting_seller_explanation", "waiting_buyer_decision", "waiting_replacement", "waiting_return", "ai_review", "ready_for_refund", "ready_for_release", "escalated", "closed_refunded", "closed_released"];
const MPESA_STATUSES = ["pending", "success", "failed"];
const ZETUPAY_STATUSES = ["initiated", "processing", "success", "failed"];

const options = (values: string[]) => [ALL, ...values.map((status) => ({ value: status, label: status.replaceAll("_", " ") }))];

function isEmptyList(data: unknown): boolean {
  if (Array.isArray(data)) return data.length === 0;
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items.length === 0;
  }
  return false;
}

const workspaces: Record<string, WorkspaceDefinition> = {
  listings: {
    title: "Listings", eyebrow: "Marketplace operations", endpoint: "/admin/listings", resource: "listings",
    description: "Read-only moderation overview of every listing. Counts and rows come straight from the listing table; no moderation mutation is exposed by the backend.",
    missing: "Admin listing enumeration is unavailable.",
    filters: [{ kind: "search", param: "search", placeholder: "Filter by listing name" }, { kind: "select", param: "status", label: "Status", options: options(LISTING_STATUSES) }],
  },
  deals: {
    title: "Deals", eyebrow: "Marketplace operations", endpoint: "/admin/deals", resource: "deals",
    description: "Deal lifecycle visibility with escrow-relevant timestamps. Money movement remains with the escrow engine; this queue is read-only.",
    missing: "Admin deal queue is unavailable.",
    filters: [{ kind: "select", param: "status", label: "Status", options: options(DEAL_STATUSES) }, { kind: "search", param: "seller_id", placeholder: "Filter by seller id" }, { kind: "search", param: "buyer_id", placeholder: "Filter by buyer id" }],
  },
  stores: {
    title: "Stores", eyebrow: "Marketplace operations", endpoint: "/admin/stores", resource: "stores",
    description: "Store directory backed by the store table. Soft-deleted stores are excluded unless explicitly requested.",
    missing: "Admin store enumeration is unavailable.",
    filters: [{ kind: "search", param: "search", placeholder: "Filter by store name or slug" }, { kind: "select", param: "include_deleted", label: "Deleted", options: [ALL, { value: "true", label: "Include deleted" }] }],
  },
  users: {
    title: "All Users", eyebrow: "Identity & access", endpoint: "/admin/users", resource: "users",
    description: "User review with server-side search, account type and admin filters. The filtered total comes from X-Total-Count.",
    missing: "Admin user list is unavailable.",
    filters: [{ kind: "search", param: "search", placeholder: "Search name, email or phone" }, { kind: "select", param: "type", label: "Filter", options: [{ value: "all", label: "All" }, { value: "buyer", label: "Buyers only" }, { value: "buyer_seller", label: "Sellers" }, { value: "admin", label: "Admins" }, { value: "flagged", label: "Flagged" }] }],
  },
  fraud: {
    title: "Fraud events", eyebrow: "Trust & Safety", endpoint: "/admin/fraud-events", resource: "fraudEvents",
    description: "Engine-recorded flag events. Resolving an event records the reviewer and an audit row; it does not silently edit trust.",
    missing: "Fraud events endpoint is unavailable.",
    filters: [{ kind: "select", param: "state", label: "State", options: [{ value: "all", label: "All" }, { value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }] }, { kind: "search", param: "user_id", placeholder: "Filter by user id" }],
  },
  disputes: {
    title: "Disputes", eyebrow: "Trust & Safety", endpoint: "/admin/disputes", resource: "disputes",
    description: "Dispute-engine cases with rule/AI decision context and deal amounts. Resolution stays with the existing engine and its fund guards.",
    missing: "Admin dispute queue is unavailable.",
    filters: [{ kind: "select", param: "state", label: "State", options: options(DISPUTE_STATES) }],
  },
  transactions: {
    title: "Transactions", eyebrow: "Financial operations", endpoint: "/admin/transactions", resource: "transactions",
    description: "Legacy M-Pesa (Daraja) transactions. Payments is the cross-provider operational view.",
    missing: "Transactions endpoint is unavailable.",
    filters: [{ kind: "select", param: "status", label: "Status", options: options(MPESA_STATUSES) }],
  },
  payments: {
    title: "Payments", eyebrow: "Financial operations", endpoint: "/admin/payments", resource: "payments",
    description: "Normalized cross-provider payment queue. Counts always reflect the whole table, not just the returned page.",
    missing: "Payments endpoint is unavailable.",
    filters: [{ kind: "select", param: "source", label: "Provider", options: [{ value: "all", label: "All providers" }, { value: "mpesa", label: "M-Pesa" }, { value: "zetupay", label: "ZetuPay" }] }, { kind: "select", param: "status", label: "Status", options: [] }],
  },
  "finance-integrity": {
    title: "Finance Integrity", eyebrow: "Financial operations", endpoint: "/admin/finance-integrity", resource: "financeIntegrity",
    description: "Reconciliation checks: released deals must have a ledger escrow debit and a revenue credit; refunds recorded must be distinguishable from refunds returned.",
    missing: "Finance integrity endpoint is unavailable.",
  },
  "service-health": {
    title: "Service Health", eyebrow: "System administration", endpoint: "/admin/health/services", resource: "serviceHealth",
    description: "Live DB/Redis probes with latency, plus provider configuration checks that never claim a live provider state.",
    missing: "Service health endpoint is unavailable.",
  },
  "zeno/activity": {
    title: "Zeno AI Activity", eyebrow: "BROKA intelligence", endpoint: "/admin/zeno/activity", resource: "zenoActivity",
    description: "Durable Zeno signals from negotiation_messages and audit_logs. Provider/model usage, latency and token costs are declared not instrumented rather than fabricated.",
    missing: "Zeno activity endpoint is unavailable.",
    defaults: { window_hours: "168" },
    filters: [{ kind: "select", param: "window_hours", label: "Window", options: [{ value: "24", label: "24 hours" }, { value: "168", label: "7 days" }, { value: "720", label: "30 days" }] }],
  },
  "zeno/savings": {
    title: "Zeno AI Savings", eyebrow: "BROKA intelligence", endpoint: "/admin/ai-savings", resource: "aiSavings",
    description: "Process-local classification counters: how many relay classifications the prefilter and cache avoided. Not billing data.",
    missing: "AI savings endpoint is unavailable.",
  },
  "audit-logs": {
    title: "Audit Logs", eyebrow: "System administration", endpoint: "/admin/audit-logs", resource: "auditLogs",
    description: "Immutable, read-only audit trail, including every administrative mutation performed through this dashboard.",
    missing: "Audit logs endpoint is unavailable.",
    filters: [{ kind: "search", param: "action", placeholder: "Filter by action" }, { kind: "search", param: "actor_id", placeholder: "Filter by actor id" }, { kind: "search", param: "resource_type", placeholder: "Filter by resource type" }],
  },
  diagnostics: { title: "Diagnostics", eyebrow: "System administration", description: "Live E-Confirm fee-quote probe; no credentials are exposed.", endpoint: "/admin/diagnostics/econfirm", resource: "econfirmDiagnostics", missing: "E-Confirm diagnostics endpoint is unavailable." },
  "diagnostics/client-ip": { title: "Client IP Diagnostics", eyebrow: "System administration", description: "Deployment proxy resolution diagnostics from the authenticated admin endpoint.", endpoint: "/admin/diagnostics/client-ip", resource: "clientIpDiagnostics", missing: "Client IP diagnostics endpoint is unavailable." },
  events: { title: "Events", eyebrow: "System administration", description: "The static event catalog: every event type by domain. Instance records are not exposed by the backend.", endpoint: "/admin/event-catalog", resource: "eventCatalog", missing: "Event catalog endpoint is unavailable." },
  "workflow-versions": { title: "Workflow Versions", eyebrow: "System administration", description: "Registered workflow rule sets and the current version.", endpoint: "/admin/workflow-versions", resource: "workflowVersions", missing: "Workflow versions endpoint is unavailable." },
  "analytics/platform": { title: "Platform Analytics", eyebrow: "Analytics", description: "Real event counters for the current process only; they reset on deploy and are per-worker.", endpoint: "/admin/event-metrics", resource: "eventMetrics", missing: "Event metrics endpoint is unavailable." },
  reports: { title: "Reports", eyebrow: "Trust & Safety", description: "Reported content and users require a dedicated backend review workflow.", missing: "No verified admin reports endpoint exists in the backend admin surface." },
  escrow: { title: "Escrow", eyebrow: "Financial operations", description: "Escrow state is read-only here: finance integrity and deal detail expose balances, while money movement stays with the escrow engine.", missing: "Use Finance Integrity and Deal Detail for escrow visibility." },
  commissions: { title: "Commissions", eyebrow: "Financial operations", description: "Recognised commission is on the Command Center and Finance Integrity pages. No time-series commission analytics endpoint exists.", missing: "Use Finance Integrity for commission reconciliation." },
  "zeno/negotiations": { title: "Zeno Negotiations", eyebrow: "BROKA intelligence", description: "Negotiation message counts are on the Zeno Activity page from durable tables.", missing: "Per-negotiation admin detail is not exposed by the backend." },
  "analytics/marketplace": { title: "Marketplace Analytics", eyebrow: "Analytics", description: "Marketplace window comparisons live on the Command Center from the ops snapshot.", missing: "No marketplace time-series analytics endpoint exists." },
  "analytics/users": { title: "User Analytics", eyebrow: "Analytics", description: "User window comparisons live on the Command Center from the ops snapshot.", missing: "No user time-series analytics endpoint exists." },
  settings: { title: "Settings", eyebrow: "Control center", description: "Deployment settings remain server-owned and never reveal API keys or secret values.", missing: "This deployment intentionally exposes no browser-side secret or direct backend setting mutation." },
};

function buildQuery(params: URLSearchParams, definition: WorkspaceDefinition, page: number): URLSearchParams {
  const query = new URLSearchParams();
  for (const filter of definition.filters ?? []) {
    const raw = params.get(filter.param) ?? definition.defaults?.[filter.param];
    if (!raw || raw === "all") continue;
    if (filter.param === "type" && raw === "flagged") { query.set("flagged_only", "true"); continue; }
    if (filter.param === "type" && raw === "admin") { query.set("is_admin", "true"); continue; }
    if (filter.param === "type") { query.set("account_type", raw); continue; }
    if (filter.param === "state" && definition.resource === "fraudEvents") { query.set("resolved", raw === "resolved" ? "true" : "false"); continue; }
    query.set(filter.param, raw);
  }
  query.set("limit", String(definition.pageSize ?? 50));
  query.set("offset", String((page - 1) * (definition.pageSize ?? 50)));
  return query;
}

function FilterToolbar({ definition, params, onSet, onSetMany }: { definition: WorkspaceDefinition; params: URLSearchParams; onSet: (param: string, value: string | null) => void; onSetMany: (updates: Record<string, string | null>) => void }) {
  const active = (definition.filters ?? []).filter((filter) => params.get(filter.param) && params.get(filter.param) !== "all");
  if (!definition.filters?.length) return null;
  const source = params.get("source");
  return <section className="data-panel p-4">
    <form key={params.toString()} className="flex flex-col gap-3 lg:flex-row lg:items-center" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("searchInput") as HTMLInputElement | null; if (input) onSet("search", input.value.trim() || null); }}>
      {(definition.filters ?? []).map((filter) => {
        if (filter.kind === "search" && filter.param === "search") {
          return <div key={filter.param} className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" /><input name="searchInput" defaultValue={params.get(filter.param) ?? ""} placeholder={filter.placeholder} aria-label={filter.placeholder} className="h-10 w-full rounded-lg border border-white/[0.08] bg-black/15 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-600" /></div>;
        }
        return null;
      })}
      {(definition.filters ?? []).filter((filter): filter is Extract<WsFilter, { kind: "search" }> => filter.kind === "search" && filter.param !== "search").map((filter) => <input key={filter.param} defaultValue={params.get(filter.param) ?? ""} placeholder={filter.placeholder} aria-label={filter.placeholder} onBlur={(event) => onSet(filter.param, event.target.value.trim() || null)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSet(filter.param, event.currentTarget.value.trim() || null); } }} className="h-10 rounded-lg border border-white/[0.08] bg-black/15 px-3 text-xs text-slate-200 placeholder:text-slate-600" />)}
      {(definition.filters ?? []).filter((filter) => filter.kind === "select").map((filter) => {
        const dynamicOptions = filter.param === "status" && definition.resource === "payments" ? (source === "mpesa" ? options(MPESA_STATUSES) : source === "zetupay" ? options(ZETUPAY_STATUSES) : []) : filter.options;
        if (!dynamicOptions.length) return null;
        return <label key={filter.param} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2 text-xs text-slate-400"><SlidersHorizontal size={14} aria-hidden="true" /><span className="text-slate-500">{filter.label}</span><select defaultValue={params.get(filter.param) ?? definition.defaults?.[filter.param] ?? "all"} onChange={(event) => { if (filter.param === "source") onSetMany({ status: null, [filter.param]: event.target.value }); else onSet(filter.param, event.target.value); }} className="bg-transparent text-xs font-semibold text-slate-200 outline-none [&>option]:bg-[#0b0e1a]">{dynamicOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label>;
      })}
      <button type="submit" className="focus-ring h-10 rounded-lg border border-[#8b75ff]/35 bg-[#8b75ff]/10 px-4 text-xs font-semibold text-[#ded8ff] transition hover:bg-[#8b75ff]/20">Apply search</button>
      {active.length ? <button type="button" onClick={() => onSetMany(Object.fromEntries(active.map((filter) => [filter.param, null])))} className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 text-xs font-semibold text-slate-400 transition hover:text-slate-200"><X size={13} aria-hidden="true" />Clear</button> : null}
    </form>
  </section>;
}

export function ResourceWorkspace({ slug }: { slug: string[] }) {
  const definition = workspaces[slug.join("/")];
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const query = useMemo(() => buildQuery(params, definition, page), [params, definition, page]);

  const isUsers = definition.resource === "users";
  const resourceQuery = useAdminResource(definition.resource ?? "summary", query, Boolean(definition.resource) && !isUsers);
  const usersQuery = useAdminUsers(query, isUsers);
  const queryState = isUsers ? usersQuery : resourceQuery;
  const error = queryState.error instanceof AdminRequestError ? queryState.error : null;

  useEffect(() => { if (error?.status === 401) router.replace("/login?reason=session"); }, [error?.status, router]);

  function setParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [param, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all") next.delete(param); else next.set(param, value);
    }
    if (Object.keys(updates).some((param) => param !== "page")) next.delete("page");
    router.replace(next.size ? `?${next.toString()}` : "?", { scroll: false });
  }

  function setParam(param: string, value: string | null) {
    setParams({ [param]: value });
  }

  if (!definition.resource) {
    return <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between"><div><SectionEyebrow>{definition.eyebrow}</SectionEyebrow><h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">{definition.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{definition.description}</p></div><StatusBadge tone="neutral">{definition.endpoint ? "Read-only surface" : "Endpoint required"}</StatusBadge></section>
      <UnavailablePanel title={definition.endpoint ? "Redirected surface" : "Backend endpoint not present"} detail={definition.missing} />
    </div>;
  }

  const state = queryState.isLoading ? "loading" : error?.status === 401 ? "unauthorized" : error?.status === 403 ? "forbidden" : error ? "error" : "ready";
  const endpointMissing = error?.status === 404;
  const stateMessage = state === "loading" ? "Loading backend data" : state === "unauthorized" ? "Your session has expired. Returning to sign in…" : state === "forbidden" ? "Your BROKA account is not authorized for this resource." : state === "error" ? (endpointMissing ? "This workspace needs the upgraded backend — the live API does not expose this endpoint yet (HTTP 404). It activates automatically after the backend upgrade." : error?.message ?? "Unable to load this BROKA resource") : "";
  const data = isUsers ? usersQuery.data?.rows : resourceQuery.data;
  const usersTotal = usersQuery.data?.total;
  const total: number | undefined = isUsers ? usersTotal ?? undefined : (resourceQuery.data as { total?: number } | undefined)?.total;
  const paginated = Boolean(definition.resource && ["deals", "listings", "stores", "disputes", "users"].includes(definition.resource));
  const pageSize = definition.pageSize ?? 50;
  // When the backend does not return X-Total-Count, a full page still means
  // another page may exist; never invent a total from the page length.
  const hasNext = paginated && (typeof total === "number" ? page * pageSize < total : isUsers && (usersQuery.data?.rows.length ?? 0) >= pageSize);
  const empty = state === "ready" && data ? (isUsers ? (usersQuery.data?.rows.length ?? 0) === 0 : isEmptyList(data)) : false;

  return <div className="space-y-6">
    <section className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div><SectionEyebrow>{definition.eyebrow}</SectionEyebrow><h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">{definition.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{definition.description}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {typeof total === "number" ? <StatusBadge tone="info">{total.toLocaleString()} matching record{total === 1 ? "" : "s"}</StatusBadge> : null}
        <StatusBadge tone={state === "ready" ? "success" : state === "loading" || endpointMissing ? "warning" : "danger"}>{state === "ready" ? "Live backend data" : state === "loading" ? "Loading" : endpointMissing ? "Awaiting backend upgrade" : "Unavailable"}</StatusBadge>
      </div>
    </section>

    <FilterToolbar definition={definition} params={params} onSet={setParam} onSetMany={setParams} />

    <section className="data-panel overflow-hidden">
      {state !== "ready" || !data ? <div className="p-5"><ResourceState state={endpointMissing ? "unavailable" : state === "ready" ? "loading" : state} message={stateMessage} /></div> : empty ? <div className="p-5"><ResourceState state="empty" message="No records match the current backend filters." /></div> : isUsers ? <UsersTable users={usersQuery.data?.rows ?? []} /> : <ValidatedResourceView resource={definition.resource} data={data} />}
      {paginated && state === "ready" ? <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 text-xs text-slate-500"><span>Page {page}{typeof total === "number" ? ` · ${total.toLocaleString()} total` : isUsers ? " · filtered total unavailable" : ""}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setParam("page", String(page - 1))} className="focus-ring rounded-lg border border-white/[0.08] px-3 py-1.5 font-semibold text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Previous</button><button disabled={!hasNext} onClick={() => setParam("page", String(page + 1))} className="focus-ring rounded-lg border border-white/[0.08] px-3 py-1.5 font-semibold text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div> : null}
    </section>
  </div>;
}
