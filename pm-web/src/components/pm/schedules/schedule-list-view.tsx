"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarClock, Plus, Repeat, RotateCcw, UserRound } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { SearchBox } from "@/components/common/search-box";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlListState } from "@/hooks/use-url-list-state";
import { errorMessage } from "@/lib/api";
import { canManagePm } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { listPmSchedules } from "@/lib/pm-schedules";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { PmScheduleListItem, PmScheduleListParams } from "@/types/pm";
import { ActiveBadge } from "../pm-badges";
import { usePmUnits } from "../use-pm-units";

const FILTER_KEYS = ["executor_unit_id", "active", "q"] as const;
const SCOPES = ["list"] as const;

function equipmentSummary(schedule: PmScheduleListItem): string {
  const names = schedule.equipment.slice(0, 2).map((item) => item.code ?? item.name);
  const rest = schedule.equipment_count - names.length;
  return `${names.join(", ")}${rest > 0 ? ` +${rest} lainnya` : ""}`;
}

/** Placeholder shaped like the table (desktop) and the cards (phones). */
function ListSkeleton() {
  return (
    <div aria-hidden>
      <div className="panel hidden overflow-hidden md:block">
        <div className="h-10 border-b bg-surface-2/70" />
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_150px_200px_170px_150px_100px] items-center gap-3 px-3 py-3"
            >
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-4 w-20" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <ul className="space-y-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="panel space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-56" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScheduleListView() {
  const me = useCurrentUser();
  const router = useRouter();
  const { units } = usePmUnits();
  const { filters, page, activeFilterCount, setFilters, setPage, resetFilters } = useUrlListState(FILTER_KEYS, SCOPES);

  const params: PmScheduleListParams = React.useMemo(
    () => ({
      executor_unit_id: filters.executor_unit_id || undefined,
      active: filters.active || undefined,
      q: filters.q || undefined,
      page,
    }),
    [filters, page],
  );

  const query = useQuery({
    queryKey: queryKeys.pmScheduleList(params),
    queryFn: ({ signal }) => listPmSchedules(params, signal),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.data ?? [];
  const meta = query.data?.meta;
  const hasFilters = activeFilterCount > 0 || !!filters.q;
  const canCreate = canManagePm(me);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Jadwal PM"
        description="Jadwal preventive maintenance berulang. Tugas PM digenerate otomatis dari jadwal aktif."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/pm/schedules/new">
                <Plus />
                Buat Jadwal
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_12rem_10rem_auto] sm:items-end sm:p-5">
        <SearchBox value={filters.q} onCommit={(q) => setFilters({ q })} placeholder="Cari nama jadwal…" />
        <Field label="Unit pelaksana" htmlFor="schedule-filter-unit">
          <Select
            id="schedule-filter-unit"
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
        <Field label="Status jadwal" htmlFor="schedule-filter-active">
          <Select
            id="schedule-filter-active"
            value={filters.active}
            onChange={(event) => setFilters({ active: event.target.value })}
          >
            <option value="">Semua</option>
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
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
          icon={<CalendarClock className="h-5 w-5" aria-hidden />}
          title={hasFilters ? "Tidak ada jadwal yang cocok" : "Belum ada jadwal PM"}
          description={
            hasFilters
              ? "Coba ubah atau reset filter."
              : "Buat jadwal untuk men-generate tugas PM secara otomatis."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                Reset filter
              </Button>
            ) : canCreate ? (
              <Button asChild>
                <Link href="/pm/schedules/new">
                  <Plus />
                  Buat Jadwal
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className={cn("transition-opacity duration-150", query.isPlaceholderData && "opacity-60")}>
          {/* Desktop */}
          <div className="panel hidden overflow-hidden md:block">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Jadwal</TableHead>
                  <TableHead className="w-[150px]">Frekuensi</TableHead>
                  <TableHead className="w-[200px]">Equipment</TableHead>
                  <TableHead className="w-[170px]">PIC</TableHead>
                  <TableHead className="w-[150px]">Jatuh tempo berikutnya</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((schedule) => {
                  const href = `/pm/schedules/${schedule.id}`;
                  return (
                    <TableRow key={schedule.id} className="cursor-pointer" onClick={() => router.push(href)}>
                      <TableCell>
                        <Link
                          href={href}
                          className="rounded-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {schedule.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {schedule.executor_unit.display_name} &middot; {schedule.checklist_template.name}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{schedule.frequency_label}</TableCell>
                      <TableCell>
                        <p className="tabular text-sm font-medium">{schedule.equipment_count} equipment</p>
                        <p className="truncate text-xs text-muted-foreground">{equipmentSummary(schedule)}</p>
                      </TableCell>
                      <TableCell className="text-sm">{schedule.pic?.name ?? "-"}</TableCell>
                      <TableCell className="tabular whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(schedule.next_due_at)}
                      </TableCell>
                      <TableCell>
                        <ActiveBadge active={schedule.is_active} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <ul className="space-y-3 md:hidden">
            {items.map((schedule) => (
              <li key={schedule.id}>
                <Link
                  href={`/pm/schedules/${schedule.id}`}
                  className="panel block p-4 transition-colors duration-150 hover:bg-surface-2/60 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-semibold text-primary">{schedule.name}</p>
                    <ActiveBadge active={schedule.is_active} className="shrink-0" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {schedule.executor_unit.display_name} &middot; {schedule.checklist_template.name}
                  </p>
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="tabular">
                        {schedule.frequency_label} &middot; {schedule.equipment_count} equipment
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">{schedule.pic?.name ?? "Belum ada PIC"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="tabular">Berikutnya: {formatDateTime(schedule.next_due_at)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {meta && items.length > 0 ? (
        <Pagination meta={meta} onPageChange={setPage} itemLabel="jadwal" disabled={query.isFetching} />
      ) : null}
    </div>
  );
}
