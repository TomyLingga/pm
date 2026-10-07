import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { PmStatusBadge } from "@/components/pm/pm-badges";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMinutesShort } from "@/lib/dashboard";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn, formatNumber } from "@/lib/utils";
import type { DashboardScope, PmUpcoming, TechnicianWorkload } from "@/types/dashboard";
import { ChartCard } from "./chart-card";

export function TechnicianWorkloadTable({ data, scope }: { data: TechnicianWorkload[]; scope: DashboardScope }) {
  // In "mine" the list is just me: show a compact summary instead of a one-row table.
  if (scope === "mine") {
    const mine = data[0];
    return (
      <ChartCard title="Beban kerja saya" description="WO dan tugas PM yang ditangani" isEmpty={!mine}>
        {mine ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["WO aktif", formatNumber(mine.wo_active, 0)],
              ["WO selesai", formatNumber(mine.wo_completed, 0)],
              ["PM terbuka", formatNumber(mine.pm_open, 0)],
              ["PM selesai", formatNumber(mine.pm_completed, 0)],
              ["Jam kerja", formatMinutesShort(mine.labour_minutes)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-surface-2/50 p-3">
                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                <dd className="tabular mt-1 text-lg font-semibold leading-none">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Beban kerja teknisi" description="Staf unit pelaksana dalam periode" isEmpty={data.length === 0}>
      <div className="-mx-4 -mb-4 sm:-mx-5 sm:-mb-5">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 sm:pl-5">Teknisi</TableHead>
              <TableHead className="w-20 text-right">WO aktif</TableHead>
              <TableHead className="w-20 text-right">WO selesai</TableHead>
              <TableHead className="w-20 text-right">PM terbuka</TableHead>
              <TableHead className="w-20 text-right">PM selesai</TableHead>
              <TableHead className="w-24 pr-4 text-right sm:pr-5">Jam kerja</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.user.id}>
                <TableCell className="py-2 pl-4 sm:pl-5">
                  <p className="font-medium">{row.user.name}</p>
                  {row.user.position ? <p className="text-[11px] text-muted-foreground">{row.user.position}</p> : null}
                </TableCell>
                <TableCell className={cn("tabular py-2 text-right", row.wo_active > 0 && "font-semibold text-warning-foreground")}>
                  {formatNumber(row.wo_active, 0)}
                </TableCell>
                <TableCell className="tabular py-2 text-right">{formatNumber(row.wo_completed, 0)}</TableCell>
                <TableCell className={cn("tabular py-2 text-right", row.pm_open > 0 && "font-semibold text-warning-foreground")}>
                  {formatNumber(row.pm_open, 0)}
                </TableCell>
                <TableCell className="tabular py-2 text-right">{formatNumber(row.pm_completed, 0)}</TableCell>
                <TableCell className="tabular py-2 pr-4 text-right sm:pr-5">{formatMinutesShort(row.labour_minutes)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ChartCard>
  );
}

export function PmUpcomingList({ data }: { data: PmUpcoming[] }) {
  return (
    <ChartCard
      title="PM terdekat"
      description="10 tugas PM dengan jatuh tempo terdekat"
      isEmpty={data.length === 0}
      emptyText="Tidak ada tugas PM yang akan jatuh tempo."
      actions={
        <Button asChild variant="ghost" size="xs">
          <Link href="/pm/calendar">
            Kalender
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      }
    >
      <ul className="-mx-2 divide-y">
        {data.map((task) => {
          const overdue = task.status === "overdue";
          return (
            <li key={task.id}>
              <Link
                href={`/pm/tasks/${task.id}`}
                className="flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                    overdue ? "bg-danger-soft text-danger-foreground" : "bg-surface-2 text-muted-foreground",
                  )}
                >
                  <CalendarClock className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-mono text-xs font-semibold text-primary">{task.number}</span>
                    <PmStatusBadge status={task.status} label={task.status_label} />
                  </span>
                  <span className="block truncate text-sm font-medium">
                    {task.equipment.code ? <span className="font-mono text-xs">{task.equipment.code} &middot; </span> : null}
                    {task.equipment.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[task.schedule_name, task.pic?.name].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="tabular shrink-0 text-right text-xs">
                  <span className={cn("block font-medium", overdue && "text-danger-foreground")}>{formatRelative(task.due_at)}</span>
                  <span className="block text-muted-foreground">{formatDateTime(task.due_at)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
