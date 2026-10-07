"use client";

import Link from "next/link";
import { Wrench } from "lucide-react";
import { humanizeLabel } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { ACTIVITY_STATUS_TONES, weekRangeLabel } from "@/lib/daily-activity-constants";
import { cn } from "@/lib/utils";
import type { DailyActivityWorkOrderLink } from "@/types/daily-activity";

/**
 * Chip styles of the status filter (same tone tokens as the badges). `open` is the neutral tone one step up the
 * surface ladder (`surface-3`, pressed) so a selected chip still differs from an idle one.
 */
export const ACTIVITY_STATUS_STYLES: Record<string, string> = {
  open: "border-border bg-surface-3 text-foreground",
  on_progress: "border-warning/30 bg-warning-soft text-warning-foreground",
  closed: "border-success/25 bg-success-soft text-success-foreground",
};

/** Daily-activity status pill (open = neutral, on_progress = warning, closed = success). */
export function ActivityStatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <Badge variant={ACTIVITY_STATUS_TONES[status] ?? "neutral"} className={cn("px-2.5 text-[11px] font-bold uppercase tracking-wide", className)}>
      {humanizeLabel(label)}
    </Badge>
  );
}

/** "M1" chip for `week_of_month`; the date range is in the tooltip and for screen readers. */
export function WeekChip({ week, className }: { week: number; className?: string }) {
  const range = weekRangeLabel(week);
  return (
    <Badge
      variant="primary"
      className={cn("tabular rounded-md px-1.5 text-[11px] font-bold", className)}
      title={range ? `Minggu ke-${week} (tanggal ${range})` : `Minggu ke-${week}`}
    >
      M{week}
      {range ? <span className="sr-only"> (tanggal {range})</span> : null}
    </Badge>
  );
}

/**
 * "WO <number>" chip linking to the source work order of an automatic report. Clicks never bubble, so it can sit
 * inside a clickable table row. Pass a taller `className` (e.g. `h-10`) on touch layouts.
 */
export function WorkOrderChip({ workOrder, className }: { workOrder: DailyActivityWorkOrderLink; className?: string }) {
  return (
    <Link
      href={`/work-orders/${workOrder.id}`}
      onClick={(event) => event.stopPropagation()}
      title={workOrder.request_description ?? undefined}
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1 whitespace-nowrap rounded-md border border-primary/20 bg-primary-soft px-1.5 text-[11px] font-semibold text-primary-soft-foreground transition-colors duration-150 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Wrench className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{workOrder.wo_number}</span>
      <span className="sr-only">, buka work order</span>
    </Link>
  );
}
