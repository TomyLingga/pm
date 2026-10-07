"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { ErrorState } from "@/components/common/states";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { getDailyActivity } from "@/lib/daily-activities";
import { ACTIVITY_STATUS_LABELS, weekRangeLabel } from "@/lib/daily-activity-constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { ActivityLog } from "@/types/common";
import type { DailyActivityDetail } from "@/types/daily-activity";
import { ActivityStatusBadge, WeekChip, WorkOrderChip } from "./activity-badges";

interface ActivityDetailDialogProps {
  activityId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (detail: DailyActivityDetail) => void;
  onStatus: (detail: DailyActivityDetail) => void;
  onDelete: (detail: DailyActivityDetail) => void;
}

function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="h-3 w-3 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Label/value pair of the meta grid. */
function Meta({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

/** Long text block (description, follow-up, obstacles). */
function TextBlock({ title, text }: { title: string; text: string | null }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {text ? (
        <p className="mt-1.5 max-w-prose whitespace-pre-wrap break-words text-sm">{text}</p>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">-</p>
      )}
    </section>
  );
}

/**
 * Status log, newest first. Same look as `HistoryTimeline` without its card wrapper
 * (a card inside a dialog would be a frame inside a frame).
 */
function LogList({ logs }: { logs: ActivityLog[] }) {
  const sorted = [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const label = (status: string | null) => (status ? (ACTIVITY_STATUS_LABELS[status] ?? status) : null);

  if (sorted.length === 0) return <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>;

  return (
    <ol className="relative ml-1.5 space-y-4 border-l pl-5">
      {sorted.map((log, index) => {
        const from = label(log.from_status);
        const to = label(log.to_status);
        const latest = index === 0;
        return (
          <li key={log.id} className="relative">
            <span
              className={cn(
                "absolute -left-[26.5px] top-1 h-3 w-3 rounded-full border-2 border-popover",
                latest ? "bg-primary ring-4 ring-primary/15" : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            <p className={cn("text-sm", latest ? "font-semibold" : "font-medium")}>{log.action_label}</p>
            {from || to ? (
              <p className="text-xs text-muted-foreground">{from && to && from !== to ? `${from} → ${to}` : (to ?? from)}</p>
            ) : null}
            {log.notes ? <p className="mt-1 whitespace-pre-wrap break-words text-sm">{log.notes}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {log.user?.name ?? "Sistem"} &middot; <span className="tabular">{formatDateTime(log.created_at)}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function DetailBody({ detail }: { detail: DailyActivityDetail }) {
  const program = detail.program_activity;
  const workOrder = detail.work_order;
  const recordedByOther = detail.created_by && detail.created_by.id !== detail.user.id;
  const weekRange = weekRangeLabel(detail.week_of_month);

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Meta label="Penanggung jawab (PIC)">
          <span className="flex items-center gap-2">
            <UserAvatar name={detail.user.name} photoUrl={detail.user.photo_url} className="h-7 w-7 text-[11px]" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{detail.user.name}</span>
              {detail.user.position ? (
                <span className="block truncate text-xs text-muted-foreground">{detail.user.position}</span>
              ) : null}
            </span>
          </span>
        </Meta>
        <Meta label="Unit organisasi">{detail.org_unit?.name ?? "-"}</Meta>
        <Meta label="Tanggal aktivitas">
          <span className="tabular">{formatDate(detail.activity_date)}</span>
          <span className="text-muted-foreground">
            {" "}
            &middot; Minggu ke-{detail.week_of_month}
            {weekRange ? ` (tanggal ${weekRange})` : ""}
          </span>
        </Meta>
        <Meta label="Waktu upload laporan">
          <span className="tabular">{formatDateTime(detail.created_at)}</span>
          {recordedByOther ? <span className="text-muted-foreground"> oleh {detail.created_by?.name}</span> : null}
        </Meta>
        {detail.closed_at ? (
          <Meta label="Ditutup pada">
            <span className="tabular">{formatDateTime(detail.closed_at)}</span>
          </Meta>
        ) : null}
        <Meta label="Terakhir diubah">
          <span className="tabular">{formatDateTime(detail.updated_at)}</span>
        </Meta>
      </dl>

      <div className="space-y-4 border-t pt-4">
        <TextBlock title="Laporan kegiatan" text={detail.description} />
        <TextBlock title="Tindak lanjut" text={detail.follow_up} />
        <TextBlock title="Kendala" text={detail.obstacles} />
      </div>

      {program ? (
        <section className="border-t pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kegiatan program kerja</h3>
          <Link
            href={`/programs/${program.program_id}`}
            className="mt-1.5 flex items-start gap-2 rounded-md text-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="block font-medium">{program.title}</span>
              <span className="block text-xs text-muted-foreground">
                <span className="font-mono">{program.program_code}</span> {program.program_title} &middot;{" "}
                <span className="font-mono">{program.item_code}</span> {program.item_title}
              </span>
            </span>
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Buka program kerja</span>
          </Link>
        </section>
      ) : null}

      {workOrder ? (
        <section className="border-t pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Work Order sumber</h3>
          <Link
            href={`/work-orders/${workOrder.id}`}
            className="mt-1.5 flex items-start gap-2 rounded-md text-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="block font-mono font-medium">{workOrder.wo_number}</span>
              {workOrder.request_description ? (
                <span className="line-clamp-3 block break-words text-xs text-muted-foreground">{workOrder.request_description}</span>
              ) : null}
            </span>
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Buka work order</span>
          </Link>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Laporan ini dibuat otomatis saat work order tersebut diselesaikan oleh teknisi.
          </p>
        </section>
      ) : null}

      <section className="border-t pt-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Riwayat</h3>
        <LogList logs={detail.logs} />
      </section>
    </div>
  );
}

/** Full report with its status log (`GET /daily-activities/{id}`); actions follow `permissions`. */
export function ActivityDetailDialog({ activityId, open, onOpenChange, onEdit, onStatus, onDelete }: ActivityDetailDialogProps) {
  const query = useQuery({
    queryKey: queryKeys.dailyActivity(activityId ?? 0),
    queryFn: ({ signal }) => getDailyActivity(activityId as number, signal),
    enabled: open && activityId !== null,
  });
  const detail = query.data;
  const canUpdate = detail?.permissions.can_update ?? false;
  const canDelete = detail?.permissions.can_delete ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-words">{detail ? detail.title : "Detail aktivitas"}</DialogTitle>
          {detail ? (
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <WeekChip week={detail.week_of_month} />
              <span className="tabular">{formatDate(detail.activity_date)}</span>
              <ActivityStatusBadge status={detail.status} label={detail.status_label} />
              {detail.work_order ? <WorkOrderChip workOrder={detail.work_order} /> : null}
            </DialogDescription>
          ) : (
            <DialogDescription>Laporan aktivitas harian beserta riwayat statusnya.</DialogDescription>
          )}
        </DialogHeader>

        {query.isPending ? (
          <DetailSkeleton />
        ) : query.isError ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : detail ? (
          <DetailBody detail={detail} />
        ) : null}

        {detail && (canUpdate || canDelete) ? (
          <DialogFooter className="border-t pt-4 sm:justify-between">
            {canDelete ? (
              <Button variant="ghost" className="text-danger-foreground hover:bg-danger-soft" onClick={() => onDelete(detail)}>
                <Trash2 />
                Hapus
              </Button>
            ) : (
              <span />
            )}
            {canUpdate ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => onEdit(detail)}>
                  <Pencil />
                  Ubah Laporan
                </Button>
                <Button onClick={() => onStatus(detail)}>
                  <RefreshCw />
                  Update Status
                </Button>
              </div>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
