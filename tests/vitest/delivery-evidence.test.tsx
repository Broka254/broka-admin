import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConsequentialActionDialog } from "@/components/dashboard/communications/consequential-action-dialog";
import { DeliveryEvidenceGrid } from "@/components/dashboard/communications/delivery-evidence";
import { IncidentLifecycleNotice } from "@/components/dashboard/communications/incident-lifecycle-notice";
import type { CommunicationOut, DeliverySummaryOut } from "@/lib/api/schemas";

const delivery: DeliverySummaryOut = {
  total_recipients: 12,
  read_count: 5,
  by_status: { provider_accepted: 8, delivered: 3, failed: 1 },
  devices_by_status: { provider_accepted: 9, failed: 2 },
  provider_accepted: 8,
  confirmed_delivered: 3,
  failed: 1,
  retry_scheduled: 2,
  pending: 0,
};

const incident: CommunicationOut = {
  id: "comm-incident",
  title: "API degradation",
  body: "We are investigating.",
  communication_type: "incident",
  severity: "critical",
  status: "completed",
  audience: { kind: "all", user_ids: [] },
  channels: ["in_app"],
  audience_count: 12,
  deep_link: null,
  created_by_id: "admin-1",
  updated_by_id: "admin-1",
  version: 1,
  created_at: "2026-01-15T09:30:00.000Z",
  updated_at: "2026-01-15T09:40:00.000Z",
  scheduled_at: null,
  published_at: "2026-01-15T09:32:00.000Z",
  completed_at: "2026-01-15T09:40:00.000Z",
  cancelled_at: null,
  expires_at: null,
  push_available: true,
  warnings: [],
};

describe("delivery evidence labels", () => {
  it("shows supported evidence without presenting confirmed device delivery", () => {
    render(<DeliveryEvidenceGrid delivery={delivery} />);
    expect(screen.getByText("In-App Reads")).toBeInTheDocument();
    expect(screen.getByText("FCM Accepted")).toBeInTheDocument();
    expect(screen.getByText("Device Delivery Evidence")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText(/includes in-app availability/i)).toBeInTheDocument();
    expect(screen.queryByText(/Hardware evidence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confirmed Device/i)).not.toBeInTheDocument();
  });

  it("marks missing metrics as unavailable instead of inventing zeroes", () => {
    render(<DeliveryEvidenceGrid delivery={{ total_recipients: 1 }} />);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(3);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

describe("incident lifecycle honesty", () => {
  it("states that delivery completion is not incident resolution", () => {
    render(<IncidentLifecycleNotice completedAt={incident.completed_at} />);
    expect(screen.getByText(/delivery campaign vs. incident resolution/i)).toBeInTheDocument();
    expect(screen.getByText(/production release blocker/i)).toBeInTheDocument();
    expect(screen.getByText(/does not prove the operational incident was resolved/i)).toBeInTheDocument();
    expect(screen.queryByText(/Incident Resolved/i)).not.toBeInTheDocument();
  });

  it("does not offer incident resolution from the completion action", () => {
    render(
      <ConsequentialActionDialog
        action="complete"
        communication={incident}
        isOpen
        onClose={() => undefined}
        onConfirm={async () => undefined}
      />,
    );
    expect(screen.getByText(/complete the delivery campaign only/i)).toBeInTheDocument();
    expect(screen.getByText(/does not resolve the operational incident/i)).toBeInTheDocument();
    expect(screen.queryByText(/resolve incident/i)).not.toBeInTheDocument();
  });
});

