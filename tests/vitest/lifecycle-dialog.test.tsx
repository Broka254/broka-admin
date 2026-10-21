import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CommunicationOut } from "@/lib/api/schemas";

vi.mock("@/lib/api/communications", () => ({
  previewAudience: vi.fn(),
}));

import { previewAudience } from "@/lib/api/communications";
import { ConsequentialActionDialog } from "@/components/dashboard/communications/consequential-action-dialog";

const previewMock = vi.mocked(previewAudience);

const communication: CommunicationOut = {
  id: "comm-1",
  title: "Delivery campaign",
  body: "Body",
  communication_type: "announcement",
  severity: "normal",
  status: "draft",
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
  published_at: null,
  completed_at: null,
  cancelled_at: null,
  expires_at: null,
  push_available: true,
  warnings: [],
};

function scheduleDialog(onConfirm: (payload: { scheduledAt?: string }) => Promise<void>) {
  render(
    <ConsequentialActionDialog
      action="schedule"
      communication={communication}
      isOpen
      onClose={() => undefined}
      onConfirm={onConfirm}
    />,
  );
  fireEvent.change(screen.getByLabelText(/future publication time/i), {
    target: { value: "2099-01-01T10:00" },
  });
  return screen.getByRole("button", { name: /confirm schedule/i });
}

beforeEach(() => {
  previewMock.mockReset();
});

describe("consequential action safeguards", () => {
  it("blocks scheduling until the current audience preview is allowed", async () => {
    previewMock.mockResolvedValue({ kind: "all", count: 500, max_audience: 100, allowed: false });
    const onConfirm = vi.fn(async () => undefined);
    const confirm = scheduleDialog(onConfirm);

    await waitFor(() => expect(screen.getByText(/exceeds the configured maximum/i)).toBeInTheDocument());
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("blocks scheduling while the audience preview is still pending", async () => {
    previewMock.mockReturnValue(new Promise(() => undefined));
    const onConfirm = vi.fn(async () => undefined);
    const confirm = scheduleDialog(onConfirm);

    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("schedules once a current, allowed preview exists", async () => {
    previewMock.mockResolvedValue({ kind: "all", count: 20, max_audience: 100, allowed: true });
    const onConfirm = vi.fn<(payload: { scheduledAt?: string }) => Promise<void>>(async () => undefined);
    const confirm = scheduleDialog(onConfirm);

    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const payload = onConfirm.mock.calls[0][0];
    expect(payload.scheduledAt).toBeTruthy();
    expect(new Date(payload.scheduledAt as string).getTime()).toBeGreaterThan(Date.now());
  });

  it("prevents a duplicate submission while the mutation is in flight", async () => {
    previewMock.mockResolvedValue({ kind: "all", count: 20, max_audience: 100, allowed: true });
    let release!: () => void;
    const onConfirm = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const confirm = scheduleDialog(onConfirm);

    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(confirm).toBeEnabled());
  });

  it("surfaces a failed mutation without closing the action", async () => {
    previewMock.mockResolvedValue({ kind: "all", count: 20, max_audience: 100, allowed: true });
    const onConfirm = vi.fn(async () => {
      throw new Error("Only a draft can be scheduled");
    });
    const confirm = scheduleDialog(onConfirm);

    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.getByText(/only a draft can be scheduled/i)).toBeInTheDocument());
  });
});
