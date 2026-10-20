import type {
  CommunicationSeverity,
  CommunicationStatus,
  CommunicationType,
} from "@/lib/api/schemas";

export type CommunicationListFilters = {
  page: number;
  pageSize: number;
  search?: string;
  status?: CommunicationStatus | "all";
  communicationType?: CommunicationType | "all";
  severity?: CommunicationSeverity | "all";
};

/**
 * The backend's `search` parameter performs a case-insensitive title-only
 * match. Message bodies are deliberately not advertised as searchable.
 */
export function buildCommunicationListParams(filters: CommunicationListFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("limit", String(filters.pageSize));
  params.set("offset", String(filters.page * filters.pageSize));

  const search = filters.search?.trim();
  if (search) params.set("search", search.slice(0, 100));
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.communicationType && filters.communicationType !== "all") {
    params.set("communication_type", filters.communicationType);
  }
  if (filters.severity && filters.severity !== "all") params.set("severity", filters.severity);
  return params;
}

