"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ResourceState, SectionEyebrow, UnavailablePanel } from "@/components/ui/primitives";
import { ServiceCostsWorkspace } from "@/components/dashboard/service-costs/service-costs-workspace";
import { AdminRequestError, isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";

function isoDate(date: Date) {
  return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
}
function addDay(value: string) {
  const d=new Date(value+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);
}
function initialRange() {
  const end=new Date();const start=new Date();start.setDate(end.getDate()-29);
  return {from:isoDate(start),through:isoDate(end)};
}
function unavailable(error: unknown) {
  return isEndpointMissing(error)||(error instanceof AdminRequestError&&["endpoint_unavailable","path_not_allowlisted","contract_not_registered"].includes(error.code??""));
}

export default function ServiceCostsPage() {
  const [range,setRange]=useState(initialRange);
  const query=useMemo(()=>new URLSearchParams({from:range.from,to:addDay(range.through)}),[range.from,range.through]);
  const costs=useAdminResource("serviceCosts",query);
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><SectionEyebrow>Money / Operations</SectionEyebrow><h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Service costs</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Production usage and spend across BROKA integrations: invoice-backed costs, usage estimates, and auditable manual records.</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">From</span><input type="date" value={range.from} max={range.through} onChange={e=>setRange(r=>({...r,from:e.target.value}))} className="focus-ring rounded-lg border border-white/10 bg-[#0c1020] px-3 py-2 text-xs text-slate-200"/></label>
        <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Through</span><input type="date" value={range.through} min={range.from} onChange={e=>setRange(r=>({...r,through:e.target.value}))} className="focus-ring rounded-lg border border-white/10 bg-[#0c1020] px-3 py-2 text-xs text-slate-200"/></label>
        <button type="button" onClick={()=>costs.refetch()} disabled={costs.isFetching} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-50"><RefreshCw size={13} className={costs.isFetching?"animate-spin":""}/>Refresh</button>
      </div>
    </div>
    {costs.isLoading?<ResourceState state="loading" message="Loading service usage and cost records."/>:
      costs.isError?(
        unavailable(costs.error)?<UnavailablePanel title="Service-cost API not deployed" detail="This workspace expects GET /admin/revenue/costs and POST /admin/revenue/costs/entries. The connected backend does not yet expose this contract, so the dashboard shows no sample figures. Deploy the service-cost endpoints in the BROKA backend to activate this screen." action={<a href="https://github.com/Xxavier-ml/broka" target="_blank" rel="noreferrer" className="focus-ring inline-flex rounded-lg border border-cyan-300/25 px-3 py-2 text-xs font-semibold text-cyan-100">Open BROKA backend repository</a>}/>:
        <ResourceState state={costs.error instanceof AdminRequestError&&costs.error.status===403?"forbidden":costs.error instanceof AdminRequestError&&costs.error.status===401?"unauthorized":"error"} message={costs.error instanceof Error?costs.error.message:"Unable to load service costs."} action={<button type="button" onClick={()=>costs.refetch()} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Retry</button>}/>
      ):
      costs.data?<><div className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-xs"><p className="text-slate-400">Reporting period: <span className="font-semibold text-slate-200">{range.from} through {range.through}</span></p><p className="text-[10px] text-slate-500">Snapshot: {costs.data.generated_at}</p></div><ServiceCostsWorkspace data={costs.data}/></>:
      <ResourceState state="empty" message="No service-cost data was returned."/>}
  </div>;
}
