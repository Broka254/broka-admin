import { describe, expect, it } from "vitest";

import {
  ProductionCostManualEntryInSchema,
  ProductionCostServiceSchema,
  ProductionCostsResponseSchema,
} from "@/lib/api/schemas";
import {
  currencyMinorUnitDigits,
  formatMinorCurrency,
  summarizeProductionCosts,
  toMinorUnits,
} from "@/lib/production-costs";

const service = {
  key: "sms",
  label: "SMS delivery",
  category: "messaging",
  usage_count: 100,
  usage_unit: "segments",
  request_count: 82,
  currency: "KES",
  provider_reported_minor: 2900,
  usage_estimate_minor: 3100,
  estimated_max_minor: 3500,
  manual_minor: null,
  selected_cost_minor: 2900,
  selected_cost_basis: "provider_reported" as const,
  source_label: "Provider invoice",
  last_synced_at: "2026-11-05T10:00:00Z",
  notes: [],
};

const response = {
  generated_at: "2026-11-05T10:00:00Z",
  from: "2026-10-01",
  to: "2026-11-01",
  services: [service],
  manual_entries: [],
  capabilities: { manual_entries: true, provider_sync: false },
  notes: [],
};

describe("Production cost contracts", () => {
  it("parses a valid service ledger response", () => {
    const parsed = ProductionCostsResponseSchema.parse(response);
    expect(parsed.services[0].usage_count).toBe(100);
    expect(parsed.services[0].estimated_max_minor).toBe(3500);
  });

  it("rejects a selected cost without an available basis", () => {
    expect(() => ProductionCostServiceSchema.parse({
      ...service,
      selected_cost_basis: "unavailable",
      selected_cost_minor: 2900,
    })).toThrow();
  });

  it("rejects an estimate maximum below the estimate", () => {
    expect(() => ProductionCostServiceSchema.parse({
      ...service,
      selected_cost_minor: 3100,
      selected_cost_basis: "usage_estimate",
      estimated_max_minor: 3000,
    })).toThrow();
  });

  it("rejects non-ISO currency codes and negative amounts", () => {
    expect(() => ProductionCostServiceSchema.parse({ ...service, currency: "kes" })).toThrow();
    expect(() => ProductionCostServiceSchema.parse({ ...service, selected_cost_minor: -1 })).toThrow();
  });

  it("requires a positive manual amount and an explanatory description", () => {
    const valid = {
      service_key: "sms",
      amount_minor: 2900,
      currency: "KES",
      occurred_on: "2026-11-04",
      description: "Mobitech monthly invoice",
      reference: "INV-123",
    };
    expect(ProductionCostManualEntryInSchema.parse(valid).amount_minor).toBe(2900);
    expect(() => ProductionCostManualEntryInSchema.parse({ ...valid, amount_minor: 0 })).toThrow();
    expect(() => ProductionCostManualEntryInSchema.parse({ ...valid, description: "x" })).toThrow();
    expect(() => ProductionCostManualEntryInSchema.parse({ ...valid, extra: true })).toThrow();
  });
});

describe("currency minor units", () => {
  it("formats and converts currencies using their ISO minor-unit precision", () => {
    expect(currencyMinorUnitDigits("KES")).toBe(2);
    expect(currencyMinorUnitDigits("USD")).toBe(2);
    expect(currencyMinorUnitDigits("JPY")).toBe(0);
    expect(currencyMinorUnitDigits("KWD")).toBe(3);

    expect(toMinorUnits(12.34, "KES")).toBe(1234);
    expect(toMinorUnits(120, "JPY")).toBe(120);
    expect(toMinorUnits(1.234, "KWD")).toBe(1234);
    expect(formatMinorCurrency(120, "JPY")).toContain("120");
    expect(formatMinorCurrency(1234, "KWD")).toContain("1.234");
  });
});

describe("summarizeProductionCosts", () => {
  it("counts only the selected basis so an invoice and estimate are not double-counted", () => {
    const result = summarizeProductionCosts([
      service,
      {
        ...service,
        key: "ai",
        label: "AI requests",
        usage_count: null,
        usage_unit: null,
        request_count: 50,
        provider_reported_minor: 400,
        usage_estimate_minor: 700,
        estimated_max_minor: 900,
        manual_minor: null,
        selected_cost_minor: 700,
        selected_cost_basis: "usage_estimate",
        currency: "KES",
      },
      {
        ...service,
        key: "hosting",
        label: "Hosting",
        provider_reported_minor: 500,
        usage_estimate_minor: null,
        estimated_max_minor: null,
        manual_minor: 1200,
        selected_cost_minor: 1200,
        selected_cost_basis: "manual_entry",
        currency: "KES",
      },
    ]);
    expect(result).toEqual([{
      currency: "KES",
      selectedMinor: 4800,
      providerReportedMinor: 3800,
      estimatedMinor: 3800,
      estimatedMaxMinor: 4400,
      manualMinor: 1200,
      pricedServices: 3,
      unpricedServices: 0,
      providerReportedServices: 3,
      estimatedServices: 2,
      estimatedMaxServices: 2,
      manualServices: 1,
    }]);
  });



  it("keeps a known zero-cost service priced rather than treating it as missing", () => {
    const result = summarizeProductionCosts([{
      ...service,
      provider_reported_minor: 0,
      usage_estimate_minor: null,
      estimated_max_minor: null,
      manual_minor: null,
      selected_cost_minor: 0,
      selected_cost_basis: "provider_reported",
    }]);
    expect(result[0].selectedMinor).toBe(0);
    expect(result[0].pricedServices).toBe(1);
    expect(result[0].unpricedServices).toBe(0);
    expect(result[0].providerReportedServices).toBe(1);
  });

  it("keeps currencies separate and counts unpriced services without treating them as zero cost", () => {
    const result = summarizeProductionCosts([
      service,
      {
        ...service,
        key: "ai-usd",
        currency: "USD",
        provider_reported_minor: null,
        usage_estimate_minor: null,
        estimated_max_minor: null,
        manual_minor: null,
        selected_cost_minor: null,
        selected_cost_basis: "unavailable",
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result.find((item) => item.currency === "KES")?.selectedMinor).toBe(2900);
    expect(result.find((item) => item.currency === "USD")?.unpricedServices).toBe(1);
    expect(result.find((item) => item.currency === "USD")?.selectedMinor).toBe(0);
  });
});
