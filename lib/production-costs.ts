import type { ProductionCostService } from "@/lib/api/schemas";

export type CurrencyCostSummary = {
  currency: string;
  selectedMinor: number;
  providerReportedMinor: number;
  estimatedMinor: number;
  estimatedMaxMinor: number;
  manualMinor: number;
  pricedServices: number;
  unpricedServices: number;
  providerReportedServices: number;
  estimatedServices: number;
  estimatedMaxServices: number;
  manualServices: number;
};

/**
 * Keeps the selected amount separate from each available source amount.
 * Selected totals count one basis per service; source totals are shown as
 * independent comparisons and must never be added to the selected total.
 */
export function summarizeProductionCosts(services: ProductionCostService[]): CurrencyCostSummary[] {
  const grouped = new Map<string, CurrencyCostSummary>();

  for (const service of services) {
    const current = grouped.get(service.currency) ?? {
      currency: service.currency,
      selectedMinor: 0,
      providerReportedMinor: 0,
      estimatedMinor: 0,
      estimatedMaxMinor: 0,
      manualMinor: 0,
      pricedServices: 0,
      unpricedServices: 0,
      providerReportedServices: 0,
      estimatedServices: 0,
      estimatedMaxServices: 0,
      manualServices: 0,
    };

    if (service.selected_cost_minor === null) {
      current.unpricedServices += 1;
    } else {
      current.selectedMinor += service.selected_cost_minor;
      current.pricedServices += 1;
    }

    // These are the raw source values, even when that source is not the
    // selected basis. A provider invoice must remain visible when a manual
    // override is selected, and vice versa.
    if (service.provider_reported_minor !== null) {
      current.providerReportedMinor += service.provider_reported_minor;
      current.providerReportedServices += 1;
    }
    if (service.usage_estimate_minor !== null) {
      current.estimatedMinor += service.usage_estimate_minor;
      current.estimatedServices += 1;
    }
    if (service.estimated_max_minor !== null) {
      current.estimatedMaxMinor += service.estimated_max_minor;
      current.estimatedMaxServices += 1;
    }
    if (service.manual_minor !== null) {
      current.manualMinor += service.manual_minor;
      current.manualServices += 1;
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
    }).resolvedOptions().maximumFractionDigits ?? 2;
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
