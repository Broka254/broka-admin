import { describe, expect, it } from "vitest";

import {
  ProductionCostEntryInSchema,
  ProductionCostServiceSchema,
  ProductionCostsResponseSchema,
  ProductionCostEntriesResponseSchema,
  ProductionCostSummarySchema,
  ProductionCostUsageResponseSchema,
  ProductionCostPricingResponseSchema,
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
    const invalid = { ...service, cost_status: undefined };
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
    expect(() => ProductionCostEntryInSchema.parse({ ...valid, currency: "KE" })).toThrow();
    expect(() => ProductionCostEntryInSchema.parse({ ...valid, extra: true })).toThrow();
  });

  it("accepts MULTI as a backend mixed-currency sentinel", () => {
    const parsed = ProductionCostServiceSchema.parse({
      ...service, currency: "MULTI", effective_currency: null,
      actual_cost_minor: null, estimated_cost_minor: null,
      manually_entered_cost_minor: null, adjusted_cost_minor: null,
      effective_cost_minor: null, cost_source: "none",
      cost_status: "mixed_currency", has_cost_information: false,
    });
    expect(parsed.currency).toBe("MULTI");
  });

  it("validates summary, raw usage and pricing responses from the current API", () => {
    const summary = ProductionCostSummarySchema.parse({
      reporting_period: period, generated_at: "2026-12-01T00:00:00+00:00",
      currency: "KES", currencies: ["KES"], totals_by_currency: response.totals_by_currency,
      by_category: [{ category: "messaging", currency: "KES", effective_cost_minor: 2900, services: 1 }],
      by_cost_source: [{ cost_source: "invoice", currency: "KES", effective_cost_minor: 2900, services: 1 }],
      usage: { requests_total: 82, requests_success: 80, requests_failed: 2, input_tokens: 0, output_tokens: 0, images: 0, sms_segments: 100, emails: 0 },
      services_total: 1, services_with_cost: 1, unpriced_services: [], notes: [],
    });
    expect(summary.usage.sms_segments).toBe(100);

    const usage = ProductionCostUsageResponseSchema.parse({
      reporting_period: period,
      events: [{
        id: 1, service_key: "sms.texin", service_name: "Texin SMS", provider: "Texin",
        operation_type: "sms.send", status: "success", provider_reference: null, operation_id: "evt-1",
        quantity: 1, usage_unit: "sms_segment", input_tokens: null, output_tokens: null,
        unit_price_minor: 29, estimated_cost_minor: 29, currency: "KES",
        cost_basis: "pricing", confidence: "exact", occurred_at: period.start,
        reporting_period_start: period.start, metadata: {},
      }],
      limit: 200, offset: 0, note: "Raw events are retained for a limited period.",
    });
    expect(usage.events[0].service_key).toBe("sms.texin");

    const pricing = ProductionCostPricingResponseSchema.parse({
      pricing: [{
        id: 1, service_key: "sms.texin", service_name: "Texin SMS",
        pricing_unit: "sms_segment", unit_price_minor: 29, currency: "KES",
        effective_from: period.start, effective_until: null, pricing_source: "Provider tariff",
        confidence: "exact", created_by: "admin-1", created_at: period.start,
      }],
      limit: 500, offset: 0,
    });
    expect(pricing.pricing[0].unit_price_minor).toBe(29);
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
    expect(formatMinorCurrency(100, "MULTI")).toBe("Mixed currencies");
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
