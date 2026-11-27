import { DomainPage } from "@/components/jarvis/views/domain-page";

export default function MarketplaceIntelligencePage() {
  return (
    <DomainPage
      eyebrow="Jarvis Mode · Marketplace Intelligence"
      title="Marketplace Intelligence"
      description="Listings, the views and conversations they earn, the deals they become, and who is selling and buying."
      domains={["marketplace", "users"]}
    />
  );
}
