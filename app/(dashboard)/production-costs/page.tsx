"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  Bell,
  Bot,
  CreditCard,
  Database,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Mail,
  MessageSquare,
  Server,
  type LucideIcon,
} from "lucide-react";

import { DateRangePicker, type DateRangeSelection } from "@/components/dashboard/date-range-picker";
import { ResourceState, SectionEyebrow, StatusBadge, UnavailablePanel } from "@/components/ui/primitives";
import { useAdminResource, AdminRequestError, isEndpointMissing } from "@/hooks/use-admin-resource";
import { useCreateProductionCostManualEntry } from "@/hooks/use-production-costs";
import type { ProductionCostService } from "@/lib/api/schemas";
import { currencyMinorUnitDigits, formatMinorCurrency, formatUsage, summarizeProductionCosts, toMinorUnits } from "@/lib/production-costs";

type ServiceCatalogItem = { label: string; detail: string; icon: LucideIcon };

const SERVICE_CATALOG: ServiceCatalogItem[] = [
  { label: "SMS delivery", detail: "Message count, SMS segments, provider billing", icon: MessageSquare },
  { label: "AI requests", detail: "Total requests and estimated maximum model cost", icon: Bot },
  { label: "Image generation", detail: "Generation count and estimated maximum cost", icon: ImageIcon },
  { label: "Email delivery", detail: "Emails sent, delivery volume and provider charges", icon: Mail },
  { label: "Server / hosting", detail: "Runtime, compute, bandwidth and hosting invoices", icon: Server },
  { label: "Database", detail: "Database usage, storage, backups and billing", icon: Database },
  { label: "Storage and media", detail: "Uploaded files, object storage and processing", icon: HardDrive },
  { label: "Cache / Redis", detail: "Cache usage and hosted Redis charges", icon: Layers },
  { label: "Push notifications", detail: "FCM or other notification-provider usage", icon: Bell },
  { label: "Payment services", detail: "Provider fees charged to BROKA, excluding escrow principal", icon: CreditCard },
  { label: "Other services", detail: "Any additional production service or vendor", icon: Activity },
];

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function defaultSelection(): DateRangeSelection {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: dateOnly(from), to: dateOnly(to), bucket: "day" };
}

function queryForRange(selection: DateRangeSelection): URLSearchParams {
  const end = new Date(selection.to + "T00:00:00.000Z");
  end.setUTCDate(end.getUTCDate() + 1);
  const query = new URLSearchParams();
  query.set("from", selection.from);
  query.set("to", end.toISOString().slice(0, 10));
  return query;
}

function unavailable(error: unknown): boolean {
  return isEndpointMissing(error) ||
    (error instanceof AdminRequestError &&
      ["endpoint_unavailable", "path_not_allowlisted", "contract_not_registered"].includes(error.code ?? ""));
}

function costBasisLabel(basis: ProductionCostService["selected_cost_basis"]): string {
  switch (basis) {
    case "provider_reported": return "Provider-reported";
    case "usage_estimate": return "Usage estimate";
    case "manual_entry": return "Manual entry";
    default: return "Unavailable";
  }
}

function basisTone(basis: ProductionCostService["selected_cost_basis"]): "success" | "warning" | "neutral" {
  if (basis === "provider_reported") return "success";
  if (basis === "usage_estimate" || basis === "manual_entry") return "warning";
  return "neutral";
}

type SummaryAmountField =
  | "selectedMinor"
  | "providerReportedMinor"
  | "estimatedMinor"
  | "estimatedMaxMinor"
  | "manualMinor";
type SummaryCountField =
  | "pricedServices"
  | "providerReportedServices"
  | "estimatedServices"
  | "estimatedMaxServices"
  | "manualServices";

const SUMMARY_COUNT_FIELD: Record<SummaryAmountField, SummaryCountField> = {
  selectedMinor: "pricedServices",
  providerReportedMinor: "providerReportedServices",
  estimatedMinor: "estimatedServices",
  estimatedMaxMinor: "estimatedMaxServices",
  manualMinor: "manualServices",
};

function byCurrencyLabel(
  groups: ReturnType<typeof summarizeProductionCosts>,
  field: SummaryAmountField,
): string {
  // Include a real zero-cost record (for example, a confirmed free AI tier)
  // instead of mislabelling it as missing data.
  const countField = SUMMARY_COUNT_FIELD[field];
  const populated = groups.filter((group) => group[field] > 0 || group[countField] > 0);
  return populated.length
    ? populated.map((group) => formatMinorCurrency(group[field], group.currency)).join(" · ")
    : "No value reported";
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1020] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 break-words font-display text-xl font-bold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function ServiceCostTable({ services }: { services: ProductionCostService[] }) {
  if (services.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <p className="text-sm font-semibold text-slate-200">No service cost records in this period</p>
        <p className="mt-1 text-xs text-slate-500">The backend returned no service usage or cost rows for the selected dates.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[1120px] text-sm">
        <thead className="bg-white/[0.025]">
          <tr className="text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3 text-right">Usage</th>
            <th className="px-4 py-3 text-right">Requests</th>
            <th className="px-4 py-3 text-right">Provider reported</th>
            <th className="px-4 py-3 text-right">Estimate / max</th>
            <th className="px-4 py-3 text-right">Manual entries</th>
            <th className="px-4 py-3 text-right">Included cost</th>
            <th className="px-4 py-3">Cost basis</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.key} className="border-t border-white/[0.06] align-top">
              <td className="px-4 py-4">
                <p className="font-semibold text-slate-100">{service.label}</p>
                <p className="mt-1 text-[11px] capitalize text-slate-500">{service.category}</p>
                {service.source_label ? <p className="mt-1 text-[11px] text-slate-500">Source: {service.source_label}</p> : null}
                {service.estimate_method ? <p className="mt-1 text-[11px] text-slate-500">Estimate: {service.estimate_method}</p> : null}
                {service.pricing_version ? <p className="mt-1 text-[11px] text-slate-500">Pricing version: {service.pricing_version}</p> : null}
                {service.notes.length > 0 ? (
                  <p className="mt-1 max-w-[240px] text-[11px] leading-4 text-amber-200/75">{service.notes.join(" ")}</p>
                ) : null}
              </td>
              <td className="px-4 py-4 text-right tabular-nums text-slate-300">
                {formatUsage(service.usage_count, service.usage_unit)}
              </td>
              <td className="px-4 py-4 text-right tabular-nums text-slate-300">
                {service.request_count === null ? "—" : service.request_count.toLocaleString("en-KE")}
              </td>
              <td className="px-4 py-4 text-right tabular-nums text-slate-300">
                {service.provider_reported_minor === null ? "—" : formatMinorCurrency(service.provider_reported_minor, service.currency)}
              </td>
              <td className="px-4 py-4 text-right tabular-nums text-slate-300">
                {service.usage_estimate_minor === null && service.estimated_max_minor === null ? "—" : (
                  <span>
                    {service.usage_estimate_minor === null
                      ? "Estimate unavailable"
                      : formatMinorCurrency(service.usage_estimate_minor, service.currency)}
                    {service.estimated_max_minor !== null ? (
                      <span className="mt-1 block text-[11px] text-amber-200/80">
                        max {formatMinorCurrency(service.estimated_max_minor, service.currency)}
                      </span>
                    ) : null}
                  </span>
                )}
              </td>
              <td className="px-4 py-4 text-right tabular-nums text-slate-300">
                {service.manual_minor === null ? "—" : formatMinorCurrency(service.manual_minor, service.currency)}
              </td>
              <td className="px-4 py-4 text-right font-semibold tabular-nums text-white">
                {service.selected_cost_minor === null
                  ? "Not priced"
                  : formatMinorCurrency(service.selected_cost_minor, service.currency)}
              </td>
              <td className="px-4 py-4">
                <StatusBadge tone={basisTone(service.selected_cost_basis)}>
                  {costBasisLabel(service.selected_cost_basis)}
                </StatusBadge>
                {service.last_synced_at ? (
                  <p className="mt-1 text-[10px] text-slate-600">
                    Updated {new Date(service.last_synced_at).toLocaleString("en-KE")}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManualEntryForm({
  services,
  onClose,
}: {
  services: ProductionCostService[];
  onClose: () => void;
}) {
  const mutation = useCreateProductionCostManualEntry();
  const [serviceKey, setServiceKey] = useState(services[0]?.key ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(services[0]?.currency ?? "KES");
  const [occurredOn, setOccurredOn] = useState(dateOnly(new Date()));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    const digits = currencyMinorUnitDigits(currency);
    const amountPattern = digits === 0 ? /^\d+$/ : new RegExp("^\\d+(\\.\\d{1," + digits + "})?$");
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !amountPattern.test(amount)) return;
    const amountMinor = toMinorUnits(parsedAmount, currency);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return;

    mutation.mutate({
      service_key: serviceKey,
      amount_minor: amountMinor,
      currency,
      occurred_on: occurredOn,
      description: description.trim(),
      reference: reference.trim() || null,
    }, {
      onSuccess: () => onClose(),
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-[#8b75ff]/25 bg-[#8b75ff]/[0.055] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Record a manual production cost</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            This creates a separate, auditable entry. It does not overwrite provider data or silently replace an estimate.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-400 hover:text-white">Close</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs font-medium text-slate-300">
          Service
          <select required value={serviceKey} onChange={(event) => {
            const nextServiceKey = event.target.value;
            setServiceKey(nextServiceKey);
            const selectedService = services.find((service) => service.key === nextServiceKey);
            if (selectedService) setCurrency(selectedService.currency);
          }} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-white outline-none focus:border-[#8b75ff]/60">
            {services.map((service) => <option key={service.key} value={service.key}>{service.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-300">
          Amount
          <input required inputMode="decimal" pattern={currencyMinorUnitDigits(currency) === 0 ? "\\d+" : "\\d+(\\.\\d{1," + currencyMinorUnitDigits(currency) + "})?"} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={currencyMinorUnitDigits(currency) === 0 ? "0" : "0." + "0".repeat(currencyMinorUnitDigits(currency))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-white outline-none focus:border-[#8b75ff]/60" />
        </label>
        <label className="text-xs font-medium text-slate-300">
          Currency
          <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-white outline-none focus:border-[#8b75ff]/60">
            {Array.from(new Set(["KES", "USD", ...services.map((service) => service.currency)])).sort().map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-300">
          Cost date
          <input required type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-white outline-none focus:border-[#8b75ff]/60" />
        </label>
        <label className="text-xs font-medium text-slate-300 sm:col-span-2">
          Description / reason
          <input required minLength={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Monthly hosting invoice" className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-white outline-none focus:border-[#8b75ff]/60" />
        </label>
        <label className="text-xs font-medium text-slate-300">
          Invoice / reference (optional)
          <input maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Invoice number or reference" className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080a14] px-3 py-2.5 text-sm text-white outline-none focus:border-[#8b75ff]/60" />
        </label>
      </div>

      {mutation.isError ? <p role="alert" className="mt-3 text-xs text-rose-300">{mutation.error.message}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={mutation.isPending || !serviceKey} className="rounded-lg bg-[#8b75ff] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#9b88ff] disabled:cursor-not-allowed disabled:opacity-50">
          {mutation.isPending ? "Saving…" : "Save manual cost"}
        </button>
        <p className="text-[11px] text-slate-500">The backend records the administrator and audit timestamp.</p>
      </div>
    </form>
  );
}

export default function ProductionCostsPage() {
  const [selection, setSelection] = useState<DateRangeSelection>(defaultSelection);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const query = useMemo(() => queryForRange(selection), [selection.from, selection.to]);
  const costs = useAdminResource("productionCosts", query);
  const summaries = useMemo(
    () => costs.data ? summarizeProductionCosts(costs.data.services) : [],
    [costs.data],
  );

  if (costs.isLoading) {
    return (
      <div className="space-y-6">
        <div><SectionEyebrow>Money / Cost control</SectionEyebrow><h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Production costs</h1></div>
        <DateRangePicker {...selection} onChange={setSelection} showBucket={false} />
        <ResourceState state="loading" message="Loading service usage and production costs." />
      </div>
    );
  }

  if (costs.isError) {
    if (unavailable(costs.error)) {
      return (
        <div className="space-y-6">
          <div>
            <SectionEyebrow>Money / Cost control</SectionEyebrow>
            <h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Production costs</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Service-by-service usage, provider charges, AI and image-generation estimates, and manual production-cost records.
            </p>
          </div>
          <DateRangePicker {...selection} onChange={setSelection} showBucket={false} />
          <UnavailablePanel
            title="Production-cost endpoint not deployed"
            detail="The dashboard is ready for GET /admin/production-costs, but the BROKA API does not expose the service-cost ledger yet. No sample figures are shown as live usage."
          />
          <section className="rounded-xl border border-white/10 bg-[#0c1020] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Expected cost coverage</p>
                <h2 className="mt-1 font-display text-lg font-bold text-white">Service inventory</h2>
              </div>
              <StatusBadge tone="warning">Awaiting backend instrumentation</StatusBadge>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {SERVICE_CATALOG.map(({ label, detail, icon: Icon }) => (
                <div key={label} className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-slate-300"><Icon size={16} aria-hidden="true" /></div>
                  <div><p className="text-sm font-semibold text-slate-200">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div><SectionEyebrow>Money / Cost control</SectionEyebrow><h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Production costs</h1></div>
        <DateRangePicker {...selection} onChange={setSelection} showBucket={false} />
        <ResourceState
          state="error"
          message={costs.error instanceof Error ? costs.error.message : "Unable to load production-cost data."}
          action={<button type="button" onClick={() => costs.refetch()} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-[#8b75ff]/40">Retry</button>}
        />
      </div>
    );
  }

  if (!costs.data) {
    return <ResourceState state="empty" message="No production-cost response was returned for this period." />;
  }

  const priced = costs.data.services.filter((service) => service.selected_cost_minor !== null).length;
  const unpriced = costs.data.services.length - priced;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionEyebrow>Money / Cost control</SectionEyebrow>
          <h1 className="font-display text-3xl font-bold tracking-[-0.05em] text-white">Production costs</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            Understand the real cost of running BROKA across messaging, AI, media generation, email, hosting and infrastructure.
          </p>
          <p className="mt-2 text-[11px] text-slate-500">Generated {new Date(costs.data.generated_at).toLocaleString("en-KE")}</p>
        </div>
        <button
          type="button"
          disabled={!costs.data.capabilities.manual_entries || costs.data.services.length === 0}
          onClick={() => setManualEntryOpen((open) => !open)}
          title={costs.data.capabilities.manual_entries ? "Add an audited manual cost entry" : "Manual cost entry is not enabled by the backend"}
          className="rounded-lg border border-[#8b75ff]/45 bg-[#8b75ff]/15 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#8b75ff]/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {manualEntryOpen ? "Close manual entry" : "＋ Add manual cost"}
        </button>
      </div>

      <DateRangePicker {...selection} onChange={setSelection} showBucket={false} />

      {manualEntryOpen && costs.data.capabilities.manual_entries ? (
        <ManualEntryForm services={costs.data.services} onClose={() => setManualEntryOpen(false)} />
      ) : null}

      <section aria-label="Production cost summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Selected production cost"
          value={byCurrencyLabel(summaries, "selectedMinor")}
          detail={priced + " priced service(s); " + unpriced + " service(s) have no selected cost. Currency totals are kept separate."}
        />
        <SummaryCard
          label="Provider-reported"
          value={byCurrencyLabel(summaries, "providerReportedMinor")}
          detail="Provider-reported amounts from available invoices and billing records; shown separately from the selected total."
        />
        <SummaryCard
          label="Usage estimates"
          value={byCurrencyLabel(summaries, "estimatedMinor") === "No value reported" && byCurrencyLabel(summaries, "estimatedMaxMinor") === "No value reported"
            ? "No estimate reported"
            : byCurrencyLabel(summaries, "estimatedMinor") + " · max " + byCurrencyLabel(summaries, "estimatedMaxMinor")}
          detail="Usage-based estimates and maximum estimates are shown separately from the selected total."
        />
        <SummaryCard
          label="Manual entries"
          value={byCurrencyLabel(summaries, "manualMinor")}
          detail="All recorded manual costs, including entries where another source remains the selected basis."
        />
      </section>

      {costs.data.notes.length > 0 ? (
        <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
          <p className="text-xs font-semibold text-cyan-100">Cost reporting notes</p>
          <ul className="mt-2 space-y-1">
            {costs.data.notes.map((note) => <li key={note} className="text-xs leading-5 text-slate-300">{note}</li>)}
          </ul>
        </div>
      ) : null}

      <section className="space-y-3" aria-labelledby="service-costs-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Cost breakdown</p>
            <h2 id="service-costs-heading" className="mt-1 font-display text-xl font-bold text-white">Usage and cost by service</h2>
          </div>
          <p className="text-xs text-slate-500">Minor-unit amounts are formatted in each service's own currency.</p>
        </div>
        <ServiceCostTable services={costs.data.services} />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#0c1020] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Audit trail</p>
            <h2 className="mt-1 font-display text-lg font-bold text-white">Manual cost entries</h2>
          </div>
          <StatusBadge tone="neutral">{costs.data.manual_entries.length} record(s)</StatusBadge>
        </div>
        {costs.data.manual_entries.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No manual cost entries were recorded in this period.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="pb-2">Date</th><th className="pb-2">Service</th><th className="pb-2">Description</th><th className="pb-2">Recorded by</th><th className="pb-2 text-right">Amount</th></tr></thead>
              <tbody>
                {costs.data.manual_entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-white/[0.06]">
                    <td className="py-3 text-slate-400">{entry.occurred_on}</td>
                    <td className="py-3 font-medium text-slate-200">{entry.service_label}</td>
                    <td className="py-3 text-slate-400">{entry.description}{entry.reference ? <span className="block text-[11px] text-slate-600">Ref: {entry.reference}</span> : null}</td>
                    <td className="py-3 text-slate-400">{entry.created_by_label}</td>
                    <td className="py-3 text-right font-semibold tabular-nums text-white">{formatMinorCurrency(entry.amount_minor, entry.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[11px] leading-5 text-slate-600">
        Marketplace GMV and buyer/seller escrow principal are not production revenue or BROKA operating costs. Provider invoices, estimated usage, and manual entries are kept separately; values in different currencies are never combined without a recorded conversion rate.
      </p>
    </div>
  );
}
