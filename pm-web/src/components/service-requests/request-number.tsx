import { cn } from "@/lib/utils";

/** Request number, or a "DRAFT" chip while it has never been submitted. */
export function RequestNumber({ number, className }: { number: string | null; className?: string }) {
  if (!number) {
    return (
      <span
        className={cn(
          "inline-flex rounded border border-dashed border-slate-400 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-600",
          className,
        )}
      >
        DRAFT
      </span>
    );
  }
  return <span className={cn("font-mono text-xs font-semibold", className)}>{number}</span>;
}
