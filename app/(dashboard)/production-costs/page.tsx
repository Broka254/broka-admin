"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Activity, Bot, CreditCard, Database, HardDrive, Image as ImageIcon, Layers, Mail, MessageSquare, Server } from "lucide-react";

import { DateRangePicker, type DateRangeSelection } from "@/components/dashboard/date-range-picker";
import { ResourceState, SectionEyebrow, StatusBadge } from "@/components/ui/primitives";
import { useAdminResource, AdminRequestError, isEndpointMissing } from "@/hooks/use-admin-resource";
import { useCreateProductionCostEntry } from "@/hooks/use-production-costs";
import type { ProductionCostService } from "@/lib/api/schemas";

function dateOnly(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function defaultSelection(): DateRangeSelection {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: dateOnly(from), to: dateOnly(to), bucket: "day" };
}

function rangeQuery(selection: DateRangeSelection): URLSearchParams {
  const end = new Date(selection.to + "T00:00:00.000Z");
  end.setUTCDate(end.getUTCDate() + 1);
  return new URLSearchParams({ from: selection.from, to: end.toISOString().slice(0, 10) });
}

function money(value: number | null, currency: string): string {
  if (value === null) return "Not priced";
  if (!/^[A-Z]{3}$/.test(currency)) return "Mixed currencies";
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value / (10 ** digits));
}

function unavailable(error: unknown): boolean {
  return isEndpointMissing(error) || (error instanceof AdminRequestError && ["endpoint_unavailable", "path_not_allowlisted", "contract_not_registered"].includes(error.code ?? ""));
}

const SERVICE_ICONS: Record<string, typeof Activity> = {
  messaging: MessageSquare,
  artificial_intelligence: Bot,
  media_generation: ImageIcon,
  infrastructure: Server,
  payments: CreditCard,
  storage: HardDrive,
  database: Database,
  cache: Layers,
  email: Mail,
};

function CostEntryForm({ services, selection, onClose }: { services: ProductionCostService[]; selection: DateRangeSelection; onClose: () => void }) {
  const mutation = useCreateProductionCostEntry();
  const [serviceKey, setServiceKey] = useState(services[0]?.service_key ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(services.find((s) => s.service_key === services[0]?.service_key)?.currency === "MULTI" ? "KES" : services[0]?.currency ?? "KES");
  const [notes, setNotes] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");

  const selected = services.find((s) => s.service_key === serviceKey);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    const digits = /^[A-Z]{3}$/.test(currency) ? new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits : 2;
    const pattern = digits === 0 ? /^\d+$/ : new RegExp("^\\d+(\\.\\d{1," + digits + "})?$");
    if (!Number.isFinite(value) || value < 0 || !pattern.test(amount) || !selected) return;
    const minor = Math.round(value * (10 ** digits));
    if (!Number.isSafeInteger(minor)) return;
    const end = new Date(selection.to + "T00:00:00.000Z");
    end.setUTCDate(end.getUTCDate() + 1);
    mutation.mutate({
      input: {
        service_key: serviceKey,
        period_start: selection.from + "T00:00:00Z",
        period_end: end.toISOString(),
        currency,
        manually_entered_cost_minor: minor,
        notes: notes.trim() || null,
        invoice_reference: invoiceReference.trim() || null,
      },
    }, { onSuccess: onClose });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-[#8b75ff]/25 bg-[#8b75ff]/[0.055] p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="text-sm font-semibold text-white">Record a manual cost or invoice</h3><p className="mt-1 text-xs text-slate-400">The backend records the admin actor and audit history. Existing usage and estimates are preserved.</p></div>
        <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-white">Close</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs text-slate-300">Service
          <select required value={serviceKey} onChange={(e) => { setServiceKey(e.target.value); const s = services.find((x) => x.service_key === e.target.value); setCurrency(s?.currency === "MULTI" ? "KES" : s?.currency ?? "KES"); }} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-white">
            {services.map((s) => <option key={s.service_key} value={s.service_key}>{s.service_name}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-300">Amount
          <input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-white" />
        </label>
        <label className="text-xs text-slate-300">Currency
          <input required maxLength={3} minLength={3} pattern="[A-Z]{3}" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm uppercase text-white" />
        </label>
        <label className="text-xs text-slate-300">Invoice / reference
          <input maxLength={160} value={invoiceReference} onChange={(e) => setInvoiceReference(e.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-white" />
        </label>
        <label className="text-xs text-slate-300 sm:col-span-2 xl:col-span-4">Notes / description
          <input maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe the invoice or cost" className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-white" />
        </label>
      </div>
      {mutation.isError ? <p role="alert" className="mt-3 text-xs text-rose-300">{mutation.error.message}</p> : null}
      <button type="submit" disabled={mutation.isPending || !serviceKey || !/^[A-Z]{3}$/.test(currency)} className="mt-4 rounded-lg bg-[#8b75ff] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{mutation.isPending ? "Saving…" : "Save cost entry"}</button>
    </form>
  );
}

export default function ProductionCostsPage() {
  const [selection, setSelection] = useState<DateRangeSelection>(defaultSelection);
  const [entryOpen, setEntryOpen] = useState(false);
  const query = useMemo(() => rangeQuery(selection), [selection.from, selection.to]);
  const costs = useAdminResource("productionCosts", query);
  const entries = useAdminResource("productionCostEntries", query, Boolean(costs.data));
  const adjustments = useAdminResource("productionCostAdjustments", query, Boolean(costs.data));

  if (costs.isLoading) return <div className="space-y-6"><div><SectionEyebrow>Money / Cost control</SectionEyebrow><h1 className="font-display text-3xl font-bold text-white">Production costs</h1></div><DateRangePicker {...selection} onChange={setSelection} showBucket={false} /><ResourceState state="loading" message="Loading provider usage and production costs." /></div>;
  if (costs.isError) {
    if (unavailable(costs.error)) return <div className="space-y-6"><div><SectionEyebrow>Money / Cost control</SectionEyebrow><h1 className="font-display text-3xl font-bold text-white">Production costs</h1></div><DateRangePicker {...selection} onChange={setSelection} showBucket={false} /><ResourceState state="error" message="The verified backend route /admin/revenue/costs/services is not available on the connected API deployment yet." /></div>;
    return <div className="space-y-6"><div><SectionEyebrow>Money / Cost control</SectionEyebrow><h1 className="font-display text-3xl font-bold text-white">Production costs</h1></div><DateRangePicker {...selection} onChange={setSelection} showBucket={false} /><ResourceState state="error" message={costs.error.message} action={<button onClick={() => costs.refetch()} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white">Retry</button>} /></div>;
  }
  if (!costs.data) return <ResourceState state="empty" message="No production-cost response was returned." />;

  const data = costs.data;
  const totals = data.totals_by_currency;
  const amountList = (key: "effective_cost_minor" | "actual_cost_minor" | "estimated_cost_minor" | "manually_entered_cost_minor" | "adjusted_cost_minor") => totals.length ? totals.map((t) => money(t[key], t.currency)).join(" · ") : "No priced costs";
  const priced = data.services.filter((s) => s.effective_cost_minor !== null).length;
  const usage = data.services.reduce((n, s) => n + s.requests_total, 0);
  const notes = Array.from(new Set(data.services.map((s) => s.notes).filter((v): v is string => Boolean(v))));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><SectionEyebrow>Money / Cost control</SectionEyebrow><h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Production costs</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">Provider usage, effective-dated pricing, invoices and manual adjustments across BROKA services.</p><p className="mt-2 text-[11px] text-slate-500">Generated {new Date(data.generated_at).toLocaleString("en-KE")} · {data.reporting_period.start.slice(0,10)} to {data.reporting_period.end.slice(0,10)} (end exclusive)</p></div>
        <button type="button" onClick={() => setEntryOpen((v) => !v)} className="rounded-lg border border-[#8b75ff]/45 bg-[#8b75ff]/15 px-3 py-2.5 text-xs font-semibold text-white">{entryOpen ? "Close entry" : "＋ Add invoice / manual cost"}</button>
      </div>
      <DateRangePicker {...selection} onChange={setSelection} showBucket={false} />
      {entryOpen ? <CostEntryForm services={data.services} selection={selection} onClose={() => setEntryOpen(false)} /> : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-[#0c1020] p-4"><p className="text-xs text-slate-400">Effective production cost</p><p className="mt-2 text-xl font-bold text-white">{amountList("effective_cost_minor")}</p><p className="mt-1 text-xs text-slate-500">{priced} priced service(s); currencies remain separate.</p></article>
        <article className="rounded-xl border border-white/10 bg-[#0c1020] p-4"><p className="text-xs text-slate-400">Provider / invoice actuals</p><p className="mt-2 text-xl font-bold text-white">{amountList("actual_cost_minor")}</p><p className="mt-1 text-xs text-slate-500">Invoice-backed cost, separate from estimates.</p></article>
        <article className="rounded-xl border border-white/10 bg-[#0c1020] p-4"><p className="text-xs text-slate-400">Usage estimates</p><p className="mt-2 text-xl font-bold text-white">{amountList("estimated_cost_minor")}</p><p className="mt-1 text-xs text-slate-500">Rate-based estimate, not provider invoice evidence.</p></article>
        <article className="rounded-xl border border-white/10 bg-[#0c1020] p-4"><p className="text-xs text-slate-400">Usage requests</p><p className="mt-2 text-xl font-bold text-white">{usage.toLocaleString("en-KE")}</p><p className="mt-1 text-xs text-slate-500">Recorded provider operations in this period.</p></article>
      </section>
      {notes.length ? <section className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4"><p className="text-xs font-semibold text-cyan-100">Reporting notes</p><ul className="mt-2 space-y-1">{notes.map((n) => <li key={n} className="text-xs leading-5 text-slate-300">{n}</li>)}</ul></section> : null}
      <section className="space-y-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Service breakdown</p><h2 className="mt-1 font-display text-xl font-bold text-white">Usage and cost by service</h2></div>
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0c1020]"><table className="w-full min-w-[1050px] text-sm"><thead><tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="p-3">Service</th><th className="p-3 text-right">Requests</th><th className="p-3 text-right">Successful</th><th className="p-3 text-right">Failed</th><th className="p-3 text-right">Usage</th><th className="p-3 text-right">Actual</th><th className="p-3 text-right">Estimate</th><th className="p-3 text-right">Manual</th><th className="p-3 text-right">Effective cost</th><th className="p-3">Basis / status</th></tr></thead><tbody>{data.services.map((s) => { const Icon = SERVICE_ICONS[s.category] ?? Activity; return <tr key={s.service_key} className="border-b border-white/[0.05] last:border-0"><td className="p-3"><div className="flex items-center gap-2"><Icon size={15} className="text-slate-400" /><div><p className="font-medium text-white">{s.service_name}</p><p className="text-[11px] text-slate-500">{s.provider ?? s.service_key} · {s.service_key}</p></div></div></td><td className="p-3 text-right tabular-nums text-slate-300">{s.requests_total.toLocaleString("en-KE")}</td><td className="p-3 text-right tabular-nums text-emerald-300">{s.requests_success.toLocaleString("en-KE")}</td><td className="p-3 text-right tabular-nums text-rose-300">{s.requests_failed.toLocaleString("en-KE")}</td><td className="p-3 text-right tabular-nums text-slate-300">{s.usage_quantity.toLocaleString("en-KE")} {s.usage_unit ?? ""}</td><td className="p-3 text-right text-slate-300">{money(s.actual_cost_minor, s.currency)}</td><td className="p-3 text-right text-slate-300">{money(s.estimated_cost_minor, s.currency)}{s.maximum_estimated_cost_minor !== null ? <span className="block text-[10px] text-amber-200">max {money(s.maximum_estimated_cost_minor, s.currency)}</span> : null}</td><td className="p-3 text-right text-slate-300">{money(s.manually_entered_cost_minor, s.currency)}</td><td className="p-3 text-right font-semibold text-white">{money(s.effective_cost_minor, s.effective_currency ?? s.currency)}</td><td className="p-3"><StatusBadge tone={s.cost_status === "priced" || s.cost_status === "free" ? "success" : s.cost_status === "no_usage" ? "neutral" : "warning"}>{s.cost_source} · {s.cost_status}</StatusBadge><p className="mt-1 text-[10px] text-slate-500">{s.confidence}</p></td></tr>; })}</tbody></table></div>
      </section>
      <section className="space-y-3"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Billing history</p><h2 className="mt-1 font-display text-xl font-bold text-white">Cost entries</h2></div><StatusBadge tone="neutral">{entries.data?.entries.length ?? 0} record(s)</StatusBadge></div>
        {entries.isLoading ? <ResourceState state="loading" message="Loading invoice and manual entries." /> : entries.isError ? <ResourceState state="error" message={entries.error.message} /> : entries.data?.entries.length ? <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0c1020]"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b border-white/10 text-left text-[10px] uppercase text-slate-500"><th className="p-3">Period</th><th className="p-3">Service</th><th className="p-3">Source / notes</th><th className="p-3">Reference</th><th className="p-3 text-right">Actual</th><th className="p-3 text-right">Manual</th></tr></thead><tbody>{entries.data.entries.map((e) => <tr key={e.id} className="border-b border-white/[0.05]"><td className="p-3 text-slate-400">{e.period_start.slice(0,10)} – {e.period_end.slice(0,10)}</td><td className="p-3 text-white">{e.service_name}</td><td className="p-3 text-slate-400">{e.cost_source}{e.notes ? <span className="block text-[11px] text-slate-500">{e.notes}</span> : null}</td><td className="p-3 text-slate-400">{e.invoice_reference ?? "—"}</td><td className="p-3 text-right text-slate-300">{money(e.actual_cost_minor,e.currency)}</td><td className="p-3 text-right text-slate-300">{money(e.manually_entered_cost_minor,e.currency)}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-white/10 bg-[#0c1020] p-4 text-sm text-slate-500">No invoice or manual entries in this period.</p>}
      </section>
      <section className="space-y-3"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Audit history</p><h2 className="mt-1 font-display text-xl font-bold text-white">Cost adjustments</h2></div><StatusBadge tone="neutral">{adjustments.data?.adjustments.length ?? 0} adjustment(s)</StatusBadge></div>
        {adjustments.isLoading ? <ResourceState state="loading" message="Loading adjustment history." /> : adjustments.isError ? <ResourceState state="error" message={adjustments.error.message} /> : adjustments.data?.adjustments.length ? <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0c1020]"><table className="w-full min-w-[750px] text-sm"><thead><tr className="border-b border-white/10 text-left text-[10px] uppercase text-slate-500"><th className="p-3">Changed</th><th className="p-3">Service</th><th className="p-3">Reason</th><th className="p-3">Admin</th><th className="p-3 text-right">Adjusted amount</th></tr></thead><tbody>{adjustments.data.adjustments.map((a) => <tr key={a.id} className="border-b border-white/[0.05]"><td className="p-3 text-slate-400">{new Date(a.created_at).toLocaleString("en-KE")}</td><td className="p-3 text-white">{a.service_name}</td><td className="p-3 text-slate-400">{a.reason}</td><td className="p-3 text-slate-400">{a.adjusted_by}</td><td className="p-3 text-right text-white">{money(a.adjusted_amount_minor,a.currency)}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-white/10 bg-[#0c1020] p-4 text-sm text-slate-500">No manual adjustments in this period.</p>}
      </section>
      <p className="text-[11px] leading-5 text-slate-600">The backend keeps actual invoices, usage-derived estimates, manual amounts and adjustments distinct. Totals are never combined across currencies. Usage-event details are available through the backend /admin/revenue/costs/usage endpoint.</p>
    </div>
  );
}
