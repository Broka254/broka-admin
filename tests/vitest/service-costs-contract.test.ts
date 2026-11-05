import { describe, expect, it } from "vitest";
import { ServiceCostEntryCreateInSchema, ServiceCostsDashboardSchema } from "@/lib/api/service-costs-contract";

const fixture={
  generated_at:"2026-11-05T09:00:00Z",period:{from:"2026-10-06",to:"2026-11-06"},
  currencies:[{code:"KES",minor_unit_exponent:2}],
  summary_by_currency:[{currency:"KES",actual_minor:12000,estimated_minor:3500,manual_minor:500,maximum_estimate_minor:6000}],
  services:[{key:"sms_gateway",name:"SMS gateway",category:"communications",provider:"Provider",status:"active",
    usage:{quantity:100,unit:"SMS segments",success_count:96,failed_count:4,source:"instrumented"},
    cost:{amount_minor:16000,currency:"KES",source:"mixed",confidence:"medium",maximum_estimate_minor:18000,note:null},
    last_activity_at:"2026-11-05T08:50:00Z"}],
  entries:[{id:"entry-1",service_key:"sms_gateway",service_name:"SMS gateway",description:"Provider invoice",
    period_start:"2026-10-01",period_end:"2026-11-01",amount_minor:500,currency:"KES",source:"manual",
    note:null,recorded_by:"admin",created_at:"2026-11-05T08:00:00Z"}],
};
describe("service-cost contracts",()=>{
  it("accepts separate cost sources and preserves null for unpriced service costs",()=>{
    expect(ServiceCostsDashboardSchema.parse(fixture)).toEqual(fixture);
    const unpriced = {
      ...fixture,
      services: [{
        ...fixture.services[0],
        cost: {
          amount_minor: null,
          currency: null,
          source: "unpriced" as const,
          confidence: "unpriced" as const,
          maximum_estimate_minor: null,
          note: "No price configured",
        },
      }],
    };
    expect(ServiceCostsDashboardSchema.parse(unpriced).services[0].cost.amount_minor).toBeNull();
  });
  it("rejects negative usage, negative money, and malformed currency",()=>{
    const a=structuredClone(fixture);a.services[0].cost.amount_minor=-1;
    const b=structuredClone(fixture);b.services[0].usage.failed_count=-1;
    const c=structuredClone(fixture);c.currencies[0].code="KES1";
    expect(ServiceCostsDashboardSchema.safeParse(a).success).toBe(false);
    expect(ServiceCostsDashboardSchema.safeParse(b).success).toBe(false);
    expect(ServiceCostsDashboardSchema.safeParse(c).success).toBe(false);
  });
  it("requires positive manual cost and a valid half-open billing period",()=>{
    const valid={service_key:"sms_gateway",description:"Provider bill",period_start:"2026-10-01",period_end:"2026-11-01",amount_minor:100,currency:"KES",note:null};
    expect(ServiceCostEntryCreateInSchema.parse(valid)).toEqual(valid);
    expect(ServiceCostEntryCreateInSchema.safeParse({...valid,amount_minor:0}).success).toBe(false);
    expect(ServiceCostEntryCreateInSchema.safeParse({...valid,period_end:valid.period_start}).success).toBe(false);
  });
});
