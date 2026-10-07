import { AlertTriangle, Clock, Flag } from "lucide-react";
import { humanizeLabel } from "@/components/common/badges";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { RESULT_LABELS } from "@/lib/pm-constants";
import { cn } from "@/lib/utils";
import type { ItemResult } from "@/types/pm";

/**
 * PM task status → semantic tone: scheduled = neutral, due = warning, in_progress = info,
 * completed = success, overdue = danger, skipped = muted, projected (calendar only) = dashed outline.
 */
export const PM_STATUS_TONES: Record<string, BadgeTone> = {
  scheduled: "neutral",
  due: "warning",
  in_progress: "info",
  completed: "success",
  overdue: "danger",
  skipped: "neutral",
  projected: "dashed",
};

/** Kept for components that style their own chips (calendar cells, legends). */
export const PM_STATUS_STYLES: Record<string, string> = {
  scheduled: "border-border bg-surface-2 text-muted-foreground",
  due: "border-warning/30 bg-warning-soft text-warning-foreground",
  in_progress: "border-info/25 bg-info-soft text-info-foreground",
  completed: "border-success/25 bg-success-soft text-success-foreground",
  overdue: "border-danger/25 bg-danger-soft text-danger-foreground",
  skipped: "border-border bg-surface-3 text-muted-foreground line-through decoration-muted-foreground/50",
  projected: "border-dashed border-muted-foreground/50 bg-transparent text-muted-foreground",
};

/** Solid dot colours for legends and compact markers. */
export const PM_STATUS_DOTS: Record<string, string> = {
  scheduled: "bg-muted-foreground/60",
  due: "bg-warning",
  in_progress: "bg-info",
  completed: "bg-success",
  overdue: "bg-danger",
  skipped: "bg-muted-foreground/40",
  projected: "border border-dashed border-muted-foreground bg-transparent",
};

const EQUIPMENT_STATUS_TONES: Record<string, BadgeTone> = {
  active: "success",
  under_repair: "warning",
  inactive: "neutral",
  disposed: "dashed",
};

const RESULT_STYLES: Record<ItemResult, string> = {
  ok: "bg-success-soft text-success-foreground",
  not_ok: "bg-danger-soft text-danger-foreground",
  na: "bg-surface-2 text-muted-foreground",
};

const statusPill = "px-2.5 text-[11px] font-bold uppercase tracking-wide";
const chip = "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold";

export function PmStatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <Badge variant={PM_STATUS_TONES[status] ?? "neutral"} className={cn(statusPill, status === "skipped" && "line-through", className)}>
      {humanizeLabel(label)}
    </Badge>
  );
}

export function EquipmentStatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  return (
    <Badge variant={EQUIPMENT_STATUS_TONES[status] ?? "neutral"} className={cn(statusPill, className)}>
      {humanizeLabel(label)}
    </Badge>
  );
}

/** "Terlambat" marker for tasks finished (or still open) past the tolerance. */
export function LateChip({ className }: { className?: string }) {
  return (
    <span className={cn(chip, "bg-danger text-danger-on-solid", className)}>
      <Clock className="h-3 w-3" aria-hidden />
      Terlambat
    </span>
  );
}

export function SkipProposalChip({ className }: { className?: string }) {
  return (
    <span className={cn(chip, "bg-warning-soft text-warning-foreground", className)}>
      <Flag className="h-3 w-3" aria-hidden />
      Usulan skip
    </span>
  );
}

export function FindingsChip({ count, className }: { count: number; className?: string }) {
  if (!count || count <= 0) return null;
  return (
    <span className={cn(chip, "bg-danger-soft text-danger-foreground", className)}>
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {count} temuan
    </span>
  );
}

export function ResultChip({
  result,
  label,
  className,
}: {
  result: ItemResult | null;
  label?: string | null;
  className?: string;
}) {
  if (!result) return <span className={cn("text-xs text-muted-foreground", className)}>Belum diisi</span>;
  return (
    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-bold", RESULT_STYLES[result], className)}>
      {label ?? RESULT_LABELS[result]}
    </span>
  );
}

/** AKTIF / NONAKTIF badge for schedules and checklist templates. */
export function ActiveBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <Badge variant={active ? "success" : "neutral"} className={cn(statusPill, className)}>
      {active ? "AKTIF" : "NONAKTIF"}
    </Badge>
  );
}
