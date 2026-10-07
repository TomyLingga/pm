import { AlertCircle, Check, CircleDashed, Loader2 } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SaveState } from "./use-item-autosave";

interface SaveIndicatorProps {
  state: SaveState;
  error: string | null;
  savedAt: Date | null;
  onRetry: () => void;
  className?: string;
}

/** "Tersimpan" / "Menyimpan…" status of the checklist auto-save. */
export function SaveIndicator({ state, error, savedAt, onRetry, className }: SaveIndicatorProps) {
  const base = cn("inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs", className);

  if (state === "saving") {
    return (
      <span className={cn(base, "text-muted-foreground")} role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Menyimpan&hellip;
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className={cn(base, "font-medium text-danger-foreground")} role="alert" title={error ?? undefined}>
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-danger" aria-hidden />
        <span className="min-w-0 truncate">Gagal menyimpan{error ? `: ${error}` : ""}</span>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-sm px-1 py-0.5 underline underline-offset-2 transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Coba lagi
        </button>
      </span>
    );
  }
  if (state === "pending") {
    return (
      <span className={cn(base, "text-warning-foreground")} role="status">
        <CircleDashed className="h-3.5 w-3.5 text-warning" aria-hidden />
        Belum tersimpan&hellip;
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className={cn(base, "text-success-foreground")} role="status">
        <Check className="h-3.5 w-3.5 text-success" aria-hidden />
        <span className="tabular">Tersimpan{savedAt ? ` ${formatInTimeZone(savedAt, APP_TIME_ZONE, "HH:mm")}` : ""}</span>
      </span>
    );
  }
  return <span className={cn(base, "text-muted-foreground")}>Jawaban tersimpan otomatis</span>;
}
