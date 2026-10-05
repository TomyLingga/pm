import { LoadError } from "@/components/common/load-error";

export function WorkOrderLoadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return <LoadError error={error} onRetry={onRetry} entity="Work Order" backHref="/work-orders" />;
}
