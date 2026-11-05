import type { ProductionCostService } from "@/lib/api/schemas";

export type CurrencyCostSummary = {
  currency: string;
  selectedMinor: number;
  providerReportedMinor: number;
  estimatedMinor: number;
  manualMinor: number;
  pricedServices: number;
  unpricedServices: number;
};

/**
 * Sums only the one selected cost basis for each service. The source figures
 * remain visible for comparison, but are not added together; this prevents an
 * invoice and its usage estimate from being counted twice.
 */
export function summarizeProductionCosts(services: ProductionCostService[]): CurrencyCostSummary[] {
  const grouped = new Map<string, CurrencyCostSummary>();

  for (const service of services) {
    const current = grouped.get(service.currency) ?? {
      currency: service.currency,
      selectedMinor: 0,
      providerReportedMinor: 0,
      estimatedMinor: 0,
      manualMinor: 0,
      pricedServices: 0,
      unpricedServices: 0,
    };

    if (service.selected_cost_minor === null) {
      current.unpricedServices += 1;
    } else {
      current.selectedMinor += service.selected_cost_minor;
      current.pricedServices += 1;

      if (service.selected_cost_basis === "provider_reported") {
        current.providerReportedMinor += service.selected_cost_minor;
      } else if (service.selected_cost_basis === "usage_estimate") {
        current.estimatedMinor += service.selected_cost_minor;
      } else if (service.selected_cost_basis === "manual_entry") {
        current.manualMinor += service.selected_cost_minor;
      }
    }

    grouped.set(service.currency, current);
  }

  return Array.from(grouped.values()).sort((a, b) => a.currency.localeCompare(b.currency));
}

export function currencyMinorUnitDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * (10 ** currencyMinorUnitDigits(currency)));
}

export function formatMinorCurrency(amountMinor: number | null, currency: string): string {
  if (amountMinor === null) return "Not available";
  const digits = currencyMinorUnitDigits(currency);
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amountMinor / (10 ** digits));
  } catch {
    return currency + " " + (amountMinor / (10 ** digits)).toFixed(digits);
  }
}

export function formatUsage(value: number | null, unit: string | null): string {
  if (value === null) return "Not reported";
  return value.toLocaleString("en-KE") + (unit ? " " + unit : "");
}
