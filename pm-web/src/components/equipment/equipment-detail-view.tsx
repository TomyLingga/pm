"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadError } from "@/components/common/load-error";
import { PageHeader } from "@/components/common/page-header";
import { InfoList, Section } from "@/components/common/section";
import { useCurrentUser } from "@/components/layout/current-user";
import { EquipmentStatusBadge } from "@/components/pm/pm-badges";
import { pmTasksHref } from "@/components/pm/use-pm-units";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { ApiError, errorMessage } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { deleteEquipment, getEquipment } from "@/lib/pm-equipment";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { EquipmentFormDialog } from "./equipment-form-dialog";
import { EquipmentHistory } from "./equipment-history";

function StatTile({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "warning" | "default";
  href?: string;
}) {
  const body = (
    <>
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular mt-1 block text-xl font-semibold leading-tight tracking-tight",
          tone === "warning" && "text-warning-foreground",
        )}
      >
        {value}
      </span>
      {hint ? <span className="tabular mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
    </>
  );
  const className = "panel block p-4";
  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-colors duration-150 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Placeholder shaped like the page: header, 4 stat tiles, info + history. */
function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="panel space-y-2 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="panel lg:order-2 lg:col-span-2">
          <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex gap-2">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <Skeleton className="h-20 flex-1" />
              </div>
            ))}
          </div>
        </div>
        <div className="panel lg:order-1">
          <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EquipmentDetailView({ id }: { id: number }) {
  const me = useCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const query = useQuery({
    queryKey: queryKeys.equipmentDetail(id),
    queryFn: ({ signal }) => getEquipment(id, signal),
  });

  if (query.isPending) {
    return <DetailSkeleton />;
  }
  if (query.isError) {
    return <LoadError error={query.error} onRetry={() => query.refetch()} entity="Equipment" backHref="/equipment" />;
  }

  const equipment = query.data;
  const stats = equipment.stats;

  const onDelete = async () => {
    setDeleting(true);
    try {
      await deleteEquipment(equipment.id);
      toast.success("Equipment dihapus.");
      queryClient.removeQueries({ queryKey: queryKeys.equipmentDetail(equipment.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.equipmentAll });
      router.replace("/equipment");
    } catch (error) {
      setDeleting(false);
      setConfirmDelete(false);
      if (error instanceof ApiError && error.status === 409) {
        // Still used by an active PM schedule.
        toast.error("Equipment tidak dapat dihapus", { description: error.message, duration: 8000 });
      } else {
        toast.error(errorMessage(error));
      }
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={equipment.code ? <span className="font-mono">{equipment.code}</span> : "Equipment"}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-words">{equipment.name}</span>
            <EquipmentStatusBadge status={equipment.status} label={equipment.status_label} />
          </span>
        }
        description={
          [equipment.location?.name, equipment.executor_unit?.display_name].filter(Boolean).join(" · ") || undefined
        }
        backHref="/equipment"
        backLabel="Daftar Equipment"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={pmTasksHref(me, { equipment_id: equipment.id })}>Tugas PM</Link>
            </Button>
            {equipment.permissions.can_update ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil />
                Ubah
              </Button>
            ) : null}
            {equipment.permissions.can_delete ? (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Hapus
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="WO terbuka"
          value={stats.open_work_orders}
          tone={stats.open_work_orders > 0 ? "warning" : "default"}
        />
        <StatTile label="Jadwal PM aktif" value={stats.active_schedules} />
        <StatTile
          label="PM terakhir selesai"
          value={stats.last_pm_completed_at ? formatRelative(stats.last_pm_completed_at) : "-"}
          hint={stats.last_pm_completed_at ? formatDateTime(stats.last_pm_completed_at) : "Belum pernah"}
        />
        <StatTile
          label="PM berikutnya"
          value={stats.next_pm_due_at ? formatRelative(stats.next_pm_due_at) : "-"}
          hint={stats.next_pm_due_at ? formatDateTime(stats.next_pm_due_at) : "Tidak terjadwal"}
          href={stats.next_pm_due_at ? pmTasksHref(me, { equipment_id: equipment.id }) : undefined}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:order-2 lg:col-span-2">
          <EquipmentHistory equipmentId={equipment.id} />
        </div>
        <div className="min-w-0 lg:order-1">
          <Section title="Informasi" icon={<Info className="h-4 w-4" aria-hidden />}>
            <InfoList
              className="sm:grid-cols-1"
              items={[
                { label: "Kode / no. alat", value: equipment.code ? <span className="font-mono">{equipment.code}</span> : null },
                { label: "Nama", value: equipment.name },
                {
                  label: "Lokasi",
                  value: equipment.location
                    ? [equipment.location.code, equipment.location.name].filter(Boolean).join(" - ")
                    : null,
                },
                { label: "Unit pelaksana", value: equipment.executor_unit?.display_name },
                { label: "Merk", value: equipment.brand },
                { label: "Model / tipe", value: equipment.model },
                {
                  label: "No. seri",
                  value: equipment.serial_number ? <span className="font-mono">{equipment.serial_number}</span> : null,
                },
                {
                  label: "Status",
                  value: <EquipmentStatusBadge status={equipment.status} label={equipment.status_label} />,
                },
              ]}
            />
          </Section>
        </div>
      </div>

      <EquipmentFormDialog equipment={equipment} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus equipment "${equipment.name}"?`}
        description="Equipment yang masih dipakai jadwal PM aktif tidak dapat dihapus."
        confirmLabel="Hapus Equipment"
        confirmVariant="destructive"
        loading={deleting}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
