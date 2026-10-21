import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommunicationFormDialog } from "@/components/dashboard/communications/communication-form-dialog";
import { AdminRequestError } from "@/hooks/use-admin-resource";
import type { CommunicationOut } from "@/lib/api/schemas";
import { isoToLocalDateTimeInput } from "@/lib/communications/datetime";

vi.mock("@/lib/api/communications", () => ({
  createCommunication: vi.fn(),
  updateCommunication: vi.fn(),
  previewAudience: vi.fn(),
}));

import { createCommunication, updateCommunication } from "@/lib/api/communications";

const createMock = vi.mocked(createCommunication);
const updateMock = vi.mocked(updateCommunication);

const saved: CommunicationOut = {
  id: "comm-1",
  title: "Maintenance",
  body: "Planned work",
  communication_type: "announcement",
  severity: "normal",
  status: "draft",
  audience: { kind: "all", user_ids: [] },
  channels: ["in_app"],
  audience_count: null,
  deep_link: null,
  created_by_id: "admin-1",
  updated_by_id: "admin-1",
  version: 1,
  created_at: "2030-01-15T09:30:00.000Z",
  updated_at: "2030-01-15T09:30:00.000Z",
  scheduled_at: null,
  published_at: null,
  completed_at: null,
  cancelled_at: null,
  expires_at: "2030-01-16T09:30:00.000Z",
  push_available: true,
  warnings: [],
};

function fillCreateForm(container: HTMLElement) {
  fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Maintenance" } });
  fireEvent.change(screen.getByLabelText(/message body/i), { target: { value: "Planned work" } });
  return container.querySelector("form") as HTMLFormElement;
}

describe("communication draft submission", () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
  });

  it("prevents accidental duplicate submissions while one request is in flight", async () => {
    let resolveCreate!: (value: CommunicationOut) => void;
    createMock.mockReturnValue(new Promise((resolve) => {
      resolveCreate = resolve;
    }));
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <CommunicationFormDialog isOpen onClose={onClose} onSaved={onSaved} />,
    );
    const form = fillCreateForm(container);
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    resolveCreate(saved);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("preserves the key after a timeout and starts a new key after the payload changes", async () => {
    createMock
      .mockRejectedValueOnce(new TypeError("Network timeout"))
      .mockRejectedValueOnce(new TypeError("Network timeout"))
      .mockResolvedValueOnce(saved);
    const { container } = render(
      <CommunicationFormDialog isOpen onClose={() => undefined} onSaved={() => undefined} />,
    );
    const form = fillCreateForm(container);

    fireEvent.submit(form);
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/outcome may be unknown/i)).toBeInTheDocument());
    const firstKey = createMock.mock.calls[0][1];

    fireEvent.submit(form);
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(2));
    expect(createMock.mock.calls[1][1]).toBe(firstKey);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Changed title" } });
    fireEvent.submit(form);
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(3));
    expect(createMock.mock.calls[2][1]).not.toBe(firstKey);
  });

  it("sends null when an existing expiry is cleared", async () => {
    updateMock.mockResolvedValue({ ...saved, version: 2, expires_at: null });
    render(
      <CommunicationFormDialog
        isOpen
        communicationToEdit={saved}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    const expiryInput = screen.getByLabelText(/expiry timestamp/i);
    await waitFor(() =>
      expect(expiryInput).toHaveValue(isoToLocalDateTimeInput(saved.expires_at)),
    );
    fireEvent.change(expiryInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft changes/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][1]).toMatchObject({ expires_at: null });
  });

  it("sends the backend version so a stale edit is detected server-side", async () => {
    updateMock.mockResolvedValue({ ...saved, version: 2 });
    render(
      <CommunicationFormDialog
        isOpen
        communicationToEdit={saved}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Updated maintenance" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft changes/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][1]).toMatchObject({
      expected_version: saved.version,
      title: "Updated maintenance",
    });
  });

  it("reports a version conflict without claiming the draft was saved", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    updateMock.mockRejectedValue(
      new AdminRequestError("Communication version has changed", 409, "conflict"),
    );
    render(
      <CommunicationFormDialog
        isOpen
        communicationToEdit={saved}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save draft changes/i }));

    await waitFor(() =>
      expect(screen.getByText(/version has changed/i)).toBeInTheDocument(),
    );
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText(/outcome may be unknown/i)).not.toBeInTheDocument();
  });
});
