import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConsequentialActionDialog } from "@/components/dashboard/communications/consequential-action-dialog";
import type { CommunicationOut } from "@/lib/api/schemas";
import {
  eligibleRecipientIds,
  isRetryEligible,
  recipientStatusLabel,
  toggleRetrySelection,
} from "@/lib/communications/recipients";

const communication: CommunicationOut = {
  id: "comm-1",
  title: "Delivery campaign",
  body: "Body",
  communication_type: "announcement",
  severity: "normal",
  status: "published",
  audience: { kind: "all", user_ids: [] },
  channels: ["in_app", "push"],
  audience_count: 10,
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

describe("recipient retry selection", () => {
  it("selects only recipients marked eligible by the backend", () => {
    const rows = [
      { id: "r1", retry_eligible: true },
      { id: "r2", retry_eligible: false },
    ];
    expect(eligibleRecipientIds(rows)).toEqual(["r1"]);
    expect(isRetryEligible(rows[1])).toBe(false);
    expect(toggleRetrySelection([], rows[1])).toEqual([]);
    expect(toggleRetrySelection([], rows[0])).toEqual(["r1"]);
    expect(toggleRetrySelection(["r1"], rows[0])).toEqual([]);
  });

  it("labels the backend delivered row as in-app availability, not device proof", () => {
    expect(recipientStatusLabel("delivered")).toBe("In-app available / device unverified");
    expect(recipientStatusLabel("provider_accepted")).toBe("Provider accepted");
  });

  it("rejects an empty retry selection without calling the API", async () => {
    const onConfirm = vi.fn(async () => undefined);
    render(
      <ConsequentialActionDialog
        action="retry"
        communication={communication}
        isOpen
        onClose={() => undefined}
        onConfirm={onConfirm}
        selectedRecipientIds={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /retry selected \(0\)/i }));
    await waitFor(() =>
      expect(screen.getByText(/select at least one retry-eligible recipient/i)).toBeInTheDocument(),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("submits only the selected recipient identifiers", async () => {
    const onConfirm = vi.fn(async () => undefined);
    render(
      <ConsequentialActionDialog
        action="retry"
        communication={communication}
        isOpen
        onClose={() => undefined}
        onConfirm={onConfirm}
        selectedRecipientIds={["r1", "r3"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /retry selected \(2\)/i }));
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({ recipientIds: ["r1", "r3"] }),
    );
  });
});

