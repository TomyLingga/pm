"use client";

import * as React from "react";
import { formatInTimeZone } from "date-fns-tz";
import {
  ArrowRightLeft,
  CalendarCheck2,
  CalendarClock,
  Gauge,
  History,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { APP_TIME_ZONE, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WorkProgramActivity, WorkProgramItem } from "@/types/work-program";
import { ActivityStatusBadge, PicChipList, ProgressBar, isActivityOverdue } from "./program-badges";

interface ActivityHandlers {
  /** Opens the detail dialog (with the activity's log); needs no permission. */
  onDetail: (activity: WorkProgramActivity) => void;
  onEdit: (activity: WorkProgramActivity) => void;
  onStatus: (activity: WorkProgramActivity) => void;
  onProgress: (activity: WorkProgramActivity) => void;
  onDelete: (activity: WorkProgramActivity) => void;
}

interface ActivityTableProps extends ActivityHandlers {
  item: WorkProgramItem;
  /** Rendered inside the empty state (e.g. the "Tambah Kegiatan" button). */
  emptyAction?: React.ReactNode;
}

function hasAnyAction(activity: WorkProgramActivity): boolean {
  const p = activity.permissions;
  return p.can_update_progress || p.can_change_status || p.can_edit || p.can_delete;
}

/** Per-row menu: "Lihat riwayat" for everyone, the rest gated by the activity's own permissions. */
function RowActions({ activity, onDetail, onEdit, onStatus, onProgress, onDelete }: { activity: WorkProgramActivity } & ActivityHandlers) {
  const p = activity.permissions;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={`Aksi kegiatan ${activity.sequence}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onDetail(activity)}>
          <History aria-hidden />
          Lihat riwayat
        </DropdownMenuItem>
        {hasAnyAction(activity) ? <DropdownMenuSeparator /> : null}
        {p.can_update_progress ? (
          <DropdownMenuItem onSelect={() => onProgress(activity)}>
            <Gauge aria-hidden />
            Update progres
          </DropdownMenuItem>
        ) : null}
        {p.can_change_status ? (
          <DropdownMenuItem onSelect={() => onStatus(activity)}>
            <ArrowRightLeft aria-hidden />
            Ubah status
          </DropdownMenuItem>
        ) : null}
        {p.can_edit ? (
          <DropdownMenuItem onSelect={() => onEdit(activity)}>
            <Pencil aria-hidden />
            Ubah kegiatan
          </DropdownMenuItem>
        ) : null}
        {p.can_delete ? (
          <>
            {p.can_update_progress || p.can_change_status || p.can_edit ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onSelect={() => onDelete(activity)} className="text-danger focus:text-danger">
              <Trash2 aria-hidden />
              Hapus kegiatan
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The activity title as a real button that opens the detail dialog. Vertical padding (cancelled by
 * negative margins) keeps a 40px tap height on phones without widening the row.
 */
function TitleButton({
  activity,
  onDetail,
  className,
}: {
  activity: WorkProgramActivity;
  onDetail: (activity: WorkProgramActivity) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onDetail(activity)}
      title="Lihat detail dan riwayat kegiatan"
      className={cn(
        "-my-2.5 inline-block max-w-full rounded-sm py-2.5 text-left text-sm font-medium decoration-muted-foreground/60 underline-offset-4 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:-my-1 md:py-1",
        activity.status === "cancelled" && "line-through decoration-muted-foreground/50",
        className,
      )}
    >
      {activity.title}
    </button>
  );
}

/** Y-m-d shown as "5 Okt 2026"; open activities past their target get a marker. */
function DateCell({ value, overdue, className }: { value: string | null; overdue?: boolean; className?: string }) {
  if (!value) return <span className={cn("text-muted-foreground", className)}>-</span>;
  return (
    <span className={cn("tabular", className)}>
      {formatDate(value)}
      {overdue ? <span className="block text-[11px] font-semibold text-danger-foreground">Lewat target</span> : null}
    </span>
  );
}

function MultilineText({ value, className }: { value: string | null; className?: string }) {
  if (!value) return <span className={cn("text-muted-foreground", className)}>-</span>;
  return <p className={cn("whitespace-pre-wrap break-words", className)}>{value}</p>;
}

function Summary({ item }: { item: WorkProgramItem }) {
  const open = item.counts.open + item.counts.on_progress;
  return (
    <p className="tabular text-sm text-muted-foreground">
      Total: <span className="font-medium text-foreground">{item.activities_count}</span> kegiatan (
      <span className="font-medium text-foreground">{open}</span> terbuka,{" "}
      <span className="font-medium text-foreground">{item.counts.closed}</span> selesai
      {item.counts.cancelled > 0 ? (
        <>
          , <span className="font-medium text-foreground">{item.counts.cancelled}</span> dibatalkan
        </>
      ) : null}
      )
    </p>
  );
}

/** Activities of one sub-item: table from `md`, cards on phones. */
export function ActivityTable({ item, emptyAction, ...handlers }: ActivityTableProps) {
  const today = React.useMemo(() => formatInTimeZone(new Date(), APP_TIME_ZONE, "yyyy-MM-dd"), []);
  const activities = React.useMemo(
    () => [...item.activities].sort((a, b) => a.sequence - b.sequence || a.id - b.id),
    [item.activities],
  );
  const isOverdue = (activity: WorkProgramActivity) => isActivityOverdue(activity, today);

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-sm font-medium">Belum ada kegiatan di sub-item {item.code}</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Kegiatan berisi project, action to be taken, PIC, dan target date yang progresnya dipantau sepanjang tahun.
        </p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div>
      {/* Desktop */}
      <div className="hidden md:block">
        <Table className="min-w-[980px] 2xl:min-w-[1140px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-center">No</TableHead>
              <TableHead className="min-w-[200px]">Project / Kegiatan</TableHead>
              <TableHead className="min-w-[220px]">Action to be taken</TableHead>
              <TableHead className="min-w-[160px]">Nama PIC (utama & pendukung)</TableHead>
              <TableHead className="w-[100px]">Target date</TableHead>
              <TableHead className="w-[100px]">Closed date</TableHead>
              <TableHead className="w-[136px]">Status</TableHead>
              <TableHead className="hidden min-w-[160px] 2xl:table-cell">Remarks</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Aksi</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity) => (
              <TableRow key={activity.id} className={cn(activity.status === "cancelled" && "text-muted-foreground")}>
                <TableCell className="tabular text-center text-sm text-muted-foreground">{activity.sequence}</TableCell>
                <TableCell>
                  <TitleButton activity={activity} onDetail={handlers.onDetail} />
                  {activity.daily_activities_count > 0 ? (
                    <p className="tabular mt-0.5 text-xs text-muted-foreground">
                      {activity.daily_activities_count} laporan harian
                    </p>
                  ) : null}
                  {activity.remarks ? (
                    <p className="mt-1.5 text-xs text-muted-foreground 2xl:hidden">
                      <span className="font-medium">Remarks:</span>{" "}
                      <span className="whitespace-pre-wrap break-words">{activity.remarks}</span>
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <MultilineText value={activity.action_plan} className="text-sm" />
                </TableCell>
                <TableCell>
                  <PicChipList pics={activity.pics} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  <DateCell value={activity.target_date} overdue={isOverdue(activity)} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  <DateCell value={activity.closed_date} />
                </TableCell>
                <TableCell>
                  <ActivityStatusBadge status={activity.status} label={activity.status_label} />
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={activity.progress_pct} label={`Progres kegiatan ${activity.sequence}`} className="flex-1" />
                    <span className="tabular w-9 text-right text-xs font-medium">{activity.progress_pct}%</span>
                  </div>
                </TableCell>
                <TableCell className="hidden 2xl:table-cell">
                  <MultilineText value={activity.remarks} className="text-sm" />
                </TableCell>
                <TableCell className="text-right">
                  <RowActions activity={activity} {...handlers} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Phones */}
      <ul className="divide-y md:hidden">
        {activities.map((activity) => (
          <li key={activity.id} className={cn("space-y-3 p-4", activity.status === "cancelled" && "text-muted-foreground")}>
            <div className="flex items-start gap-2">
              <span className="tabular mt-0.5 w-6 shrink-0 text-xs font-semibold text-muted-foreground">{activity.sequence}.</span>
              <div className="min-w-0 flex-1">
                <TitleButton activity={activity} onDetail={handlers.onDetail} className="font-semibold" />
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <ActivityStatusBadge status={activity.status} label={activity.status_label} />
                  <span className="tabular text-xs text-muted-foreground">{activity.progress_pct}%</span>
                </div>
              </div>
              <RowActions activity={activity} {...handlers} />
            </div>
            <ProgressBar value={activity.progress_pct} label={`Progres kegiatan ${activity.sequence}`} />
            {activity.action_plan ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Action to be taken</p>
                <MultilineText value={activity.action_plan} className="mt-1 text-sm" />
              </div>
            ) : null}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PIC</p>
              <PicChipList pics={activity.pics} className="mt-1" />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <CalendarClock className="h-3 w-3" aria-hidden />
                  Target
                </dt>
                <dd className="mt-0.5">
                  <DateCell value={activity.target_date} overdue={isOverdue(activity)} />
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <CalendarCheck2 className="h-3 w-3" aria-hidden />
                  Closed
                </dt>
                <dd className="mt-0.5">
                  <DateCell value={activity.closed_date} />
                </dd>
              </div>
            </dl>
            {activity.remarks ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Remarks</p>
                <MultilineText value={activity.remarks} className="mt-1 text-sm" />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="border-t bg-surface-2/40 px-4 py-2.5">
        <Summary item={item} />
      </div>
    </div>
  );
}
