import { Suspense } from "react";

import { ReportsCenter } from "@/components/reports/reports-center";

export default function ReportsPage() {
  return <Suspense fallback={null}><ReportsCenter /></Suspense>;
}
