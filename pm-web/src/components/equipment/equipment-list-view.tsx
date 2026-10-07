"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cog, MapPin, Plus, RotateCcw, Upload, Wrench } from "lucide-react";
import { ImportDialog } from "@/components/common/import-dialog";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { SearchBox } from "@/components/common/search-box";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { EquipmentStatusBadge } from "@/components/pm/pm-badges";
import { usePmUnits } from "@/components/pm/use-pm-units";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlListState } from "@/hooks/use-url-list-state";
import { errorMessage } from "@/lib/api";
import { canManagePm } from "@/lib/auth";
import { EQUIPMENT_STATUS_OPTIONS } from "@/lib/pm-constants";
import { equipmentImportTemplateUrl, listEquipment } from "@/lib/pm-equipment";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { EquipmentListParams } from "@/types/pm";
import { EquipmentFormDialog } from "./equipment-form-dialog";

const FILTER_KEYS = ["executor_unit_id", "status", "q"] as const;
const SCOPES = ["list"] as const;

/** Shown above the file input of the import dialog. */
const IMPORT_HINTS = [
  "Kolom wajib: No. Alat dan Nama Alat.",
  "No. Alat yang sudah ada akan diperbarui, yang baru ditambahkan.",
  "Kode Lokasi dan Kode Unit Pelaksana ada di sheet Lokasi dan Unit Pelaksana pada template.",
  "Hanya untuk unit pelaksana yang Anda pimpin.",
];

/** Placeholder shaped like the table (desktop) and the cards (phones). */
function ListSkeleton() {
  return (
    <div aria-hidden>
      <div className="panel hidden overflow-hidden md:block">
        <div className="h-10 border-b bg-surface-2/70" />
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[130px_minmax(0,1fr)_180px_180px_180px_140px] items-center gap-3 px-3 py-3"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <ul className="space-y-3 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <li key={index} className="panel space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-40" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EquipmentListView() {
  const me = useCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { units } = usePmUnits();
  const { filters, page, activeFilterCount, setFilters, setPage, resetFilters } = useUrlListState(FILTER_KEYS, SCOPES);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  const params: EquipmentListParams = React.useMemo(
    () => ({
      q: filters.q || undefined,
      executor_unit_id: filters.executor_unit_id || undefined,
      status: filters.status || undefined,
      page,
      per_page: 20,
    }),
    [filters, page],
  );

  const query = useQuery({
    queryKey: queryKeys.equipmentList(params),
    queryFn: ({ signal }) => listEquipment(params, signal),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.data ?? [];
  const meta = query.data?.meta;
  const hasFilters = activeFilterCount > 0 || !!filters.q;
  const canCreate = canManagePm(me);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Equipment"
        description="Master alat/aset beserta riwayat maintenance (PM dan Work Order)."
        actions={
          canCreate ? (
            <>
              {/* Icon-only on phones, label from sm: up; aria-label keeps the name. */}
              <Button
                variant="outline"
                className="px-3 sm:px-4"
                onClick={() => setImportOpen(true)}
                aria-label="Import Excel"
              >
                <Upload />
                <span className="hidden sm:inline">Import Excel</span>
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                Tambah Equipment
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_12rem_11rem_auto] sm:items-end sm:p-5">
        <SearchBox value={filters.q} onCommit={(q) => setFilters({ q })} placeholder="Cari kode atau nama equipment…" />
        <Field label="Unit pelaksana" htmlFor="equipment-filter-unit">
          <Select
            id="equipment-filter-unit"
            value={filters.executor_unit_id}
            onChange={(event) => setFilters({ executor_unit_id: event.target.value })}
          >
            <option value="">Semua</option>
            {units.map((unit) => (
              <option key={unit.id} value={String(unit.id)}>
                {unit.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="equipment-filter-status">
          <Select
            id="equipment-filter-status"
            value={filters.status}
            onChange={(event) => setFilters({ status: event.target.value })}
          >
            <option value="">Semua</option>
            {EQUIPMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="ghost" onClick={resetFilters} disabled={!hasFilters}>
          <RotateCcw />
          Reset
        </Button>
      </div>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Cog className="h-5 w-5" aria-hidden />}
          title={hasFilters ? "Tidak ada equipment yang cocok" : "Belum ada equipment"}
          description={
            hasFilters
              ? "Coba ubah atau reset filter."
              : canCreate
                ? "Tambahkan equipment satu per satu atau import dari Excel."
                : "Tambahkan equipment agar bisa dijadwalkan PM."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                Reset filter
              </Button>
            ) : canCreate ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus />
                  Tambah Equipment
                </Button>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload />
                  Import Excel
                </Button>
              </div>
            ) : null
          }
        />
      ) : (
        <div className={cn("transition-opacity duration-150", query.isPlaceholderData && "opacity-60")}>
          {/* Desktop */}
          <div className="panel hidden overflow-hidden md:block">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[130px]">Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-[180px]">Lokasi</TableHead>
                  <TableHead className="w-[180px]">Unit pelaksana</TableHead>
                  <TableHead className="w-[180px]">Merk / model</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((equipment) => {
                  const href = `/equipment/${equipment.id}`;
                  return (
                    <TableRow key={equipment.id} className="cursor-pointer" onClick={() => router.push(href)}>
                      <TableCell>
                        <Link
                          href={href}
                          className="rounded-sm font-mono text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {equipment.code ?? "-"}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{equipment.name}</TableCell>
                      <TableCell className="text-sm">{equipment.location?.name ?? "-"}</TableCell>
                      <TableCell className="text-sm">{equipment.executor_unit?.display_name ?? "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[equipment.brand, equipment.model].filter(Boolean).join(" ") || "-"}
                      </TableCell>
                      <TableCell>
                        <EquipmentStatusBadge status={equipment.status} label={equipment.status_label} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <ul className="space-y-3 md:hidden">
            {items.map((equipment) => (
              <li key={equipment.id}>
                <Link
                  href={`/equipment/${equipment.id}`}
                  className="panel block p-4 transition-colors duration-150 hover:bg-surface-2/60 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{equipment.code ?? "-"}</span>
                    <EquipmentStatusBadge status={equipment.status} label={equipment.status_label} className="shrink-0" />
                  </div>
                  <p className="mt-1.5 text-sm font-semibold">{equipment.name}</p>
                  <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">{equipment.location?.name ?? "Lokasi belum diisi"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">{equipment.executor_unit?.display_name ?? "Tanpa unit"}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {meta && items.length > 0 ? (
        <Pagination meta={meta} onPageChange={setPage} itemLabel="equipment" disabled={query.isFetching} />
      ) : null}

      <EquipmentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(equipment) => router.push(`/equipment/${equipment.id}`)}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Equipment"
        description="Tambah atau perbarui banyak equipment sekaligus dari file Excel."
        templateUrl={equipmentImportTemplateUrl()}
        uploadPath="/equipment/import"
        hints={IMPORT_HINTS}
        onImported={() => {
          // Import can create and update rows, so refresh every equipment query (list, detail, lookups).
          void queryClient.invalidateQueries({ queryKey: queryKeys.equipmentAll });
        }}
        idPrefix="equipment-import"
      />
    </div>
  );
}
