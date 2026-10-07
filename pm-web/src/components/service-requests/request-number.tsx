import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Request number, or a "DRAFT" chip while it has never been submitted. */
export function RequestNumber({ number, className }: { number: string | null; className?: string }) {
  if (!number) {
    return (
      <Badge variant="dashed" className={cn("rounded-md px-1.5 py-0 font-mono text-[11px] font-bold", className)}>
        DRAFT
      </Badge>
    );
  }
  return <span className={cn("tabular font-mono text-xs font-semibold", className)}>{number}</span>;
}
