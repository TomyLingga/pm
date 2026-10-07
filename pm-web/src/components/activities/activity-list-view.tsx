"use client";

import * as React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, FileSpreadsheet, Plus, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ImportDialog } from "@/components/common/import-dialog";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { ScopeTabs } from "@/components/common/scope-tabs";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { errorMessage } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import {
  DAILY_ACTIVITY_IMPORT_PATH,
  DAILY_ACTIVITY_LIST_PREFIX,
  dailyActivityExportUrl,
  dailyActivityImportTemplateUrl,
  deleteDailyActivity,
  listDailyActivities,
} from "@/lib/daily-activities";
import { ACTIVITY_SCOPE_DESCRIPTIONS, ACTIVITY_SCOPE_LABELS } from "@/lib/daily-activity-constants";
import { queryKeys } from "@/lib/query-keys";
import type { DailyActivity, DailyActivityScope } from "@/types/daily-activity";
import { ActivityCards } from "./activity-cards";
import { ActivityDetailDialog } from "./activity-detail-dialog";
import { ActivityFilters } from "./activity-filters";
import { ActivityFormDialog } from "./activity-form-dialog";
import { ActivityStatusDialog } from "./activity-status-dialog";
import { ActivitySummary, ActivitySummarySkeleton } from "./activity-summary";
import { ActivityTable } from "./activity-table";
import { ALL_ACTIVITY_SCOPES, encodeStatusParam, useActivityListParams } from "./use-activity-list-params";

export const ACTIVITY_PAGE_TITLE = "Aktivitas Harian";
export const ACTIVITY_PAGE_DESCRIPTION = "Laporan kegiatan harian per orang, dikelompokkan per minggu dalam bulan.";

/** Column widths mirror `ActivityTable` so the skeleton does not jump when data arrives. */
const SKELETON_COLUMNS = [
  "w-[52px]",
  "w-[72px]",
  "min-w-0 flex-1",
  "w-[108px]",
  "w-[124px]",
  "w-[190px]",
  "w-[150px]",
  "w-[168px]",
] as const;

function TableRowSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b px-3 py-3 last:border-0">
      <div className={`${SKELETON_COLUMNS[0]} flex justify-end`}>
        <Skeleton className="h-3 w-5" />
      </div>
      <div className={SKELETON_COLUMNS[1]}>
        <Skeleton className="h-5 w-8" />
      </div>
      <div className={`${SKELETON_COLUMNS[2]} space-y-1.5`}>
        <Skeleton className="h-3.5 w-[70%]" />
        <Skeleton className="h-3 w-[90%]" />
        <Skeleton className="h-3 w-[55%]" />
      </div>
      <div className={SKELETON_COLUMNS[3]}>
        <Skeleton className="h-3 w-20" />
      </div>
      <div className={SKELETON_COLUMNS[4]}>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className={`${SKELETON_COLUMNS[5]} flex items-center gap-2`}>
        <Skeleton className="h-7 w-7 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className={SKELETON_COLUMNS[6]}>
        <Skeleton className="h-3 w-28" />
      </div>
      <div className={`${SKELETON_COLUMNS[7]} flex justify-end gap-1`}>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <li className="panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <div className="mt-3 space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-3.5 rounded-sm" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2 border-t pt-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
    </li>
  );
}

/** Skeleton shaped like the loaded list: summary tiles, then a table on desktop or cards on phones. */
export function ActivityListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      <ActivitySummarySkeleton />
      <div className="panel hidden overflow-hidden md:block">
        <div className="flex h-10 items-center gap-3 border-b bg-surface-2/70 px-3">
          {SKELETON_COLUMNS.map((width, index) => (
            <div key={index} className={width}>
              <Skeleton className="h-2.5 w-14" />
            </div>
          ))}
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <TableRowSkeleton key={index} />
        ))}
      </div>
      <ul className="space-y-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </ul>
    </div>
  );
}

export function ActivityListView() {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const params = useActivityListParams();
  const { scope, filters, apiParams, activeFilterCount, setFilters, setScope, setPage, resetFilters } = params;

  const query = useQuery({
    queryKey: queryKeys.dailyActivities(apiParams),
    queryFn: ({ signal }) => listDailyActivities(apiParams, signal),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.data ?? [];
  const meta = query.data?.meta;
  const hasFilters = activeFilterCount > 0 || !!filters.q;

  // Tabs come from the server; until the first answer, guess from the role so the layout does not jump.
  const fallbackScopes = React.useMemo<readonly DailyActivityScope[]>(
    () => (isAdmin(me) ? ALL_ACTIVITY_SCOPES : ["mine"]),
    [me],
  );
  const visibleScopes = meta?.available_scopes ?? fallbackScopes;
  const availableKey = meta?.available_scopes.join(",");
  React.useEffect(() => {
    // A scope the URL carries but the user may not see: fall back to the first allowed one.
    if (availableKey && !availableKey.split(",").includes(scope)) {
      setScope((availableKey.split(",")[0] as DailyActivityScope) ?? "mine");
    }
  }, [availableKey, scope, setScope]);

  const canReportForOthers = meta?.can_report_for_others ?? false;
  const admin = isAdmin(me);
  const canManage = React.useCallback(
    (item: DailyActivity) =>
      item.user.id === me.id || item.created_by?.id === me.id || canReportForOthers || admin,
    [admin, canReportForOthers, me.id],
  );

  /* ---------- Dialogs ---------- */
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<DailyActivity | null>(null);
  const [statusTarget, setStatusTarget] = React.useState<DailyActivity | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DailyActivity | null>(null);
  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const openDetail = (item: DailyActivity) => {
    setDetailId(item.id);
    setDetailOpen(true);
  };
  const openEdit = (item: DailyActivity) => {
    setDetailOpen(false);
    setEditTarget(item);
  };
  const openStatus = (item: DailyActivity) => {
    setDetailOpen(false);
    setStatusTarget(item);
  };
  const openDelete = (item: DailyActivity) => {
    setDetailOpen(false);
    setDeleteTarget(item);
  };

  const removal = useMutation({
    mutationFn: (item: DailyActivity) => deleteDailyActivity(item.id),
    onSuccess: (_, item) => {
      queryClient.removeQueries({ queryKey: queryKeys.dailyActivity(item.id) });
      void queryClient.invalidateQueries({ queryKey: DAILY_ACTIVITY_LIST_PREFIX });
      toast.success("Laporan aktivitas dihapus.");
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menghapus laporan aktivitas.")),
  });

  const actions = { onOpen: openDetail, onEdit: openEdit, onStatus: openStatus, onDelete: openDelete, canManage };

  const importHints = [
    "Kolom wajib: Tanggal (YYYY-MM-DD), Laporan Kegiatan, Uraian.",
    "Status: OPEN, ON PROGRESS, atau CLOSED (kosong = OPEN).",
    ...(canReportForOthers
      ? ["NRK PIC hanya untuk pimpinan yang mencatat atas nama bawahan; kosongkan untuk laporan sendiri."]
      : []),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={ACTIVITY_PAGE_TITLE}
        description={ACTIVITY_PAGE_DESCRIPTION}
        actions={
          // On phones Import/Export collapse to icon buttons (aria-label keeps the name); "Tambah" stays primary.
          <>
            <Button variant="outline" className="px-3 sm:px-4" aria-label="Import Excel" onClick={() => setImportOpen(true)}>
              <Upload />
              <span className="hidden sm:inline">Import Excel</span>
            </Button>
            <Button asChild variant="outline" className="px-3 sm:px-4">
              <a href={dailyActivityExportUrl(apiParams)} download aria-label="Export Excel">
                <FileSpreadsheet />
                <span className="hidden sm:inline">Export Excel</span>
              </a>
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={() => setCreateOpen(true)}>
              <Plus />
              Tambah Aktivitas
            </Button>
          </>
        }
      />

      <ScopeTabs
        scopes={visibleScopes}
        value={visibleScopes.includes(scope) ? scope : visibleScopes[0]}
        labels={ACTIVITY_SCOPE_LABELS}
        descriptions={ACTIVITY_SCOPE_DESCRIPTIONS}
        onChange={setScope}
        ariaLabel="Lingkup daftar aktivitas"
      />

      <ActivityFilters
        filters={filters}
        scope={scope}
        selectedStatuses={params.selectedStatuses}
        showPeriod={params.showPeriod}
        period={params.period}
        customPeriod={params.customPeriod}
        activeFilterCount={activeFilterCount}
        total={meta?.summary.total ?? meta?.total}
        onChange={setFilters}
        onReset={resetFilters}
      />

      {query.isPending ? (
        <ActivityListSkeleton />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <div
          className={query.isPlaceholderData ? "space-y-4 opacity-60 transition-opacity duration-150" : "space-y-4"}
          aria-busy={query.isPlaceholderData || undefined}
        >
          {meta ? (
            <ActivitySummary
              summary={meta.summary}
              selectedStatuses={params.selectedStatuses}
              onStatusChange={(status) => setFilters({ status: encodeStatusParam(status ? [status] : []) })}
            />
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck2 className="h-5 w-5" aria-hidden />}
              title={hasFilters ? "Tidak ada laporan yang cocok" : "Belum ada laporan yang berjalan"}
              description={
                hasFilters
                  ? "Coba ubah status, minggu, atau reset filter."
                  : scope === "mine"
                    ? "Laporan open dan on progress yang Anda catat akan tampil di sini. Laporan closed bisa dilihat lewat filter status."
                    : "Belum ada laporan open atau on progress di lingkup ini. Laporan closed bisa dilihat lewat filter status."
              }
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={resetFilters}>
                    Reset filter
                  </Button>
                ) : (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus />
                    Tambah Aktivitas
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="panel hidden overflow-hidden md:block">
                <ActivityTable items={items} startNumber={meta?.from ?? 1} {...actions} />
              </div>
              <div className="md:hidden">
                <ActivityCards items={items} {...actions} />
              </div>
            </>
          )}
        </div>
      )}

      {meta && items.length > 0 ? (
        <Pagination meta={meta} onPageChange={setPage} itemLabel="laporan" disabled={query.isFetching} />
      ) : null}

      <ActivityFormDialog open={createOpen} onOpenChange={setCreateOpen} canReportForOthers={canReportForOthers} />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Aktivitas Harian"
        description="Tambahkan banyak laporan aktivitas harian sekaligus dari file Excel."
        templateUrl={dailyActivityImportTemplateUrl()}
        uploadPath={DAILY_ACTIVITY_IMPORT_PATH}
        hints={importHints}
        onImported={() => void queryClient.invalidateQueries({ queryKey: DAILY_ACTIVITY_LIST_PREFIX })}
        idPrefix="activity-import"
      />

      <ActivityFormDialog
        key={editTarget?.id ?? "edit"}
        activity={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      />

      <ActivityStatusDialog
        activity={statusTarget}
        open={statusTarget !== null}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null);
        }}
      />

      <ActivityDetailDialog
        activityId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
        onStatus={openStatus}
        onDelete={openDelete}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removal.isPending) setDeleteTarget(null);
        }}
        title="Hapus laporan aktivitas?"
        description={
          deleteTarget ? (
            <>
              Laporan <span className="font-medium text-foreground">{deleteTarget.title}</span> tanggal{" "}
              <span className="tabular">{deleteTarget.activity_date}</span> akan dihapus. Tindakan ini tidak bisa
              dibatalkan.
            </>
          ) : undefined
        }
        confirmLabel="Hapus Laporan"
        confirmVariant="destructive"
        loading={removal.isPending}
        onConfirm={() => deleteTarget && removal.mutate(deleteTarget)}
      />
    </div>
  );
}
