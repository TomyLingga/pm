import { formatRelative } from "@/lib/format";
import type { CurrentStep } from "@/types/service-request";

/** "Atasan YBS - Indra Sakti Lubis (2 jam yang lalu)" */
export function CurrentStepInfo({ step, compact }: { step: CurrentStep | null; compact?: boolean }) {
  if (!step) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <span className="block min-w-0">
      <span className="block text-sm font-medium">{step.label}</span>
      {step.assignee_label ? (
        <span className="block truncate text-xs text-muted-foreground">{step.assignee_label}</span>
      ) : null}
      {step.waiting_since && !compact ? (
        <span className="block text-[11px] text-muted-foreground">sejak {formatRelative(step.waiting_since)}</span>
      ) : null}
    </span>
  );
}
