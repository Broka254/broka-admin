import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/account-status", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/account-status")>()),
  useAccountModeration: vi.fn(),
  submitAccountChange: vi.fn(),
}));

import { useAccountModeration } from "@/lib/api/account-status";
import { AccountStatusPanel } from "@/components/dashboard/user-intelligence/account-status-panel";

function withState(status: "active" | "restricted" | "suspended") {
  return {
    isLoading: false,
    isError: false,
    error: null,
    data: {
      user_id: "u1",
      status,
      suspended_until: null,
      status_reason: null,
      status_changed_at: null,
      status_changed_by: null,
      status_version: 3,
      history: [{
        id: "e1",
        action: "restricted",
        from_status: "active",
        to_status: "restricted",
        suspended_until: null,
        reason: "Disputed deliveries on two deals",
        notes: null,
        evidence_refs: null,
        actor_id: "admin-1",
        request_id: null,
        created_at: "2026-11-20T10:00:00Z",
      }],
    },
  } as never;
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AccountStatusPanel userId="u1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(useAccountModeration).mockReturnValue(withState("active"));
});

describe("AccountStatusPanel", () => {
  it("shows the status and the history reason an administrator reviewed", () => {
    renderPanel();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Disputed deliveries on two deals")).toBeInTheDocument();
  });

  it("keeps the change locked until a reason and the typed confirmation are both present", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Suspend account" }));
    const dialog = screen.getByRole("dialog", { name: "Suspend account" });
    const submit = within(dialog).getByRole("button", { name: "Suspend account" });
    expect(submit).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Chargebacks on three deals" } });
    expect(submit).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/Type CONFIRM/), { target: { value: "CONFIRM" } });
    expect(submit).toBeEnabled();
  });

  it("does not offer a restriction on an account that is already restricted", () => {
    vi.mocked(useAccountModeration).mockReturnValue(withState("restricted"));
    renderPanel();
    expect(screen.getByRole("button", { name: "Restrict account" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reinstate account" })).toBeEnabled();
  });

  it("offers no reinstatement for an active account", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Reinstate account" })).toBeDisabled();
  });
});
