import { DomainPage } from "@/components/jarvis/views/domain-page";

export default function BusinessIntelligencePage() {
  return (
    <DomainPage
      eyebrow="Jarvis Mode · Business Intelligence"
      title="Business Intelligence"
      description="Platform income, recorded payments and refunds, and growth against the founder's targets for this window."
      domains={["finance", "growth"]}
    />
  );
}
