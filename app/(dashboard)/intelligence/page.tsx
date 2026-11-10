import { Suspense } from "react";

import { IntelligenceView } from "@/components/intelligence/intelligence-view";

export default function IntelligencePage() {
  return <Suspense fallback={null}><IntelligenceView /></Suspense>;
}
