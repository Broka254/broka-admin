import { Suspense } from "react";

import { ReportBuilder } from "@/components/reports/report-builder";

export default function ReportBuilderPage() {
  return <Suspense fallback={null}><ReportBuilder /></Suspense>;
}
