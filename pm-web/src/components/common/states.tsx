import * as React from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function LoadingState({ label = "Memuat data…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-16", className)} aria-live="polite">
      <Spinner label={label} />
    </div>
  );
}

export function ErrorState({
  title = "Gagal memuat data",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-danger/40 bg-danger-soft/50 px-4 py-10 text-center",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        {message ? <p className="mt-1 text-sm text-muted-foreground">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-grid relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed px-4 py-12 text-center",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,hsl(var(--background))_85%)]"
        aria-hidden
      />
      <div className="relative flex flex-col items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border bg-card text-muted-foreground shadow-sm shadow-edge">
          {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
        </span>
        <div>
          <p className="font-semibold">{title}</p>
          {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}
