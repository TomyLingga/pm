import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-muted-foreground">
      <Loader2 className={cn("h-5 w-5 animate-spin", className)} aria-hidden />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Memuat</span>}
    </span>
  );
}
