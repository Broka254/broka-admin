import { Suspense } from "react";

import { ComplaintsDesk } from "@/components/complaints/complaints-desk";

export default function ComplaintsPage() {
  return <Suspense fallback={null}><ComplaintsDesk /></Suspense>;
}
