import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommunicationOut } from "@/lib/api/schemas";

vi.mock("@/hooks/use-admin-resource", () => ({
  useAdminCommunications: vi.fn(),
  isEndpointMissing: (error: unknown) =>
    Boolean(error && typeof error === "object" && "status" in error && error.status === 404),
}));

import { useAdminCommunications } from "@/hooks/use-admin-resource";
import CommunicationsPage from "@/app/(dashboard)/communications/page";

const communicationsMock = vi.mocked(useAdminCommunications);

const communication: CommunicationOut = {
  id: "comm-1",
  title: "Maintenance window",
  body: "Scheduled work",
  communication_type: "maintenance",
  severity: "normal",
  status: "published",
  audience: { kind: "all", user_ids: [] },
  channels: ["in_app"],
  audience_count: 20,
  deep_link: null,
  created_by_id: "admin-1",
  updated_by_id: "admin-1",
  version: 1,
  created_at: "2026-01-15T09:30:00.000Z",
  updated_at: "2026-01-15T09:40:00.000Z",
  scheduled_at: null,
  published_at: "2026-01-15T09:32:00.000Z",
  completed_at: null,
  cancelled_at: null,
  expires_at: null,
  push_available: true,
  warnings: [],
};

function result(overrides: Record<string, unknown> = {}) {
  return {
    data: { items: [communication], total: 100, limit: 15, offset: 0 },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAdminCommunications>;
}

function latestParams() {
  return communicationsMock.mock.calls.at(-1)?.[0] as URLSearchParams;
}

beforeEach(() => {
  communicationsMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("communications page states", () => {
  it("renders the loading state without inventing records", () => {
    communicationsMock.mockReturnValue(result({ data: undefined, isLoading: true }));
    render(<CommunicationsPage />);
    expect(screen.getByText(/loading communications ledger/i)).toBeInTheDocument();
    expect(screen.queryByText(communication.title)).not.toBeInTheDocument();
  });

  it("renders a clear empty state and the server total on populated pages", () => {
    communicationsMock.mockReturnValue(result({ data: { items: [], total: 0, limit: 15, offset: 0 } }));
    const { unmount } = render(<CommunicationsPage />);
    expect(screen.getByText(/no communications found/i)).toBeInTheDocument();
    unmount();

    communicationsMock.mockReturnValue(result());
    render(<CommunicationsPage />);
    expect(screen.getByText(communication.title)).toBeInTheDocument();
    expect(screen.getByText(/showing 1 of 100 communications/i)).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 7/i)).toBeInTheDocument();
  });

  it("renders backend-unavailable failures with the server message", () => {
    communicationsMock.mockReturnValue(result({
      data: undefined,
      isError: true,
      error: new Error("The communications API is unavailable."),
    }));
    render(<CommunicationsPage />);
    expect(screen.getByText(/failed to load communications/i)).toBeInTheDocument();
    expect(screen.getByText(/communications api is unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("advertises a title-only search because the backend does not search bodies", () => {
    communicationsMock.mockReturnValue(result());
    render(<CommunicationsPage />);
    const search = screen.getByRole("textbox", { name: /search communication titles/i });
    expect(search).toHaveAttribute("placeholder", expect.stringMatching(/titles/i));
    expect(screen.queryByText(/search message bodies/i)).not.toBeInTheDocument();
  });

  it("labels a completed incident delivery campaign without claiming incident resolution", () => {
    const incident: CommunicationOut = {
      ...communication,
      communication_type: "incident",
      severity: "critical",
      status: "completed",
      completed_at: "2026-01-15T10:00:00.000Z",
    };
    communicationsMock.mockReturnValue(result({
      data: { items: [incident], total: 1, limit: 15, offset: 0 },
    }));

    render(<CommunicationsPage />);
    expect(screen.getByText("DELIVERY COMPLETE")).toBeInTheDocument();
    expect(screen.getByText(/delivery completed/i)).toBeInTheDocument();
    expect(screen.queryByText(/incident resolved/i)).not.toBeInTheDocument();
    expect(screen.queryByText("COMPLETED", { selector: "span" })).not.toBeInTheDocument();
  });
});

describe("communications server query changes", () => {
  it("debounces rapid search text, resets the offset, and preserves server pagination totals", () => {
    vi.useFakeTimers();
    communicationsMock.mockReturnValue(result());
    render(<CommunicationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(latestParams().get("offset")).toBe("15");

    const search = screen.getByRole("textbox", { name: /search communication titles/i });
    fireEvent.change(search, { target: { value: "m" } });
    fireEvent.change(search, { target: { value: "ma" } });
    fireEvent.change(search, { target: { value: "maintenance" } });

    expect(latestParams().get("offset")).toBe("0");
    expect(latestParams().get("search")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(latestParams().get("search")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(latestParams().get("search")).toBe("maintenance");
    expect(latestParams().get("limit")).toBe("15");
    expect(latestParams().get("offset")).toBe("0");
  });

  it("resets pagination when any structured filter changes", () => {
    communicationsMock.mockReturnValue(result());
    render(<CommunicationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(latestParams().get("offset")).toBe("15");

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "published" } });
    expect(latestParams().get("status")).toBe("published");
    expect(latestParams().get("offset")).toBe("0");
  });
});
