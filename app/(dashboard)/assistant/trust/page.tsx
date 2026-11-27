import { DomainPage } from "@/components/jarvis/views/domain-page";

export default function TrustAndSafetyPage() {
  return (
    <DomainPage
      eyebrow="Jarvis Mode · Trust & Safety"
      title="Trust & Safety"
      description="Flagged and suspended accounts, open disputes, fraud events and the complaints queue."
      domains={["trust"]}
    />
  );
}
