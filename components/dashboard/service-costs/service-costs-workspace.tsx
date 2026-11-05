"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, AlertTriangle, FilePlus2, Receipt, Search, ShieldCheck, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/primitives";
import { useCreateManualServiceCost } from "@/hooks/use-service-costs";
import { ServiceCostEntryCreateInSchema, type ServiceCostsDashboard } from "@/lib/api/service-costs-contract";

function addDays(value: string, days: number) { const date = new Date(value + "T00:00:00Z"); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function money(minor: number, code: string, exponents: Map<string, number>) {
  const exponent = exponents.get(code) ?? 2;
  try { return new Intl.NumberFormat("en-KE", { style: "currency", currency: code, minimumFractionDigits: exponent, maximumFractionDigits: exponent }).format(minor / 10 ** exponent); }
  catch { return code + " " + (minor / 10 ** exponent).toFixed(exponent); }
}
function label(source: string) { return ({ provider_invoice:"Provider invoice", usage_estimate:"Usage estimate", manual:"Manual entry", mixed:"Mixed sources", unpriced:"Unpriced" } as Record<string,string>)[source] ?? source.replaceAll("_"," "); }
function tone(source: string): "success"|"info"|"warning"|"neutral" { return source === "provider_invoice" ? "success" : source === "usage_estimate" ? "info" : source === "manual" || source === "mixed" ? "warning" : "neutral"; }
function dateLabel(value: string) { const d = new Date(value + "T12:00:00"); return new Intl.DateTimeFormat("en-KE",{day:"2-digit",month:"short",year:"numeric"}).format(d); }

export function ServiceCostsWorkspace({ data }: { data: ServiceCostsDashboard }) {
  const [search,setSearch] = useState("");
  const [category,setCategory] = useState("all");
  const [open,setOpen] = useState(false);
  const [serviceKey,setServiceKey] = useState(data.services[0]?.key ?? "");
  const [start,setStart] = useState(data.period.from);
  const [through,setThrough] = useState(addDays(data.period.to,-1));
  const [amount,setAmount] = useState("");
  const [currency,setCurrency] = useState(data.currencies[0]?.code ?? "");
  const [description,setDescription] = useState("");
  const [note,setNote] = useState("");
  const [error,setError] = useState<string|null>(null);
  const [saved,setSaved] = useState(false);
  const mutation = useCreateManualServiceCost();
  const exponents = useMemo(()=>new Map(data.currencies.map((c)=>[c.code,c.minor_unit_exponent])),[data.currencies]);
  const categories = useMemo(()=>Array.from(new Set(data.services.map(s=>s.category))).sort(),[data.services]);
  const visible = useMemo(()=>{
    const q=search.trim().toLowerCase();
    return data.services.filter(s=>(category==="all"||s.category===category)&&(!q||[s.name,s.provider,s.category,s.key].some(v=>v.toLowerCase().includes(q))));
  },[category,data.services,search]);
  const pickedCurrency = data.currencies.find(c=>c.code===currency);
  const pickedService = data.services.find(s=>s.key===serviceKey);
  useEffect(()=>{if(!data.services.some(s=>s.key===serviceKey))setServiceKey(data.services[0]?.key??"");},[data.services,serviceKey]);

  function openForm() {
    setServiceKey(data.services[0]?.key??""); setStart(data.period.from); setThrough(addDays(data.period.to,-1));
    setCurrency(data.currencies[0]?.code??""); setAmount(""); setDescription(""); setNote(""); setError(null); setOpen(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setSaved(false);
    if(!pickedCurrency){setError("Choose a supported currency.");return;}
    const value=Number(amount);
    if(!Number.isFinite(value)||value<=0){setError("Enter a cost greater than zero.");return;}
    if(through<start){setError("The period end must be on or after the start date.");return;}
    const scaled=value*10**pickedCurrency.minor_unit_exponent;
    if(Math.abs(scaled-Math.round(scaled))>0.000001){setError("The amount has more decimal places than this currency supports.");return;}
    const parsed=ServiceCostEntryCreateInSchema.safeParse({
      service_key:serviceKey,description:description.trim(),period_start:start,period_end:addDays(through,1),
      amount_minor:Math.round(scaled),currency,note:note.trim()||null,
    });
    if(!parsed.success){setError(parsed.error.issues[0]?.message??"Check the form.");return;}
    try{
      await mutation.mutateAsync({input:parsed.data,idempotencyKey:crypto.randomUUID()});
      setOpen(false);setSaved(true);
    }catch(e){setError(e instanceof Error?e.message:"Could not save cost record.");}
  }

  return <div className="space-y-6">
    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
      <div className="flex items-start gap-3"><ShieldCheck size={18} className="mt-0.5 text-cyan-200" aria-hidden="true"/><div><p className="text-sm font-semibold text-cyan-100">Costs are not guessed or blended</p><p className="mt-1 text-xs leading-5 text-slate-300">Invoice-backed spend, usage estimates and manual records stay separate. Unpriced is not zero. Totals are never combined across currencies.</p></div></div>
    </div>
    {saved?<p role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.07] p-3 text-sm text-emerald-200">Manual cost saved. Figures are refreshing from the backend.</p>:null}

    <section><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Financial overview</p><h2 className="mt-1 font-display text-lg font-bold text-white">Cost totals by currency</h2></div><p className="text-xs text-slate-500">No FX conversion is applied.</p></div>
      {data.summary_by_currency.length?<div className="grid gap-3 xl:grid-cols-2">{data.summary_by_currency.map(s=>{
        const total=s.actual_minor+s.estimated_minor+s.manual_minor;
        return <article key={s.currency} className="rounded-xl border border-white/10 bg-[#0c1020] p-4">
          <p className="text-xs font-bold tracking-widest text-slate-300">{s.currency}</p>
          <p className="mt-3 font-display text-2xl font-bold text-white">{money(total,s.currency,exponents)}</p>
          <p className="mt-1 text-[10px] text-slate-500">Recorded total: invoice + estimates + manual</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Invoice-backed" value={money(s.actual_minor,s.currency,exponents)}/>
            <Metric label="Estimated" value={money(s.estimated_minor,s.currency,exponents)}/>
            <Metric label="Manual" value={money(s.manual_minor,s.currency,exponents)}/>
            <Metric label="Maximum estimate" value={s.maximum_estimate_minor===null?"Not supplied":money(s.maximum_estimate_minor,s.currency,exponents)}/>
          </div>
        </article>;
      })}</div>:<div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-400">No priced totals were returned. This does not mean BROKA had zero production costs.</div>}
    </section>

    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1020]">
      <div className="flex flex-col gap-4 border-b border-white/[0.07] p-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2 text-cyan-200"><Activity size={15}/><p className="text-[10px] font-bold uppercase tracking-widest">Usage and spend</p></div><h2 className="mt-1 font-display text-lg font-bold text-white">Service inventory</h2><p className="mt-1 text-xs text-slate-500">{data.services.length} services returned by the backend.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative"><span className="sr-only">Search services</span><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search service / provider" className="focus-ring w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-xs text-slate-200 sm:w-52"/></label>
          <label><span className="sr-only">Filter category</span><select value={category} onChange={e=>setCategory(e.target.value)} className="focus-ring w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-xs text-slate-200"><option value="all">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
          <button type="button" onClick={openForm} disabled={!data.services.length||!data.currencies.length} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-[#8b75ff]/50 bg-[#8b75ff]/15 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><FilePlus2 size={14}/>Add manual cost</button>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left">
        <thead><tr className="border-b border-white/[0.06] text-[9px] font-bold uppercase tracking-widest text-slate-500"><th className="px-5 py-3">Service / provider</th><th className="px-4 py-3">Usage</th><th className="px-4 py-3">Success / failed</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Confidence</th></tr></thead>
        <tbody className="divide-y divide-white/[0.05]">{visible.map(s=><tr key={s.key} className="align-top hover:bg-white/[0.02]">
          <td className="px-5 py-4"><p className="text-sm font-semibold text-white">{s.name}</p><p className="mt-1 text-[11px] text-slate-500">{s.provider} · {s.category}</p><p className="mt-1 text-[10px] text-slate-600">{s.key}</p></td>
          <td className="px-4 py-4 text-sm tabular-nums text-slate-200">{s.usage.quantity===null?"Not reported":new Intl.NumberFormat("en-KE").format(s.usage.quantity)+" "+s.usage.unit}<p className="mt-1 text-[10px] text-slate-500">{s.usage.source.replaceAll("_"," ")}</p></td>
          <td className="px-4 py-4 text-xs text-slate-300">{s.usage.success_count===null?"—":s.usage.success_count+" successful"}<p className="mt-1 text-slate-500">{s.usage.failed_count===null?"—":s.usage.failed_count+" failed"}</p></td>
          <td className="px-4 py-4 text-sm font-semibold text-white">{s.cost.amount_minor===null||s.cost.currency===null?"Unpriced":money(s.cost.amount_minor,s.cost.currency,exponents)}{s.cost.maximum_estimate_minor!==null&&s.cost.currency?<p className="mt-1 text-[10px] font-normal text-slate-500">Max: {money(s.cost.maximum_estimate_minor,s.cost.currency,exponents)}</p>:null}{s.cost.note?<p className="mt-1 max-w-xs text-[10px] font-normal text-slate-500">{s.cost.note}</p>:null}</td>
          <td className="px-4 py-4"><StatusBadge tone={tone(s.cost.source)}>{label(s.cost.source)}</StatusBadge></td>
          <td className="px-4 py-4"><StatusBadge tone={s.cost.confidence==="high"?"success":s.cost.confidence==="medium"?"info":s.cost.confidence==="low"?"warning":"neutral"}>{s.cost.confidence}</StatusBadge></td>
        </tr>)}
        {!visible.length?<tr><td colSpan={6} className="px-5 py-9 text-center text-sm text-slate-500">No services match these filters.</td></tr>:null}</tbody>
      </table></div>
      <p className="border-t border-white/[0.06] px-5 py-3 text-[10px] text-slate-500">The backend-maintained catalog should include uninstrumented services so missing coverage is visible.</p>
    </section>

    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1020]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] p-4"><div><div className="flex items-center gap-2 text-amber-200"><Receipt size={15}/><p className="text-[10px] font-bold uppercase tracking-widest">Audit trail</p></div><h2 className="mt-1 font-display text-lg font-bold text-white">Recent cost records</h2></div><p className="text-xs text-slate-500">{data.entries.length} records</p></div>
      {data.entries.length?<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-white/[0.06] text-[9px] font-bold uppercase tracking-widest text-slate-500"><th className="px-5 py-3">Record</th><th className="px-4 py-3">Service</th><th className="px-4 py-3">Period</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Actor</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{data.entries.map(e=><tr key={e.id}><td className="px-5 py-4"><p className="text-xs font-semibold text-slate-200">{e.description}</p><p className="mt-1 text-[10px] text-slate-600">{e.id}</p>{e.note?<p className="mt-1 text-[10px] text-slate-500">{e.note}</p>:null}</td><td className="px-4 py-4 text-xs text-slate-300">{e.service_name||e.service_key}</td><td className="px-4 py-4 text-xs text-slate-400">{dateLabel(e.period_start)} – {dateLabel(addDays(e.period_end,-1))}</td><td className="px-4 py-4 text-xs font-semibold text-white">{money(e.amount_minor,e.currency,exponents)}</td><td className="px-4 py-4"><StatusBadge tone={tone(e.source)}>{label(e.source)}</StatusBadge></td><td className="px-4 py-4 text-xs text-slate-400">{e.recorded_by||"Not supplied"}</td></tr>)}</tbody></table></div>:<p className="px-5 py-8 text-center text-sm text-slate-500">No cost records for this period.</p>}
    </section>

    <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4"><div className="flex items-start gap-2.5"><AlertTriangle size={15} className="mt-0.5 text-amber-200"/><div><p className="text-xs font-semibold text-amber-100">Accounting boundary</p><p className="mt-1 text-xs leading-5 text-slate-400">Production service costs are not marketplace GMV or buyer/seller escrow principal. Manual entries remain attributable and must not overwrite provider invoices or usage estimates.</p></div></div></div>

    {open?<div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div role="dialog" aria-modal="true" aria-labelledby="manual-cost-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0c1020] shadow-2xl sm:rounded-2xl">
      <div className="flex items-start justify-between border-b border-white/[0.07] p-5"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[#b4a7ff]">Administrator input</p><h2 id="manual-cost-title" className="mt-1 font-display text-xl font-bold text-white">Add manual cost record</h2><p className="mt-1 text-xs text-slate-400">Creates a separate auditable record; does not replace an estimate or invoice.</p></div><button type="button" onClick={()=>setOpen(false)} disabled={mutation.isPending} aria-label="Close manual cost form" className="focus-ring rounded-lg p-2 text-slate-400"><X size={17}/></button></div>
      <form onSubmit={submit} className="space-y-4 p-5">
        <label className="block text-xs text-slate-300">Service<select required value={serviceKey} onChange={e=>{setServiceKey(e.target.value);const s=data.services.find(x=>x.key===e.target.value);if(s?.cost.currency&&data.currencies.some(c=>c.code===s.cost.currency))setCurrency(s.cost.currency);}} className="focus-ring mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-slate-100">{data.services.map(s=><option key={s.key} value={s.key}>{s.name} · {s.provider}</option>)}</select></label>
        <label className="block text-xs text-slate-300">Description<input required maxLength={160} value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. monthly hosting invoice" className="focus-ring mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-slate-100"/></label>
        <div className="grid gap-3 sm:grid-cols-[1fr_130px]"><label className="block text-xs text-slate-300">Amount<input required type="number" min="0" step={pickedCurrency?1/10**pickedCurrency.minor_unit_exponent:0.01} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="focus-ring mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-slate-100"/></label><label className="block text-xs text-slate-300">Currency<select required value={currency} onChange={e=>setCurrency(e.target.value)} className="focus-ring mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-slate-100">{data.currencies.map(c=><option key={c.code}>{c.code}</option>)}</select></label></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs text-slate-300">Period starts<input type="date" required value={start} onChange={e=>setStart(e.target.value)} className="focus-ring mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-slate-100"/></label><label className="block text-xs text-slate-300">Period through<input type="date" min={start} required value={through} onChange={e=>setThrough(e.target.value)} className="focus-ring mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-slate-100"/></label></div>
        <label className="block text-xs text-slate-300">Audit note (optional)<textarea rows={3} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Invoice reference, source or assumptions." className="focus-ring mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-slate-100"/></label>
        {error?<p role="alert" className="rounded-lg border border-rose-300/20 p-3 text-xs text-rose-200">{error}</p>:null}
        <div className="flex justify-end gap-2 border-t border-white/[0.07] pt-4"><button type="button" onClick={()=>setOpen(false)} disabled={mutation.isPending} className="rounded-lg border border-white/10 px-4 py-2.5 text-xs text-slate-300">Cancel</button><button type="submit" disabled={mutation.isPending||!pickedService||!pickedCurrency} className="rounded-lg bg-[#8b75ff] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{mutation.isPending?"Saving…":"Save manual cost"}</button></div>
      </form>
    </div></div>:null}
  </div>;
}

function Metric({label,value}:{label:string;value:string}) { return <div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-words text-xs font-semibold tabular-nums text-slate-200">{value}</p></div>; }
