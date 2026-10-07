"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight, Layers3, ListTodo, Plus, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { SearchBox } from "@/components/common/search-box";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUrlListState } from "@/hooks/use-url-list-state";
import { errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { listWorkPrograms } from "@/lib/work-programs";
import type { WorkProgramListItem, WorkProgramListParams } from "@/types/work-program";
import { ProgramFormDialog } from "./program-form-dialog";
import { ProgramStatusBadge, ProgressBar, ProgressRing, StatusCountList } from "./program-badges";

const FILTER_KEYS = ["year", "org_unit_id", "status", "q"] as const;
const SCOPES = ["list"] as const;

/** Placeholder shaped like the programme cards. */
function ListSkeleton() {
  return (
    <ul className="grid gap-4 xl:grid-cols-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <li key={index} className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-[72px] w-[72px] shrink-0 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
        </li>
      ))}
    </ul>
  );
}

function ProgramCard({ program }: { program: WorkProgramListItem }) {
  return (
    <li>
      <Link
        href={`/programs/${program.id}`}
        className="panel group block p-4 transition-colors duration-150 hover:bg-surface-2/60 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary" className="font-mono uppercase tracking-wide">
                Program {program.code}
              </Badge>
              <ProgramStatusBadge status={program.status} label={program.status_label} />
            </div>
            <h2 className="mt-2 text-base font-semibold uppercase leading-snug tracking-tight text-foreground group-hover:text-primary">
              {program.title}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{program.org_unit?.name ?? "-"}</span>
              </span>
              <span className="tabular inline-flex items-center gap-1">
                <Layers3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {program.items_count} sub-item · {program.activities_count} kegiatan
              </span>
            </p>
            <StatusCountList counts={program.counts} className="mt-3" />
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <ProgressRing value={program.progress_pct} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Capaian</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <ProgressBar value={program.progress_pct} label={`Progres program ${program.code}`} className="flex-1" />
          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      </Link>
    </li>
  );
}

export function ProgramListView() {
  const router = useRouter();
  const { filters, activeFilterCount, setFilters, resetFilters } = useUrlListState(FILTER_KEYS, SCOPES);
  const [createOpen, setCreateOpen] = React.useState(false);

  const params: WorkProgramListParams = React.useMemo(
    () => ({
      year: filters.year || undefined,
      org_unit_id: filters.org_unit_id || undefined,
      status: filters.status || undefined,
      q: filters.q || undefined,
    }),
    [filters],
  );

  const query = useQuery({
    queryKey: queryKeys.workPrograms(params),
    queryFn: ({ signal }) => listWorkPrograms(params, signal),
    placeholderData: keepPreviousData,
  });

  const programs = React.useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;
  const hasFilters = activeFilterCount > 0 || !!filters.q;
  const canCreate = meta?.can_create ?? false;

  // Year shown in the selector: the URL's, else the server's default. Keep an unknown URL year selectable.
  const selectedYear = filters.year || (meta ? String(meta.year) : "");
  const years = React.useMemo(() => {
    const list = (meta?.years ?? []).map(String);
    if (selectedYear && !list.includes(selectedYear)) list.unshift(selectedYear);
    return list;
  }, [meta?.years, selectedYear]);

  const totals = React.useMemo(
    () =>
      programs.reduce(
        (acc, program) => {
          acc.activities += program.activities_count;
          acc.closed += program.counts.closed;
          return acc;
        },
        { activities: 0, closed: 0 },
      ),
    [programs],
  );

  const createButton = canCreate ? (
    <Button onClick={() => setCreateOpen(true)}>
      <Plus />
      Buat Program
    </Button>
  ) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Program Kerja Tahunan"
        description="Program kerja unit organisasi per tahun, lengkap dengan sub-item, kegiatan, PIC, dan capaian progresnya."
        actions={createButton ?? undefined}
      />

      <div className="panel grid gap-3 p-4 sm:grid-cols-2 sm:items-end sm:p-5 lg:grid-cols-[minmax(0,1fr)_8rem_14rem_9rem_auto]">
        <div className="sm:col-span-2 lg:col-span-1">
          <SearchBox value={filters.q} onCommit={(q) => setFilters({ q })} placeholder="Cari judul program…" />
        </div>
        <Field label="Tahun" htmlFor="program-filter-year">
          <Select
            id="program-filter-year"
            value={selectedYear}
            onChange={(event) => setFilters({ year: event.target.value, org_unit_id: "" })}
            disabled={!meta}
            className="tabular"
          >
            {years.length === 0 ? <option value="">…</option> : null}
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit organisasi" htmlFor="program-filter-unit">
          <Select
            id="program-filter-unit"
            value={filters.org_unit_id}
            onChange={(event) => setFilters({ org_unit_id: event.target.value })}
            disabled={!meta}
          >
            <option value="">Semua unit</option>
            {(meta?.org_units ?? []).map((unit) => (
              <option key={unit.id} value={String(unit.id)}>
                {unit.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="program-filter-status">
          <Select
            id="program-filter-status"
            value={filters.status}
            onChange={(event) => setFilters({ status: event.target.value })}
          >
            <option value="">Semua</option>
            <option value="active">Aktif</option>
            <option value="closed">Ditutup</option>
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
      ) : programs.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-5 w-5" aria-hidden />}
          title={hasFilters ? "Tidak ada program yang cocok" : `Belum ada program kerja ${meta?.year ?? ""}`.trim()}
          description={
            hasFilters
              ? "Coba ubah tahun, unit, atau reset filter."
              : canCreate
                ? "Buat program kerja pertama untuk unit Anda, lalu tambahkan sub-item dan kegiatannya."
                : "Program kerja dibuat oleh pimpinan unit. Program unit Anda dan unit di atasnya akan tampil di sini."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                Reset filter
              </Button>
            ) : (
              createButton
            )
          }
        />
      ) : (
        <div className={cn("space-y-3 transition-opacity duration-150", query.isPlaceholderData && "opacity-60")}>
          <p className="tabular text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{programs.length}</span> program tahun{" "}
            <span className="font-medium text-foreground">{meta?.year}</span> ·{" "}
            <span className="font-medium text-foreground">{totals.activities}</span> kegiatan,{" "}
            <span className="font-medium text-foreground">{totals.closed}</span> selesai
          </p>
          <ul className="grid gap-4 xl:grid-cols-2">
            {programs.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </ul>
        </div>
      )}

      <ProgramFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultYear={meta?.year}
        onSaved={(detail) => router.push(`/programs/${detail.id}`)}
      />
    </div>
  );
}
