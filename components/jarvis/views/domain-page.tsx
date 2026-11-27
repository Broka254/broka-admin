"use client";

import type { ReactNode } from "react";

import { ComplaintsQueue, DomainPanel, OperationsAnomalies, TargetsList } from "@/components/jarvis/domains/domain-panel";
import { FreshnessTag, PageHeading } from "@/components/jarvis/ui/primitives";
import { useAdminResource } from "@/hooks/use-admin-resource";
import { DOMAINS, type CommandCentre, type DomainKey } from "@/lib/jarvis/command-centre";

// Panels that need more than the command centre's figures: the founder's
// targets for growth, the complaints queue for trust, and the anomaly
// judgements for operations.
const EXTRAS: Partial<Record<DomainKey, (centre: CommandCentre | undefined) => ReactNode>> = {
  growth: (centre) => <TargetsList centre={centre} />,
  trust: () => <ComplaintsQueue />,
  operations: () => <OperationsAnomalies />,
};

/** A Jarvis page that hosts one or more domain panels, all sharing one command-centre snapshot. */
export function DomainPage({
  eyebrow,
  title,
  description,
  domains,
}: {
  eyebrow: string;
  title: string;
  description: string;
  domains: readonly DomainKey[];
}) {
  const centre = useAdminResource("commandCenter");
  const state = { pending: centre.isPending, error: centre.error, onRetry: () => void centre.refetch() };

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={eyebrow}
        title={title}
        description={description}
        meta={centre.data ? <FreshnessTag kind="snapshot" label="Snapshot" at={centre.data.generated_at} /> : null}
      />
      {domains.map((key) => (
        <DomainPanel
          key={key}
          domain={DOMAINS[key]}
          centre={centre.data}
          state={state}
          extra={EXTRAS[key]?.(centre.data)}
        />
      ))}
    </div>
  );
}
