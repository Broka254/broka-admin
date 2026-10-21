import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CommunicationOut, DeliverySummaryOut, RecipientOut } from "@/lib/api/schemas";

vi.mock("@/hooks/use-admin-resource", () => ({
  useAdminCommunicationDetail: vi.fn(),
  useAdminCommunicationRecipients: vi.fn(),
}));

vi.mock("@/lib/api/communications", () => ({
  cancelCommunication: vi.fn(),
  completeCommunication: vi.fn(),
  publishCommunication: vi.fn(),
  retryRecipients: vi.fn(),
  scheduleCommunication: vi.fn(),
  previewAudience: vi.fn(),
}));

import {
  useAdminCommunicationDetail,
  useAdminCommunicationRecipients,
} from "@/hooks/use-admin-resource";
import { previewAudience, publishCommunication, retryRecipients, cancelCommunication } from "@/lib/api/communications";
import { CommunicationDetailDialog } from "@/components/dashboard/communications/communication-detail-dialog";

const detailMock = vi.mocked(useAdminCommunicationDetail);
const recipientsMock = vi.mocked(useAdminCommunicationRecipients);
const retryMock = vi.mocked(retryRecipients);
const publishMock = vi.mocked(publishCommunication);
const cancelMock = vi.mocked(cancelCommunication);
const previewMock = vi.mocked(previewAudience);

const communication: CommunicationOut = {
  id: "comm-1",
  title: "Delivery campaign",
  body: "Body",
  communication_type: "announcement",
  severity: "normal",
  status: "published",
  audience: { kind: "all", user_ids: [] },
  channels: ["in_app", "push"],
  audience_count: 40,
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

const delivery: DeliverySummaryOut = {
  total_recipients: 40,
  read_count: 0,
  by_status: { failed: 40 },
  devices_by_status: { failed: 40 },
  provider_accepted: 0,
  confirmed_delivered: 0,
  failed: 40,
  retry_scheduled: 0,
  pending: 0,
};

const draftCommunication: CommunicationOut = {
  ...communication,
  status: "draft",
  published_at: null,
  completed_at: null,
  scheduled_at: null,
};

function recipient(id: string, retryEligible: boolean): RecipientOut {
  return {
    id,
    user_id: `user-${id}`,
    status: "failed",
    attempt_count: 2,
    last_attempt_at: "2026-01-15T09:35:00.000Z",
    provider_message_id: null,
    delivered_at: null,
    read_at: null,
    failure_category: retryEligible ? "provider_transient" : "invalid_token",
    retry_eligible: retryEligible,
    next_attempt_at: null,
  };
}

function mockDetail(refetchDetail = vi.fn().mockResolvedValue(undefined), record: CommunicationOut = communication) {
  detailMock.mockReturnValue({
    data: { communication: record, delivery },
    isLoading: false,
    isError: false,
    error: null,
    refetch: refetchDetail,
  } as unknown as ReturnType<typeof useAdminCommunicationDetail>);
  return refetchDetail;
}

function mockRecipients(
  refetchRecipients = vi.fn().mockResolvedValue(undefined),
  total = 40,
) {
  recipientsMock.mockImplementation((_id, query) => {
    const offset = Number(query?.get("offset") ?? 0);
    const rows = offset === 0
      ? [recipient("r1", true), recipient("r2", false)]
      : [recipient("r3", true)];
    return {
      data: { items: rows, total, limit: 20, offset },
      isLoading: false,
      refetch: refetchRecipients,
    } as unknown as ReturnType<typeof useAdminCommunicationRecipients>;
  });
  return refetchRecipients;
}

function renderDetail(onRefreshOverview = vi.fn()) {
  return render(
    <CommunicationDetailDialog
      communicationId={communication.id}
      isOpen
      onClose={() => undefined}
      onEditDraft={() => undefined}
      onRefreshOverview={onRefreshOverview}
    />,
  );
}

function openRetryDialog() {
  const dialogs = screen.getAllByRole("dialog");
  return within(dialogs[dialogs.length - 1]);
}

async function openActionDialog(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
  const dialog = openRetryDialog();
  await waitFor(() => expect(dialog.getByRole("button", { name })).toBeInTheDocument());
  return dialog;
}

beforeEach(() => {
  detailMock.mockReset();
  recipientsMock.mockReset();
  retryMock.mockReset();
  publishMock.mockReset();
  cancelMock.mockReset();
  previewMock.mockReset();
  previewMock.mockResolvedValue({ kind: "all", count: 40, max_audience: 1000, allowed: true });
});

describe("recipient retry workflow", () => {
  it("only enables eligible recipients and refreshes detail, ledger, and overview after acceptance", async () => {
    const refetchDetail = mockDetail();
    const refetchRecipients = mockRecipients();
    const onRefreshOverview = vi.fn();
    retryMock.mockResolvedValue({ retried: 1, message: "Eligible recipients were queued for retry" });

    renderDetail(onRefreshOverview);

    const eligible = screen.getByRole("checkbox", { name: /select user-r1 for retry/i });
    const ineligible = screen.getByRole("checkbox", { name: /select user-r2 for retry/i });
    expect(eligible).toBeEnabled();
    expect(ineligible).toBeDisabled();

    fireEvent.click(eligible);
    fireEvent.click(screen.getByRole("button", { name: /retry selected \(1\)/i }));
    fireEvent.click(openRetryDialog().getByRole("button", { name: /retry selected \(1\)/i }));

    await waitFor(() => expect(retryMock).toHaveBeenCalledTimes(1));
    expect(retryMock.mock.calls[0][0]).toBe("comm-1");
    expect(retryMock.mock.calls[0][1]).toEqual(["r1"]);
    expect(retryMock.mock.calls[0][2]).toMatch(/^[0-9a-f-]{36}$/i);
    await waitFor(() => expect(refetchDetail).toHaveBeenCalledTimes(1));
    expect(refetchRecipients).toHaveBeenCalledTimes(1);
    expect(onRefreshOverview).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/accepted for retry queuing/i)).toBeInTheDocument();
    expect(screen.getByText(/not delivery success/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry selected \(0\)/i })).toBeDisabled();
  });

  it("clears selection when pagination changes", async () => {
    mockDetail();
    mockRecipients();
    renderDetail();

    fireEvent.click(screen.getByRole("checkbox", { name: /select user-r1 for retry/i }));
    expect(screen.getByRole("button", { name: /retry selected \(1\)/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /next recipient page/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /retry selected \(0\)/i })).toBeDisabled(),
    );
    expect(screen.getByRole("checkbox", { name: /select user-r3 for retry/i })).toBeEnabled();
  });

  it("shows a rejected retry and does not claim refresh or success", async () => {
    const refetchDetail = mockDetail();
    const refetchRecipients = mockRecipients();
    const onRefreshOverview = vi.fn();
    retryMock.mockRejectedValue(new Error("Retry lease was lost"));

    renderDetail(onRefreshOverview);
    fireEvent.click(screen.getByRole("checkbox", { name: /select user-r1 for retry/i }));
    fireEvent.click(screen.getByRole("button", { name: /retry selected \(1\)/i }));
    fireEvent.click(openRetryDialog().getByRole("button", { name: /retry selected \(1\)/i }));

    await waitFor(() => expect(screen.getByText(/retry lease was lost/i)).toBeInTheDocument());
    expect(refetchDetail).not.toHaveBeenCalled();
    expect(refetchRecipients).not.toHaveBeenCalled();
    expect(onRefreshOverview).not.toHaveBeenCalled();
    expect(screen.queryByText(/accepted for retry queuing/i)).not.toBeInTheDocument();
  });
});

describe("publication lifecycle", () => {
  it("reuses one idempotency key when an ambiguous publish is retried", async () => {
    mockDetail(vi.fn().mockResolvedValue(undefined), draftCommunication);
    mockRecipients();
    publishMock
      .mockRejectedValueOnce(new TypeError("Network timeout"))
      .mockResolvedValueOnce({ communication: draftCommunication, accepted: true });

    renderDetail();
    const dialog = await openActionDialog(/publish now/i);
    const confirm = dialog.getByRole("button", { name: /publish now/i });
    await waitFor(() => expect(confirm).toBeEnabled());

    fireEvent.click(confirm);
    await waitFor(() => expect(publishMock).toHaveBeenCalledTimes(1));
    const firstKey = publishMock.mock.calls[0][1];
    await waitFor(() => expect(screen.getByText(/network timeout/i)).toBeInTheDocument());

    fireEvent.click(confirm);
    await waitFor(() => expect(publishMock).toHaveBeenCalledTimes(2));
    expect(publishMock.mock.calls[1][1]).toBe(firstKey);
  });

  it("does not claim publication success when the backend does not accept it", async () => {
    const refetchDetail = mockDetail(vi.fn().mockResolvedValue(undefined), draftCommunication);
    mockRecipients();
    publishMock.mockResolvedValue({ communication: draftCommunication, accepted: false });

    renderDetail();
    const dialog = await openActionDialog(/publish now/i);
    const confirm = dialog.getByRole("button", { name: /publish now/i });
    await waitFor(() => expect(confirm).toBeEnabled());

    fireEvent.click(confirm);
    await waitFor(() =>
      expect(screen.getByText(/did not accept the publication request/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/published successfully/i)).not.toBeInTheDocument();
    expect(refetchDetail).toHaveBeenCalledTimes(1);
  });

  it("starts a new idempotency key for a different lifecycle action", async () => {
    mockDetail(vi.fn().mockResolvedValue(undefined), draftCommunication);
    mockRecipients();
    publishMock.mockRejectedValue(new TypeError("Network timeout"));
    cancelMock.mockResolvedValue({ ...draftCommunication, status: "cancelled" });

    renderDetail();
    const publishDialog = await openActionDialog(/publish now/i);
    const publishConfirm = publishDialog.getByRole("button", { name: /publish now/i });
    await waitFor(() => expect(publishConfirm).toBeEnabled());
    fireEvent.click(publishConfirm);
    await waitFor(() => expect(publishMock).toHaveBeenCalledTimes(1));
    const publishKey = publishMock.mock.calls[0][1];

    fireEvent.click(screen.getAllByRole("button", { name: /^cancel$/i })[0]);
    const cancelDialog = openRetryDialog();
    fireEvent.click(cancelDialog.getByRole("button", { name: /cancel communication/i }));

    await waitFor(() => expect(cancelMock).toHaveBeenCalledTimes(1));
    expect(cancelMock.mock.calls[0][2]).not.toBe(publishKey);
  });
});
