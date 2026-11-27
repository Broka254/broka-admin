import { DomainPage } from "@/components/jarvis/views/domain-page";

export default function OperationsIntelligencePage() {
  return (
    <DomainPage
      eyebrow="Jarvis Mode · Operations Intelligence"
      title="Operations Intelligence"
      description="Service availability, latency and the background work behind them, with the anomalies BROKA judged against each figure's own history."
      domains={["operations"]}
    />
  );
}
