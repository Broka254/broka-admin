import { Activity, ArrowUpRight } from "lucide-react";

import { ResourceState } from "@/components/ui/primitives";

export function ActivityFeed({ state }: { state: "loading" | "error" | "schema-unavailable" }) {
  const message = state === "loading" ? "Loading audited backend activity" : state === "error" ? "Unable to load backend activity" : "Event activity needs a documented admin event record model";
  return (
    <section className="data-panel" aria-labelledby="recent-activity-heading">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5">
        <div><p id="recent-activity-heading" className="text-base font-semibold text-slate-100">Recent activity</p><p className="mt-1 text-xs text-slate-500">Events and audit data only</p></div>
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-slate-500"><Activity size={16} aria-hidden="true" /></span>
      </div>
      <div className="p-5"><ResourceState state={state === "schema-unavailable" ? "unavailable" : state} message={message} /></div>
      <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3 text-xs text-slate-600"><span>No fabricated live status</span><a href="/events" className="inline-flex items-center gap-1 font-medium text-amber-200 hover:text-amber-100">Open event operations <ArrowUpRight size={13} /></a></div>
    </section>
  );
}
