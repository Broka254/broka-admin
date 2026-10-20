import { Megaphone, Send, ShieldQuestion } from "lucide-react";

import { SectionEyebrow, StatusBadge, UnavailablePanel } from "@/components/ui/primitives";

const capabilities = [
  { title: "Maintenance notices", detail: "Window, affected service and recovery expectation." },
  { title: "Service incidents", detail: "Incident timeline and recovery updates." },
  { title: "General announcements", detail: "Audience-targeted customer communication." },
  { title: "App releases", detail: "Release notes and minimum supported version policy." },
  { title: "Scheduling and expiry", detail: "Future publication and automatic stop time." },
  { title: "Audience selection", detail: "Explicit segment or all-customer targeting." },
  { title: "Publication history", detail: "Who saved, scheduled, published, changed or withdrew a message." },
  { title: "Delivery status", detail: "Provider receipts for SMS, email or push — separate from database publication." },
];

const lifecycle = [
  { state: "Draft", meaning: "Saved in the communications database. Not scheduled and not delivered." },
  { state: "Scheduled", meaning: "A future publication time is stored. Still not delivered." },
  { state: "Published", meaning: "The announcement is recorded as live for the selected audience. This alone does not prove a notification was sent." },
  { state: "Delivered", meaning: "Requires a provider receipt per channel. No such instrumentation exists in this repository." },
];

export default function CommunicationsPage() {
  return <div className="space-y-6">
    <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <SectionEyebrow>Customer operations</SectionEyebrow>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">Service Communications</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">The admin workspace for maintenance notices, incidents, announcements and app-release policy. The backend does not expose a communications contract yet, so no editor, scheduling control or delivery claim is shown.</p>
      </div>
      <StatusBadge tone="warning">Backend endpoint required</StatusBadge>
    </header>

    <UnavailablePanel
      title="Communications API not present"
      detail="There is no verified admin communications endpoint in the inspected backend surface. Publishing a database row would not prove SMS, email or push delivery, so this dashboard does not simulate drafts, schedules or notifications. The exact required contract is recorded in docs/NOTIFICATION_CONTRACTS.md."
      action={<span className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-100"><ShieldQuestion size={14} aria-hidden="true" />No delivery state is inferred from a saved record.</span>}
    />

    <section className="data-panel p-5" aria-labelledby="communications-capabilities">
      <div className="flex items-center gap-2"><Megaphone size={16} className="text-[#a895ff]" aria-hidden="true" /><p id="communications-capabilities" className="font-display text-base font-semibold text-slate-100">Planned capabilities</p></div>
      <p className="mt-1 text-xs text-slate-500">Each item requires backend persistence, authorization and audit behavior before it can be enabled.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {capabilities.map((capability) => <div key={capability.title} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
          <p className="text-xs font-semibold text-slate-200">{capability.title}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">{capability.detail}</p>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200/80">Requires backend</p>
        </div>)}
      </div>
    </section>

    <section className="data-panel p-5" aria-labelledby="communications-lifecycle">
      <div className="flex items-center gap-2"><Send size={16} className="text-[#54d7e9]" aria-hidden="true" /><p id="communications-lifecycle" className="font-display text-base font-semibold text-slate-100">State meanings the UI must keep separate</p></div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-slate-600">
            <tr><th className="border-b border-white/[0.07] pb-3 pr-4 font-semibold">State</th><th className="border-b border-white/[0.07] pb-3 font-semibold">What it proves</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {lifecycle.map((entry) => <tr key={entry.state}><td className="py-3 pr-4 align-top font-semibold text-slate-200">{entry.state}</td><td className="py-3 align-top leading-5 text-slate-400">{entry.meaning}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
