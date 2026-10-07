"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PmTaskListItem } from "@/types/pm";
import { FindingsChip, LateChip, PmStatusBadge, SkipProposalChip } from "../pm-badges";

/** Desktop table (md and up). */
export function TaskTable({ items }: { items: PmTaskListItem[] }) {
  const router = useRouter();

  return (
    <Table className="min-w-[960px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[112px]">No. Tugas</TableHead>
          <TableHead className="min-w-[200px]">Equipment</TableHead>
          <TableHead className="min-w-[160px]">Jadwal</TableHead>
          <TableHead className="w-[140px]">Jatuh tempo</TableHead>
          <TableHead className="w-[150px]">PIC</TableHead>
          <TableHead className="w-[116px]">Status</TableHead>
          <TableHead className="w-[120px]">Penanda</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((task) => {
          const href = `/pm/tasks/${task.id}`;
          const overdue = task.status === "overdue";
          return (
            <TableRow
              key={task.id}
              className={cn("cursor-pointer", overdue && "bg-danger-soft/30 hover:bg-danger-soft/50")}
              onClick={() => router.push(href)}
            >
              <TableCell>
                <Link
                  href={href}
                  className="rounded-sm font-mono text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(event) => event.stopPropagation()}
                >
                  {task.number}
                </Link>
              </TableCell>
              <TableCell>
                <p className="font-medium">
                  {task.equipment.code ? (
                    <span className="font-mono text-xs text-muted-foreground">{task.equipment.code} &middot; </span>
                  ) : null}
                  {task.equipment.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[task.equipment.location_name, task.executor_unit.display_name].filter(Boolean).join(" - ")}
                </p>
              </TableCell>
              <TableCell>
                <p className="line-clamp-2 text-sm">{task.schedule?.name ?? "-"}</p>
                {task.schedule ? (
                  <p className="text-xs text-muted-foreground">{task.schedule.frequency_label}</p>
                ) : null}
              </TableCell>
              <TableCell
                className={cn(
                  "tabular whitespace-nowrap text-xs",
                  overdue
                    ? "font-semibold text-danger-foreground"
                    : task.status === "due"
                      ? "font-semibold text-warning-foreground"
                      : "text-muted-foreground",
                )}
              >
                {formatDateTime(task.due_at)}
              </TableCell>
              <TableCell className="text-sm">{task.pic?.name ?? "-"}</TableCell>
              <TableCell>
                <PmStatusBadge status={task.status} label={task.status_label} />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {task.is_late ? <LateChip /> : null}
                  {task.has_skip_proposal ? <SkipProposalChip /> : null}
                  <FindingsChip count={task.findings_count} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
