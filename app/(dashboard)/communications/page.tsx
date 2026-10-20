"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Eye,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { SectionEyebrow, StatusBadge, UnavailablePanel } from "@/components/ui/primitives";
import { isEndpointMissing, useAdminCommunications } from "@/hooks/use-admin-resource";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type {
  CommunicationOut,
  CommunicationSeverity,
  CommunicationStatus,
  CommunicationType,
} from "@/lib/api/schemas";
import { buildCommunicationListParams } from "@/lib/communications/search";
import { CommunicationFormDialog } from "@/components/dashboard/communications/communication-form-dialog";
import { CommunicationDetailDialog } from "@/components/dashboard/communications/communication-detail-dialog";
import { WorkerDiagnosticsDialog } from "@/components/dashboard/communications/worker-diagnostics-dialog";

export default function CommunicationsPage() {
  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CommunicationStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<CommunicationType | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<CommunicationSeverity | "all">("all");
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [selectedCommId, setSelectedCommId] = useState<string | null>(null);
  const [commToEdit, setCommToEdit] = useState<CommunicationOut | null>(null);

  const queryParams = useMemo(() => {
    return buildCommunicationListParams({
      page,
      pageSize,
      search: debouncedSearch,
      status: statusFilter,
      communicationType: typeFilter,
      severity: severityFilter,
    });
  }, [debouncedSearch, page, pageSize, severityFilter, statusFilter, typeFilter]);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminCommunications(queryParams);

  const items = data?.items ?? [];

  const hasActiveFilters = statusFilter !== "all" || typeFilter !== "all" || severityFilter !== "all" || Boolean(searchQuery);

  function clearAllFilters() {
    setStatusFilter("all");
    setTypeFilter("all");
    setSeverityFilter("all");
    setSearchQuery("");
    setPage(0);
  }

  function handleCreateDraft() {
    setCommToEdit(null);
    setIsFormOpen(true);
  }

  function handleEditDraft(comm: CommunicationOut) {
    setSelectedCommId(null);
    setCommToEdit(comm);
    setIsFormOpen(true);
  }

  function getStatusTone(status: string): "neutral" | "info" | "warning" | "success" | "danger" {
    switch (status) {
      case "draft":
        return "neutral";
      case "scheduled":
        return "info";
      case "publishing":
        return "warning";
      case "published":
      case "completed":
        return "success";
      case "cancelled":
        return "neutral";
      case "failed":
        return "danger";
      default:
        return "neutral";
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "incident":
        return <AlertTriangle size={14} className="text-amber-400" />;
      case "maintenance":
        return <Wrench size={14} className="text-cyan-400" />;
      case "product_update":
        return <Sparkles size={14} className="text-purple-400" />;
      default:
        return <Megaphone size={14} className="text-emerald-400" />;
    }
  }

  // Handle missing backend endpoint (404)
  if (isEndpointMissing(error)) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionEyebrow>Customer operations</SectionEyebrow>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">
              Service Communications
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Manage announcements, maintenance notices, incidents and product updates. View durable delivery ledgers, provider acceptance, in-app reads and worker diagnostics.
            </p>
          </div>
          <StatusBadge tone="warning">Backend Upgrade Required</StatusBadge>
        </header>

        <UnavailablePanel
          title="Service Communications API not served by backend"
          detail="The verified communications contracts (GET/POST/PATCH /admin/communications) are not available in the deployed backend instance. Upgrade the BROKA API backend to enable live communications management."
          action={
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-200">
              <AlertCircle size={14} />
              Requires backend service_communications domain support
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionEyebrow>Customer operations</SectionEyebrow>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">
            Service Communications
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Manage announcements, maintenance notices, incidents and product updates. View durable delivery ledgers, provider acceptance, in-app reads and worker diagnostics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsDiagnosticsOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5 transition"
          >
            <Cpu size={15} className="text-[#a895ff]" />
            Worker Diagnostics
          </button>
          <button
            onClick={handleCreateDraft}
            className="flex items-center gap-1.5 rounded-xl bg-[#8b75ff] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#8b75ff]/20 hover:bg-[#7a64ee] transition"
          >
            <Plus size={15} />
            New Communication
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.015] p-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search titles across all pages..."
              aria-label="Search communication titles"
              maxLength={100}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className="w-full rounded-xl border border-white/10 bg-[#080a14] pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-[#8b75ff]"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as CommunicationStatus | "all");
              setPage(0);
            }}
            className="rounded-xl border border-white/10 bg-[#080a14] px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-[#8b75ff]"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="publishing">Publishing</option>
            <option value="published">Published</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as CommunicationType | "all");
              setPage(0);
            }}
            className="rounded-xl border border-white/10 bg-[#080a14] px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-[#8b75ff]"
          >
            <option value="all">All Types</option>
            <option value="announcement">Announcement</option>
            <option value="maintenance">Maintenance</option>
            <option value="incident">Incident</option>
            <option value="product_update">Product Update</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value as CommunicationSeverity | "all");
              setPage(0);
            }}
            className="rounded-xl border border-white/10 bg-[#080a14] px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-[#8b75ff]"
          >
            <option value="all">All Severities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-200"
            >
              <X size={12} />
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5 transition"
          >
            <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] py-24 text-center">
          <RefreshCw size={24} className="mx-auto animate-spin text-[#8b75ff]" />
          <p className="mt-3 text-xs text-slate-400">Loading communications ledger from the BROKA API...</p>
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-6 text-center text-xs">
          <AlertCircle size={28} className="mx-auto text-rose-400 mb-2" />
          <h3 className="font-semibold text-rose-200">Failed to load communications</h3>
          <p className="mt-1 text-slate-400">
            {error instanceof Error ? error.message : "The communications API could not be reached."}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
          >
            Try Again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-12 text-center text-xs">
          <Megaphone size={32} className="mx-auto text-slate-600 mb-3" />
          <h3 className="font-semibold text-slate-200 text-sm">No communications found</h3>
          <p className="mt-1 text-slate-400 max-w-sm mx-auto">
            {hasActiveFilters
              ? "No communication records match your current filter selections. Try clearing your filters."
              : "No service communications have been created yet. Click 'New Communication' to draft your first notice."}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearAllFilters}
              className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/20"
            >
              Clear All Filters
            </button>
          ) : (
            <button
              onClick={handleCreateDraft}
              className="mt-4 rounded-lg bg-[#8b75ff] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7a64ee]"
            >
              Draft Communication
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedCommId(item.id)}
                className="group relative cursor-pointer rounded-2xl border border-white/[0.07] bg-[#080a14] p-4 sm:p-5 transition hover:border-[#8b75ff]/40 hover:bg-[#0c0f1e]"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left Column: Badges & Content */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-slate-300">
                        {getTypeIcon(item.communication_type)}
                        <span className="capitalize">{item.communication_type.replace("_", " ")}</span>
                      </span>
                      <StatusBadge tone={item.severity === "critical" ? "danger" : item.severity === "high" ? "warning" : "info"}>
                        {item.severity.toUpperCase()}
                      </StatusBadge>
                      <StatusBadge tone={item.communication_type === "incident" && item.status === "completed" ? "warning" : getStatusTone(item.status)}>
                        {item.communication_type === "incident" && item.status === "completed"
                          ? "DELIVERY COMPLETE"
                          : item.status.toUpperCase()}
                      </StatusBadge>
                      <span className="font-mono text-[11px] text-slate-500">v{item.version}</span>
                    </div>

                    <div>
                      <h3 className="font-display text-base font-semibold text-white group-hover:text-[#a895ff] transition">
                        {item.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400 leading-relaxed font-sans">
                        {item.body}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Users size={12} className="text-[#a895ff]" />
                        Audience: <strong className="text-slate-300 capitalize">{String(item.audience.kind ?? "all")}</strong>
                        {item.audience_count !== null && (
                          <span className="text-slate-500 font-mono">({item.audience_count.toLocaleString()})</span>
                        )}
                      </span>
                      <span>
                        Channels: <strong className="text-slate-300">{item.channels.join(", ")}</strong>
                      </span>
                      {!item.push_available && item.channels.includes("push") && (
                        <span className="flex items-center gap-1 text-amber-300 font-medium">
                          <AlertTriangle size={12} />
                          FCM push not configured
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Timestamps & Action */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 text-xs shrink-0 border-t border-white/[0.04] lg:border-t-0 pt-3 lg:pt-0">
                    <div className="text-[11px] text-slate-400 space-y-0.5 lg:text-right">
                      <div>Created: {new Date(item.created_at).toLocaleDateString()}</div>
                      {item.scheduled_at && (
                        <div className="text-cyan-300">Scheduled: {new Date(item.scheduled_at).toLocaleDateString()}</div>
                      )}
                      {item.published_at && (
                        <div className="text-emerald-300">Published: {new Date(item.published_at).toLocaleDateString()}</div>
                      )}
                      {item.completed_at && (
                        <div className="text-slate-400">
                          {item.communication_type === "incident" ? "Delivery completed" : "Completed"}: {new Date(item.completed_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCommId(item.id);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-[#8b75ff]/20 hover:text-white transition"
                    >
                      <Eye size={13} />
                      View Details &amp; Ledger
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs text-slate-400">
            <span>
              Showing {items.length} of {data?.total ?? 0} communications
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0 || isLoading}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 hover:bg-white/5 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <span className="font-mono text-[11px] px-2">
                Page {page + 1} of {Math.max(1, Math.ceil((data?.total ?? 0) / pageSize))}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * pageSize >= (data?.total ?? 0) || isLoading}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 hover:bg-white/5 disabled:opacity-30"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      {selectedCommId && (
        <CommunicationDetailDialog
          communicationId={selectedCommId}
          isOpen={Boolean(selectedCommId)}
          onClose={() => setSelectedCommId(null)}
          onEditDraft={handleEditDraft}
          onRefreshOverview={() => refetch()}
        />
      )}

      {/* Form Dialog (Create / Edit) */}
      {isFormOpen && (
        <CommunicationFormDialog
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setCommToEdit(null);
          }}
          onSaved={() => refetch()}
          communicationToEdit={commToEdit}
        />
      )}

      {/* Worker Diagnostics Dialog */}
      {isDiagnosticsOpen && (
        <WorkerDiagnosticsDialog
          isOpen={isDiagnosticsOpen}
          onClose={() => setIsDiagnosticsOpen(false)}
        />
      )}
    </div>
  );
}
