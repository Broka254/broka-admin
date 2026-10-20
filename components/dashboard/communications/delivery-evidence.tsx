"use client";

import type { DeliverySummaryOut } from "@/lib/api/schemas";

type DeliveryEvidenceProps = {
  delivery?: Partial<DeliverySummaryOut> | null;
};

function metricValue(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "Unavailable";
}

export function DeliveryEvidenceGrid({ delivery }: DeliveryEvidenceProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total Recipients</span>
        <span className="font-mono text-base font-bold text-white">{metricValue(delivery?.total_recipients)}</span>
        <span className="text-[10px] text-slate-500 block">Audience rows resolved by the backend</span>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">In-App Reads</span>
        <span className="font-mono text-base font-bold text-emerald-400">{metricValue(delivery?.read_count)}</span>
        <span className="text-[10px] text-slate-500 block">Read acknowledgements; not push delivery</span>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">FCM Accepted</span>
        <span className="font-mono text-base font-bold text-cyan-300">{metricValue(delivery?.provider_accepted)}</span>
        <span className="text-[10px] text-slate-500 block">Provider acceptance only; no device-display proof</span>
      </div>

      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.03] p-3">
        <span className="text-[10px] text-amber-300/80 uppercase tracking-wider block">Device Delivery Evidence</span>
        <span className="font-mono text-sm font-bold text-amber-200">Unavailable</span>
        <span className="text-[10px] text-slate-500 block">
          The API&apos;s <code>confirmed_delivered</code> value includes in-app availability, so it is not proof a device displayed the message.
        </span>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Pending / Queued</span>
        <span className="font-mono text-base font-bold text-amber-300">{metricValue(delivery?.pending)}</span>
        <span className="text-[10px] text-slate-500 block">In worker pipeline</span>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Failed / Retry</span>
        <span className="font-mono text-base font-bold text-rose-400">
          {metricValue(delivery?.failed)}
          <span className="text-xs text-slate-500 ml-1">
            ({metricValue(delivery?.retry_scheduled)} queued)
          </span>
        </span>
        <span className="text-[10px] text-slate-500 block">Retry queue is not success</span>
      </div>
    </div>
  );
}

