"use client";

import { AlertTriangle } from "lucide-react";

export function IncidentLifecycleNotice({
  completedAt,
}: {
  completedAt?: string | null;
}) {
  return (
    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3.5 text-xs text-amber-200">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle size={15} />
        Delivery Campaign vs. Incident Resolution
      </div>
      <p className="mt-1 text-[11px] leading-4 text-amber-300/80">
        This communication is an incident notice. A completed delivery campaign does
        not prove the operational incident was resolved, and this dashboard does not
        infer incident resolution from delivery statistics or completion timestamps.
      </p>
      {completedAt ? (
        <p className="mt-1.5 text-[11px] leading-4 text-amber-300/80">
          The backend may mark an incident communication <code>completed</code> when
          delivery settles through <code>complete_published_communications()</code>.
          That lifecycle defect remains a production release blocker; incident
          resolution must be an explicit action by an authorized administrator.
        </p>
      ) : null}
    </div>
  );
}

