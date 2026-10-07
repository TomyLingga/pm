import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Document status → semantic tone. Same mapping as the dashboard charts (lib/chart-colors.ts):
 * neutral = waiting/draft, info = received/waiting superior, warning = in progress,
 * primary = done by executor, success = closed/approved, danger = rejected/cancelled, dashed = converted.
 */
export const STATUS_TONES: Record<string, BadgeTone> = {
  // Work Order
  submitted: "neutral",
  received: "info",
  in_progress: "warning",
  completed: "primary",
  closed: "success-solid",
  cancelled: "danger",
  converted: "dashed",
  // Form Request
  draft: "neutral",
  waiting_superior: "info",
  waiting_executor: "info-solid",
  rejected: "danger-solid",
};

const PRIORITY_TONES: Record<string, { tone: BadgeTone; dot: string }> = {
  high: { tone: "danger", dot: "bg-danger" },
  medium: { tone: "warning", dot: "bg-warning" },
  low: { tone: "neutral", dot: "bg-muted-foreground/60" },
};

/** Approval step status (PENGESAHAN block). */
const STEP_TONES: Record<string, BadgeTone> = {
  waiting: "neutral",
  pending: "warning",
  approved: "success",
  completed: "success",
  rejected: "danger",
  revision_requested: "warning",
  skipped: "dashed",
  cancelled: "neutral",
};

const statusPill = "px-2.5 text-[11px] font-bold uppercase tracking-wide";

/** API labels use underscores to match the paper forms (JATUH_TEMPO); the screen shows spaces. */
export const humanizeLabel = (label: string) => label.replace(/_/g, " ");

export function StatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <Badge variant={STATUS_TONES[status] ?? "neutral"} className={cn(statusPill, className)}>
      {humanizeLabel(label)}
    </Badge>
  );
}

export function PriorityBadge({ priority, label, className }: { priority: string; label: string; className?: string }) {
  const style = PRIORITY_TONES[priority] ?? PRIORITY_TONES.low;
  return (
    <Badge variant={style.tone} className={cn("gap-1.5", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden />
      {label}
    </Badge>
  );
}

export function StepStatusChip({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <Badge variant={STEP_TONES[status] ?? "neutral"} className={cn("rounded-md px-1.5 text-[11px]", className)}>
      {humanizeLabel(label)}
    </Badge>
  );
}

/** "Lewat 24 jam" marker for overdue approvals. */
export function OverdueBadge({ className }: { className?: string }) {
  return (
    <Badge variant="danger-solid" className={cn("px-2 text-[11px] font-bold", className)}>
      Lewat 24 jam
    </Badge>
  );
}
