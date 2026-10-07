import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** "PETUNJUK DAN ATURAN" text (multi-line, as configured by the executor unit) + contact footer. */
export function RequestRules({
  rules,
  contactFooter,
  className,
}: {
  rules: string | null | undefined;
  contactFooter?: string | null;
  className?: string;
}) {
  if (!rules && !contactFooter) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Tidak ada petunjuk khusus.</p>;
  }
  return (
    <div className={cn("space-y-3", className)}>
      {rules ? <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed">{rules}</p> : null}
      {contactFooter ? (
        <p className="flex items-start gap-2 rounded-md border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="whitespace-pre-wrap">{contactFooter}</span>
        </p>
      ) : null}
    </div>
  );
}
