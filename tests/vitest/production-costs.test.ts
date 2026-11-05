import { describe, expect, it } from "vitest";

import {
  ProductionCostEntryInSchema,
  ProductionCostServiceSchema,
  ProductionCostsResponseSchema,
  ProductionCostEntriesResponseSchema,
} from "@/lib/api/schemas";
import {
  currencyMinorUnitDigits,
  formatMinorCurrency,
  summarizeProductionCosts,
  toMinorUnits,
} from "@/lib/production-costs";

const period = { start: "2026-11-01T00:00:00+00:00", end: "2026-12-01T00:00:00+00:00" };
const service = {
  service_key: "sms.texin",
  service_name: "Texin SMS",
  provider: "Texin",
  category: "messaging",
  usage_unit: "sms_segment",
  pricing_model: "per_unit",
  billable: true,
  active: true,
  currency: "KES",
  default_confidence: "exact",
  maximum_estimated_cost_minor: 3500,
  notes: null,
  reporting_period: period,
  requests_total: 82,
  requests_success: 80,
  requests_failed: 2,
  requests_accepted: 80,
  usage_quantity: 100,
  successful_quantity: 100,
  failed_quantity: 0,
  accepted_quantity: 100,
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  actual_cost_minor: 2900,
  estimated_cost_minor: 3100,
  entry_estimated_cost_minor: null,
  usage_estimated_cost_minor: 3100,
  manually_entered_cost_minor: null,
  adjusted_cost_minor: null,
  effective_cost_minor: 2900,
  effective_currency: "KES",
  cost_source: "invoice",
  confidence: "exact",
  cost_status: "priced",
  unpriced_events: 0,
  priced_events: 80,
  has_usage: true,
  has_cost_information: true,
};
const response = {
  currency: "KES",
  currencies: ["KES"],
  reporting_period: period,
  generated_at: "2026-12-01T00:00:00+00:00",
  totals_by_currency: [{
    currency: "KES",
    effective_cost_minor: 2900,
    actual_cost_minor: 2900,
    estimated_cost_minor: 3100,
    manually_entered_cost_minor: 0,
    adjusted_cost_minor: 0,
    maximum_estimated_cost_minor: 3500,
    services_with_cost: 1,
    unpriced_services: 0,
  }],
  services: [service],
};

describe("Verified production-cost API contracts", () => {
  it("parses the backend /services response shape", () => {
    const parsed = ProductionCostsResponseSchema.parse(response);
    expect(parsed.services[0].service_key).toBe("sms.texin");
    expect(parsed.services[0].requests_failed).toBe(2);
    expect(parsed.totals_by_currency[0].effective_cost_minor).toBe(2900);
  });

  it("rejects a service missing backend-required usage and cost fields", () => {
    const { cost_status: _costStatus, ...invalid } = service;
    expect(() => ProductionCostServiceSchema.parse(invalid)).toThrow();
  });

  it("accepts backend cost-entry payload and rejects an empty or reversed period", () => {
    const valid = {
      service_key: "sms.texin",
      period_start: period.start,
      period_end: period.end,
      currency: "KES",
      manually_entered_cost_minor: 2900,
      notes: "Texin monthly invoice",
      invoice_reference: "INV-123",
    };
    expect(ProductionCostEntryInSchema.parse(valid).manually_entered_cost_minor).toBe(2900);
    expect(() => ProductionCostEntryInSchema.parse({ ...valid, manually_entered_cost_minor: undefined })).toThrow();
    expect(() => ProductionCostEntryInSchema.parse({ ...valid, period_end: period.start })).toThrow();
    expect(() => ProductionCostEntryInSchema.parse({ ...valid, currency: "kes" })).toThrow();
    expect(() => ProductionCostEntryInSchema.parse({ ...valid, extra: true })).toThrow();
  });

  it("parses the backend /entries list response", () => {
    const entry = {
      id: 12, service_key: "sms.texin", service_name: "Texin SMS",
      period_start: period.start, period_end: period.end,
      actual_cost_minor: null, estimated_cost_minor: null,
      manually_entered_cost_minor: 2900, currency: "KES",
      cost_source: "manual", confidence: "manual", notes: "Invoice",
      invoice_reference: "INV-123", entered_by: "admin-1",
      created_at: period.start, updated_at: period.start,
    };
    expect(ProductionCostEntriesResponseSchema.parse({
      reporting_period: period, entries: [entry], limit: 200, offset: 0,
    }).entries[0].id).toBe(12);
  });
});

describe("currency and totals helpers", () => {
  it("uses ISO currency minor-unit precision", () => {
    expect(currencyMinorUnitDigits("KES")).toBe(2);
    expect(currencyMinorUnitDigits("JPY")).toBe(0);
    expect(currencyMinorUnitDigits("KWD")).toBe(3);
    expect(toMinorUnits(12.34, "KES")).toBe(1234);
    expect(toMinorUnits(120, "JPY")).toBe(120);
    expect(formatMinorCurrency(1234, "KWD")).toContain("1.234");
  });

  it("counts effective costs once and keeps currencies separate", () => {
    const rows = summarizeProductionCosts([
      service,
      { ...service, service_key: "infra.vercel", currency: "USD", effective_currency: "USD",
        actual_cost_minor: null, estimated_cost_minor: 8000, manually_entered_cost_minor: null,
        adjusted_cost_minor: null, effective_cost_minor: 8000, cost_source: "usage_estimate" },
      { ...service, service_key: "push.fcm", actual_cost_minor: null, estimated_cost_minor: null,
        manually_entered_cost_minor: null, adjusted_cost_minor: null, effective_cost_minor: null,
        effective_currency: null, currency: "KES", cost_source: "none", has_cost_information: false,
        cost_status: "unpriced" },
    ]);
    expect(rows.find((row) => row.currency === "KES")?.selectedMinor).toBe(2900);
    expect(rows.find((row) => row.currency === "KES")?.unpricedServices).toBe(1);
    expect(rows.find((row) => row.currency === "USD")?.selectedMinor).toBe(8000);
    expect(rows).toHaveLength(2);
  });
});
