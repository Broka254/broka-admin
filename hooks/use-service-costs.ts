"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminRequestError } from "@/hooks/use-admin-resource";
import { ServiceCostEntryCreateResponseSchema, type ServiceCostEntryCreateInput } from "@/lib/api/service-costs-contract";

async function postEntry(input: ServiceCostEntryCreateInput, key: string) {
  const response=await fetch("/api/broka/admin/revenue/costs/entries",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json","X-Idempotency-Key":key},
    body:JSON.stringify(input),
  });
  const payload=await response.json().catch(()=>({})) as {message?:string;code?:string};
  if(!response.ok)throw new AdminRequestError(payload.message??"Unable to save cost record.",response.status,payload.code);
  return ServiceCostEntryCreateResponseSchema.parse(payload).entry;
}
export function useCreateManualServiceCost() {
  const client=useQueryClient();
  return useMutation({
    mutationFn:({input,idempotencyKey}:{input:ServiceCostEntryCreateInput;idempotencyKey:string})=>postEntry(input,idempotencyKey),
    onSuccess:async()=>{await client.invalidateQueries({queryKey:["broka-admin","serviceCosts"]});},
  });
}
