"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Building2,
  FileSpreadsheet,
  Layers3,
  LockKeyhole,
  LockKeyholeOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadError } from "@/components/common/load-error";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  deleteWorkProgram,
  deleteWorkProgramActivity,
  deleteWorkProgramItem,
  updateWorkProgram,
  workProgramExportUrl,
} from "@/lib/work-programs";
import type { WorkProgramActivity, WorkProgramDetail, WorkProgramItem } from "@/types/work-program";
import { ActivityDetailDialog } from "./activity-detail-dialog";
import { ActivityFormDialog } from "./activity-form-dialog";
import { ActivityProgressDialog } from "./activity-progress-dialog";
import { ActivityStatusDialog } from "./activity-status-dialog";
import { ActivityTable } from "./activity-table";
import { ItemFormDialog } from "./item-form-dialog";
import {
  ACTIVITY_STATUS_OPTIONS,
  ACTIVITY_STATUS_STYLES,
  ProgramStatusBadge,
  ProgressBar,
  ProgressRing,
  formatPct,
} from "./program-badges";
import { ProgramFormDialog } from "./program-form-dialog";
import { ProgramHistory } from "./program-history";
import { ProgramYearSwitcher } from "./program-year-switcher";
import { useWorkProgram, useWorkProgramCache } from "./use-work-program";

type Confirm =
  | { kind: "close" }
  | { kind: "reopen" }
  | { kind: "delete-program" }
  | { kind: "delete-item"; item: WorkProgramItem }
  | { kind: "delete-activity"; activity: WorkProgramActivity };

/* ---------- Skeleton shaped like header + summary + pills + table ---------- */

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-80 max-w-full" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
      </div>
      <div className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-[88px] w-[88px] rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-44 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b p-4 sm:p-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="h-10 border-b bg-surface-2/70" />
        <div className="divide-y">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[3rem_1fr_1fr_12rem_7rem_7rem_9rem_3rem] items-start gap-3 px-3 py-3">
              <Skeleton className="h-4 w-5" />
              <Skeleton className="h-4 w-3/4" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Summary ---------- */

function ProgressSummary({ program }: { program: WorkProgramDetail }) {
  return (
    <section className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5" aria-label="Ringkasan progres">
      <div className="flex items-center gap-4">
        <ProgressRing value={program.progress_pct} size={88} stroke={8} />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Progres capaian</p>
          <p className="tabular text-2xl font-semibold tracking-tight">{formatPct(program.progress_pct)}</p>
          <p className="mt-0.5 max-w-[16rem] text-xs text-muted-foreground">
            Rata-rata progres {program.activities_count} kegiatan di {program.items_count} sub-item. Kegiatan dibatalkan tidak
            dihitung.
          </p>
        </div>
      </div>
      <ul className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIVITY_STATUS_OPTIONS.map((option) => (
          <li key={option.value} className={cn("rounded-md border px-3 py-2", ACTIVITY_STATUS_STYLES[option.value])}>
            <span className="tabular block text-xl font-semibold tracking-tight">{program.counts[option.value]}</span>
            <span className="block text-[11px] font-semibold uppercase tracking-wide">{option.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Sub-item pills ---------- */

function ItemTabs({
  items,
  selectedId,
  onSelect,
}: {
  items: WorkProgramItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Sub-item program"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`program-item-tab-${item.id}`}
            aria-controls={`program-item-panel-${item.id}`}
            onClick={() => onSelect(item.id)}
            className={cn(
              "inline-flex h-10 shrink-0 select-none items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:bg-surface-2",
            )}
          >
            <span className={cn("font-mono text-xs font-semibold", selected ? "text-primary-foreground/80" : "text-primary")}>
              {item.code}
            </span>
            <span className="max-w-[14rem] truncate">{item.title}</span>
            <span
              className={cn(
                "tabular rounded-full px-1.5 text-[11px] font-semibold",
                selected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-surface-2 text-muted-foreground",
              )}
            >
              {item.activities_count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- View ---------- */

export function ProgramDetailView({ id }: { id: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useWorkProgram(id);
  const cache = useWorkProgramCache(id);

  const [editOpen, setEditOpen] = React.useState(false);
  const [itemDialog, setItemDialog] = React.useState<{ open: boolean; item?: WorkProgramItem }>({ open: false });
  const [activityDialog, setActivityDialog] = React.useState<{ open: boolean; activity?: WorkProgramActivity }>({
    open: false,
  });
  const [statusTarget, setStatusTarget] = React.useState<WorkProgramActivity | null>(null);
  const [progressTarget, setProgressTarget] = React.useState<WorkProgramActivity | null>(null);
  // The detail dialog keeps its id while closing so the title does not blank out mid-animation.
  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<Confirm | null>(null);

  const itemParam = searchParams.get("item");
  const selectItem = React.useCallback(
    (itemId: number | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (itemId === null) next.delete("item");
      else next.set("item", String(itemId));
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /* ----- mutations (each refreshes the detail + the list) ----- */

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "closed") => updateWorkProgram(id, { status }),
    onSuccess: (detail, status) => {
      cache.applyDetail(detail);
      toast.success(status === "closed" ? "Program ditutup." : "Program dibuka kembali.");
      setConfirm(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteProgramMutation = useMutation({
    mutationFn: () => deleteWorkProgram(id),
    onSuccess: () => {
      toast.success("Program dihapus.");
      cache.remove();
      router.replace("/programs");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (item: WorkProgramItem) => deleteWorkProgramItem(item.id),
    onSuccess: (detail, item) => {
      cache.applyDetail(detail);
      toast.success(`Sub-item ${item.code} dihapus.`);
      setConfirm(null);
      if (String(item.id) === itemParam) selectItem(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (activity: WorkProgramActivity) => deleteWorkProgramActivity(activity.id),
    onSuccess: (_, activity) => {
      cache.removeActivity(activity.id);
      if (activity.id === detailId) setDetailOpen(false);
      toast.success("Kegiatan dihapus.");
      setConfirm(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    return <LoadError error={query.error} onRetry={() => query.refetch()} entity="Program kerja" backHref="/programs" />;
  }

  const program = query.data;
  const items = [...program.items].sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
  const selectedItem = items.find((item) => String(item.id) === itemParam) ?? items[0] ?? null;
  const canManage = program.permissions.can_manage;
  const isActive = program.status === "active";
  const canAddActivity = program.permissions.can_add_activity;
  const confirmBusy =
    statusMutation.isPending || deleteProgramMutation.isPending || deleteItemMutation.isPending || deleteActivityMutation.isPending;

  const openAddActivity = () => setActivityDialog({ open: true });

  /* ----- activity dialogs: the detail dialog closes itself before handing over to edit / status / progress ----- */
  const openDetail = (activity: WorkProgramActivity) => {
    setDetailId(activity.id);
    setDetailOpen(true);
  };
  const openEdit = (activity: WorkProgramActivity) => {
    setDetailOpen(false);
    setActivityDialog({ open: true, activity });
  };
  const openStatus = (activity: WorkProgramActivity) => {
    setDetailOpen(false);
    setStatusTarget(activity);
  };
  const openProgress = (activity: WorkProgramActivity) => {
    setDetailOpen(false);
    setProgressTarget(activity);
  };

  const confirmProps = (() => {
    switch (confirm?.kind) {
      case "close":
        return {
          title: `Tutup program ${program.code}?`,
          description: "Setelah ditutup, kegiatan tidak dapat ditambahkan. Program masih bisa dibuka kembali.",
          confirmLabel: "Tutup Program",
          confirmVariant: "default" as const,
          onConfirm: () => statusMutation.mutate("closed"),
        };
      case "reopen":
        return {
          title: `Buka kembali program ${program.code}?`,
          description: "Program kembali aktif dan kegiatan dapat ditambahkan lagi.",
          confirmLabel: "Buka Kembali",
          confirmVariant: "default" as const,
          onConfirm: () => statusMutation.mutate("active"),
        };
      case "delete-program":
        return {
          title: `Hapus program "${program.title}"?`,
          description: "Seluruh sub-item dan kegiatannya ikut terhapus dari daftar. Tindakan ini tidak dapat dibatalkan.",
          confirmLabel: "Hapus Program",
          confirmVariant: "destructive" as const,
          onConfirm: () => deleteProgramMutation.mutate(),
        };
      case "delete-item":
        return {
          title: `Hapus sub-item ${confirm.item.code}?`,
          description: `"${confirm.item.title}" beserta ${confirm.item.activities_count} kegiatannya akan dihapus.`,
          confirmLabel: "Hapus Sub-Item",
          confirmVariant: "destructive" as const,
          onConfirm: () => deleteItemMutation.mutate(confirm.item),
        };
      case "delete-activity":
        return {
          title: "Hapus kegiatan ini?",
          description: `"${confirm.activity.title}" akan dihapus beserta riwayat statusnya.`,
          confirmLabel: "Hapus Kegiatan",
          confirmVariant: "destructive" as const,
          onConfirm: () => deleteActivityMutation.mutate(confirm.activity),
        };
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-2">
              Program Kerja
              <Badge variant="primary" className="font-mono uppercase tracking-wide">
                Kode {program.code}
              </Badge>
            </span>
            <ProgramYearSwitcher program={program} />
          </span>
        }
        title={
          <span className="flex flex-wrap items-center gap-2 uppercase">
            {program.title}
            <ProgramStatusBadge status={program.status} label={program.status_label} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {program.org_unit?.name ?? "-"}
            </span>
            <span className="tabular inline-flex items-center gap-1">
              <Layers3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {program.items_count} sub-item · {program.activities_count} kegiatan
            </span>
          </span>
        }
        backHref="/programs"
        backLabel="Daftar Program Kerja"
        actions={
          <>
            <Button asChild variant="outline">
              <a href={workProgramExportUrl(program.id)} download>
                <FileSpreadsheet />
                Export Excel
              </a>
            </Button>
            {canManage ? (
              <>
                <Button
                  onClick={() => setItemDialog({ open: true })}
                  disabled={!isActive}
                  title={isActive ? undefined : "Program sudah ditutup"}
                >
                  <Plus />
                  Tambah Sub-Item
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Tindakan lain untuk program">
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                      <Pencil aria-hidden />
                      Ubah program
                    </DropdownMenuItem>
                    {isActive ? (
                      <DropdownMenuItem onSelect={() => setConfirm({ kind: "close" })}>
                        <LockKeyhole aria-hidden />
                        Tutup program
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => setConfirm({ kind: "reopen" })}>
                        <LockKeyholeOpen aria-hidden />
                        Buka kembali
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setConfirm({ kind: "delete-program" })}
                      className="text-danger focus:text-danger"
                    >
                      <Trash2 aria-hidden />
                      Hapus program
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}
          </>
        }
      />

      {program.description ? (
        <p className="max-w-prose whitespace-pre-wrap break-words text-sm text-muted-foreground">{program.description}</p>
      ) : null}

      <ProgressSummary program={program} />

      {items.length === 0 ? (
        <EmptyState
          icon={<Layers3 className="h-5 w-5" aria-hidden />}
          title="Belum ada sub-item"
          description={
            canManage
              ? "Tambahkan sub-item (misalnya A.1 IT Development) lalu isi kegiatannya."
              : "Pimpinan unit belum menambahkan sub-item pada program ini."
          }
          action={
            canManage && isActive ? (
              <Button onClick={() => setItemDialog({ open: true })}>
                <Plus />
                Tambah Sub-Item
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <ItemTabs items={items} selectedId={selectedItem?.id ?? null} onSelect={selectItem} />

          {selectedItem ? (
            <section
              id={`program-item-panel-${selectedItem.id}`}
              role="tabpanel"
              aria-labelledby={`program-item-tab-${selectedItem.id}`}
              className="panel overflow-hidden"
            >
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0 flex-1">
                  <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold leading-tight tracking-tight">
                    <span className="font-mono text-sm text-primary">{selectedItem.code}</span>
                    <span>{selectedItem.title}</span>
                  </h2>
                  {selectedItem.description ? (
                    <p className="mt-1 max-w-prose whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {selectedItem.description}
                    </p>
                  ) : null}
                  <div className="mt-3 flex max-w-md items-center gap-3">
                    <ProgressBar value={selectedItem.progress_pct} label={`Progres sub-item ${selectedItem.code}`} className="flex-1" />
                    <span className="tabular text-xs font-semibold">{formatPct(selectedItem.progress_pct)}</span>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {canAddActivity ? (
                      <Button size="sm" onClick={openAddActivity}>
                        <Plus />
                        Tambah Kegiatan
                      </Button>
                    ) : null}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setItemDialog({ open: true, item: selectedItem })}
                      aria-label={`Ubah sub-item ${selectedItem.code}`}
                      title="Ubah sub-item"
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setConfirm({ kind: "delete-item", item: selectedItem })}
                      aria-label={`Hapus sub-item ${selectedItem.code}`}
                      title="Hapus sub-item"
                    >
                      <Trash2 className="text-danger" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </div>

              <ActivityTable
                item={selectedItem}
                emptyAction={
                  canAddActivity ? (
                    <Button size="sm" variant="soft" onClick={openAddActivity}>
                      <Plus />
                      Tambah Kegiatan
                    </Button>
                  ) : null
                }
                onDetail={openDetail}
                onEdit={openEdit}
                onStatus={openStatus}
                onProgress={openProgress}
                onDelete={(activity) => setConfirm({ kind: "delete-activity", activity })}
              />
            </section>
          ) : null}
        </>
      )}

      <ProgramHistory logs={program.logs} />

      {/* ----- dialogs ----- */}
      <ProgramFormDialog open={editOpen} onOpenChange={setEditOpen} program={program} />

      <ItemFormDialog
        open={itemDialog.open}
        onOpenChange={(open) => setItemDialog((state) => ({ ...state, open }))}
        programId={program.id}
        programCode={program.code}
        existingCodes={items.map((item) => item.code)}
        item={itemDialog.item}
        onSaved={(_detail, itemId) => {
          if (itemId !== null) selectItem(itemId);
        }}
      />

      {selectedItem ? (
        <ActivityFormDialog
          open={activityDialog.open}
          onOpenChange={(open) => setActivityDialog((state) => ({ ...state, open }))}
          programId={program.id}
          itemId={selectedItem.id}
          itemLabel={`${selectedItem.code} ${selectedItem.title}`}
          activity={activityDialog.activity}
        />
      ) : null}

      <ActivityDetailDialog
        activityId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        items={items}
        onEdit={openEdit}
        onStatus={openStatus}
        onProgress={openProgress}
      />

      <ActivityStatusDialog
        open={statusTarget !== null}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        programId={program.id}
        activity={statusTarget}
      />

      <ActivityProgressDialog
        open={progressTarget !== null}
        onOpenChange={(open) => !open && setProgressTarget(null)}
        programId={program.id}
        activity={progressTarget}
      />

      {confirmProps ? (
        <ConfirmDialog
          open={confirm !== null}
          onOpenChange={(open) => !open && setConfirm(null)}
          title={confirmProps.title}
          description={confirmProps.description}
          confirmLabel={confirmProps.confirmLabel}
          confirmVariant={confirmProps.confirmVariant}
          loading={confirmBusy}
          onConfirm={confirmProps.onConfirm}
        />
      ) : null}
    </div>
  );
}
