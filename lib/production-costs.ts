import type { ProductionCostService } from "@/lib/api/schemas";

export type CurrencyCostSummary = {
  currency: string;
  selectedMinor: number;
  actualMinor: number;
  estimatedMinor: number;
  manualMinor: number;
  adjustedMinor: number;
  pricedServices: number;
  unpricedServices: number;
};

export function summarizeProductionCosts(services: ProductionCostService[]): CurrencyCostSummary[] {
  const grouped = new Map<string, CurrencyCostSummary>();
  for (const service of services) {
    const currency = service.effective_currency ?? service.currency;
    const row = grouped.get(currency) ?? {
      currency, selectedMinor: 0, actualMinor: 0, estimatedMinor: 0,
      manualMinor: 0, adjustedMinor: 0, pricedServices: 0, unpricedServices: 0,
    };
    if (service.effective_cost_minor === null) row.unpricedServices += 1;
    else { row.selectedMinor += service.effective_cost_minor; row.pricedServices += 1; }
    row.actualMinor += service.actual_cost_minor ?? 0;
    row.estimatedMinor += service.estimated_cost_minor ?? 0;
    row.manualMinor += service.manually_entered_cost_minor ?? 0;
    row.adjustedMinor += service.adjusted_cost_minor ?? 0;
    grouped.set(currency, row);
  }
  return [...grouped.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}

export function currencyMinorUnitDigits(currency: string): number {
  if (currency === "MULTI") return 2;
  try { return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2; }
  catch { return 2; }
}

export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * (10 ** currencyMinorUnitDigits(currency)));
}

export function formatMinorCurrency(amountMinor: number | null, currency: string): string {
  if (amountMinor === null) return "Not priced";
  if (currency === "MULTI") return "Mixed currencies";
  if (!/^[A-Z]{3}$/.test(currency)) return "Mixed currencies";
  const digits = currencyMinorUnitDigits(currency);
  try {
    return new Intl.NumberFormat("en-KE", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amountMinor / (10 ** digits));
  } catch { return currency + " " + (amountMinor / (10 ** digits)).toFixed(digits); }
}

export function formatUsage(value: number | null, unit: string | null): string {
  if (value === null) return "Not reported";
  return value.toLocaleString("en-KE") + (unit ? " " + unit : "");
}
