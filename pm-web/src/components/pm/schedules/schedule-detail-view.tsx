"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CalendarClock, Cog, Info, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadError } from "@/components/common/load-error";
import { PageHeader } from "@/components/common/page-header";
import { InfoList, Section } from "@/components/common/section";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { errorMessage } from "@/lib/api";
import { formatDateTime, formatDateTimeLong, formatMinutes } from "@/lib/format";
import { PM_STATUS_OPTIONS } from "@/lib/pm-constants";
import { deletePmSchedule, getPmSchedule } from "@/lib/pm-schedules";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { ActiveBadge, PM_STATUS_STYLES } from "../pm-badges";
import { pmTasksHref } from "../use-pm-units";

export function usePmSchedule(id: number | null) {
  return useQuery({
    queryKey: queryKeys.pmSchedule(id ?? 0),
    queryFn: ({ signal }) => getPmSchedule(id as number, signal),
    enabled: id !== null,
  });
}

/** Card-shaped placeholder: titled header + a few label/value rows. */
function SectionSkeleton({ rows, className }: { rows: number; className?: string }) {
  return (
    <div className={cn("panel", className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionSkeleton rows={8} />
          <SectionSkeleton rows={2} />
        </div>
        <div className="space-y-4">
          <SectionSkeleton rows={2} />
          <SectionSkeleton rows={4} />
        </div>
      </div>
    </div>
  );
}

export function ScheduleDetailView({ id }: { id: number }) {
  const me = useCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = usePmSchedule(id);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  if (query.isPending) {
    return <DetailSkeleton />;
  }
  if (query.isError) {
    return <LoadError error={query.error} onRetry={() => query.refetch()} entity="Jadwal PM" backHref="/pm/schedules" />;
  }

  const schedule = query.data;
  const counts = schedule.task_counts ?? {};

  const onDelete = async () => {
    setDeleting(true);
    try {
      await deletePmSchedule(schedule.id);
      toast.success("Jadwal PM dihapus. Tugas yang masih TERJADWAL ikut dihapus.");
      queryClient.removeQueries({ queryKey: queryKeys.pmSchedule(schedule.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pmScheduleLists });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pmTasks });
      router.replace("/pm/schedules");
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Jadwal PM"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {schedule.name}
            <ActiveBadge active={schedule.is_active} />
          </span>
        }
        description={`${schedule.executor_unit.display_name} · ${schedule.frequency_label}`}
        backHref="/pm/schedules"
        backLabel="Daftar Jadwal PM"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={pmTasksHref(me, { schedule_id: schedule.id })}>Lihat tugas</Link>
            </Button>
            {schedule.permissions.can_update ? (
              <Button asChild variant="outline">
                <Link href={`/pm/schedules/${schedule.id}/edit`}>
                  <Pencil />
                  Ubah
                </Link>
              </Button>
            ) : null}
            {schedule.permissions.can_delete ? (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Hapus
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Section title="Informasi" icon={<Info className="h-4 w-4" aria-hidden />}>
            <InfoList
              items={[
                { label: "Unit pelaksana", value: schedule.executor_unit.display_name },
                {
                  label: "Template checklist",
                  value: (
                    <Link
                      href={`/pm/templates/${schedule.checklist_template.id}`}
                      className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {schedule.checklist_template.name}
                    </Link>
                  ),
                },
                { label: "Frekuensi", value: schedule.frequency_label },
                { label: "PIC", value: schedule.pic?.name },
                {
                  label: "Mulai (kejadian pertama)",
                  value: <span className="tabular">{formatDateTimeLong(schedule.start_at)}</span>,
                },
                {
                  label: "Berakhir",
                  value: schedule.end_at ? (
                    <span className="tabular">{formatDateTimeLong(schedule.end_at)}</span>
                  ) : (
                    "Tanpa batas"
                  ),
                },
                { label: "Toleransi keterlambatan", value: formatMinutes(schedule.tolerance_hours * 60) },
                {
                  label: "Jendela jatuh tempo",
                  value:
                    schedule.due_window_hours !== null && schedule.due_window_hours !== undefined
                      ? `${formatMinutes(schedule.due_window_hours * 60)} sebelum jatuh tempo`
                      : "Default (H-2)",
                },
                {
                  label: "Estimasi durasi",
                  value: schedule.estimated_minutes ? formatMinutes(schedule.estimated_minutes) : null,
                },
                {
                  label: "Tugas digenerate sampai",
                  value: schedule.generated_until ? (
                    <span className="tabular">{formatDateTime(schedule.generated_until)}</span>
                  ) : null,
                },
              ]}
            />
          </Section>

          <Section
            title={`Equipment (${schedule.equipment_count})`}
            icon={<Cog className="h-4 w-4" aria-hidden />}
          >
            {schedule.equipment.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada equipment.</p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-md border">
                {schedule.equipment.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/equipment/${item.id}`}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      {item.code ? <span className="font-mono text-xs font-semibold text-primary">{item.code}</span> : null}
                      <span className="min-w-0 truncate">{item.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="min-w-0 space-y-4">
          <Section title="Jadwal berikutnya" icon={<CalendarClock className="h-4 w-4" aria-hidden />}>
            {schedule.upcoming?.length ? (
              <ol className="space-y-1.5 text-sm">
                {schedule.upcoming.map((date, index) => (
                  <li
                    key={`${date}-${index}`}
                    className={cn("tabular flex gap-2", index === 0 ? "font-semibold text-foreground" : "text-muted-foreground")}
                  >
                    <span className="w-4 shrink-0 text-right text-xs font-normal text-muted-foreground">
                      {index + 1}.
                    </span>
                    {formatDateTimeLong(date)}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                {schedule.is_active ? "Tidak ada kejadian berikutnya." : "Jadwal nonaktif."}
              </p>
            )}
          </Section>

          <Section title="Ringkasan tugas" icon={<BarChart3 className="h-4 w-4" aria-hidden />}>
            <ul className="grid grid-cols-2 gap-2">
              {PM_STATUS_OPTIONS.map((option) => (
                <li key={option.value}>
                  <Link
                    href={pmTasksHref(me, { schedule_id: schedule.id, status: option.value })}
                    className={cn(
                      "block rounded-md border px-3 py-2 transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      PM_STATUS_STYLES[option.value],
                      "no-underline",
                    )}
                  >
                    <span className="tabular block text-xl font-semibold tracking-tight">{counts[option.value] ?? 0}</span>
                    <span className="block text-[11px] font-semibold tracking-wide">{option.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus jadwal "${schedule.name}"?`}
        description="Tugas yang masih TERJADWAL ikut dihapus. Tugas yang sudah jatuh tempo, dikerjakan, atau selesai tetap tersimpan sebagai riwayat."
        confirmLabel="Hapus Jadwal"
        confirmVariant="destructive"
        loading={deleting}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
