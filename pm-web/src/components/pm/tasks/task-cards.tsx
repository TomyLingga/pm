import Link from "next/link";
import { CalendarClock, MapPin, Repeat, UserRound } from "lucide-react";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PmTaskListItem } from "@/types/pm";
import { FindingsChip, LateChip, PmStatusBadge, SkipProposalChip } from "../pm-badges";

const OPEN_STATUSES = new Set(["due", "overdue", "in_progress"]);

/** Mobile-first task cards (below md). */
export function TaskCards({ items }: { items: PmTaskListItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((task) => {
        const open = OPEN_STATUSES.has(task.status);
        const overdue = task.status === "overdue";
        return (
          <li key={task.id}>
            <Link
              href={`/pm/tasks/${task.id}`}
              className={cn(
                "block rounded-xl border bg-card p-4 shadow-sm shadow-edge transition-[background-color,border-color,box-shadow] duration-150 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-surface-2",
                overdue && "border-danger/40 bg-danger-soft/30 hover:bg-danger-soft/50 active:bg-danger-soft/60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-primary">{task.number}</span>
                <PmStatusBadge status={task.status} label={task.status_label} />
              </div>

              <p className="mt-2 text-sm font-semibold leading-snug">
                {task.equipment.code ? (
                  <span className="font-mono text-muted-foreground">{task.equipment.code} &middot; </span>
                ) : null}
                {task.equipment.name}
              </p>

              <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {task.equipment.location_name ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{task.equipment.location_name}</span>
                  </div>
                ) : null}
                {task.schedule ? (
                  <div className="flex items-center gap-2">
                    <Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">
                      {task.schedule.name} &middot; {task.schedule.frequency_label}
                    </span>
                  </div>
                ) : null}
                <div
                  className={cn(
                    "flex items-center gap-2",
                    overdue && "font-semibold text-danger-foreground",
                    task.status === "due" && "font-semibold text-warning-foreground",
                  )}
                >
                  <CalendarClock
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      overdue && "text-danger",
                      task.status === "due" && "text-warning",
                    )}
                    aria-hidden
                  />
                  <span className="tabular">
                    {formatDateTime(task.due_at)}
                    {open ? ` (${formatRelative(task.due_at)})` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">{task.pic?.name ?? "Belum ada PIC"}</span>
                </div>
              </div>

              {task.is_late || task.has_skip_proposal || task.findings_count > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {task.is_late ? <LateChip /> : null}
                  {task.has_skip_proposal ? <SkipProposalChip /> : null}
                  <FindingsChip count={task.findings_count} />
                </div>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
