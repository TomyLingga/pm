"use client";

import * as React from "react";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowRightLeft, Gauge, Pencil } from "lucide-react";
import { ErrorState } from "@/components/common/states";
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
import { APP_TIME_ZONE, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WorkProgramActivity, WorkProgramActivityDetail, WorkProgramItem } from "@/types/work-program";
import { LogList } from "./log-list";
import { ACTIVITY_STATUS_LABELS, ActivityStatusBadge, PicChipList, ProgressBar, isActivityOverdue } from "./program-badges";
import { useWorkProgramActivity } from "./use-work-program";

interface ActivityDetailDialogProps {
  activityId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sub-items of the programme, to name the one the activity belongs to. */
  items: WorkProgramItem[];
  onEdit: (activity: WorkProgramActivity) => void;
  onStatus: (activity: WorkProgramActivity) => void;
  onProgress: (activity: WorkProgramActivity) => void;
}

/** Placeholder shaped like the body: status row, meta grid, text block, timeline. */
function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-2 flex-1 rounded-full" />
        <Skeleton className="h-4 w-10" />
      </div>
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
        <Skeleton className="h-4 w-[85%]" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        {Array.from({ length: 3 }).map((_, index) => (
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

/** Long text block (action plan, remarks). */
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

/** Y-m-d as "5 Okt 2026"; an open activity past its target gets the same marker as the table. */
function DateValue({ value, overdue }: { value: string | null; overdue?: boolean }) {
  if (!value) return <span className="text-muted-foreground">-</span>;
  return (
    <span className="tabular">
      {formatDate(value)}
      {overdue ? <span className="block text-[11px] font-semibold text-danger-foreground">Lewat target</span> : null}
    </span>
  );
}

function DetailBody({ detail, item }: { detail: WorkProgramActivityDetail; item?: WorkProgramItem }) {
  const today = React.useMemo(() => formatInTimeZone(new Date(), APP_TIME_ZONE, "yyyy-MM-dd"), []);
  const overdue = isActivityOverdue(detail, today);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <ActivityStatusBadge status={detail.status} label={detail.status_label} />
        <div className="flex min-w-[10rem] flex-1 items-center gap-2">
          <ProgressBar value={detail.progress_pct} label="Progres kegiatan" className="flex-1" trackClassName="h-2" />
          <span className="tabular w-10 text-right text-sm font-semibold">{detail.progress_pct}%</span>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Meta label="Sub-item" wide>
          {item ? (
            <>
              <span className="font-mono text-primary">{item.code}</span> {item.title}
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </Meta>
        <Meta label="PIC (utama & pendukung)" wide>
          <PicChipList pics={detail.pics} />
        </Meta>
        <Meta label="Target date">
          <DateValue value={detail.target_date} overdue={overdue} />
        </Meta>
        <Meta label="Closed date">
          <DateValue value={detail.closed_date} />
        </Meta>
        <Meta label="Laporan harian">
          <span className="tabular">{detail.daily_activities_count}</span> laporan
        </Meta>
        <Meta label="Terakhir diubah">
          <span className="tabular">{formatDateTime(detail.updated_at)}</span>
        </Meta>
      </dl>

      <div className="space-y-4 border-t pt-4">
        <TextBlock title="Action to be taken" text={detail.action_plan} />
        <TextBlock title="Remarks" text={detail.remarks} />
      </div>

      <section className="border-t pt-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Riwayat kegiatan</h3>
        <LogList logs={detail.logs} statusLabels={ACTIVITY_STATUS_LABELS} surface="popover" />
      </section>
    </div>
  );
}

/**
 * One activity with its own status log (`GET /work-program-activities/{id}`), open to everyone who
 * can see the programme. The footer hands over to the edit / status / progress dialogs per `permissions`.
 */
export function ActivityDetailDialog({ activityId, open, onOpenChange, items, onEdit, onStatus, onProgress }: ActivityDetailDialogProps) {
  const query = useWorkProgramActivity(activityId, open);
  const detail = query.data;
  const item = detail ? items.find((candidate) => candidate.id === detail.work_program_item_id) : undefined;
  const permissions = detail?.permissions;
  const hasAction = !!permissions && (permissions.can_update_progress || permissions.can_change_status || permissions.can_edit);

  /** Close this dialog, then open the one for the chosen action. */
  const handOver = (handler: (activity: WorkProgramActivity) => void) => {
    if (!detail) return;
    onOpenChange(false);
    handler(detail);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-words">{detail ? detail.title : "Detail kegiatan"}</DialogTitle>
          <DialogDescription>
            {detail
              ? `Kegiatan no. ${detail.sequence}${item ? ` pada sub-item ${item.code} ${item.title}` : ""}.`
              : "Rincian kegiatan beserta riwayat perubahannya."}
          </DialogDescription>
        </DialogHeader>

        {query.isPending ? (
          <DetailSkeleton />
        ) : query.isError ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : detail ? (
          <DetailBody detail={detail} item={item} />
        ) : null}

        {detail && permissions && hasAction ? (
          <DialogFooter className="border-t pt-4">
            {permissions.can_edit ? (
              <Button variant="outline" onClick={() => handOver(onEdit)}>
                <Pencil />
                Ubah kegiatan
              </Button>
            ) : null}
            {permissions.can_change_status ? (
              <Button variant="outline" onClick={() => handOver(onStatus)}>
                <ArrowRightLeft />
                Ubah status
              </Button>
            ) : null}
            {permissions.can_update_progress ? (
              <Button onClick={() => handOver(onProgress)}>
                <Gauge />
                Update progres
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
