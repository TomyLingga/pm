"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { ScopeTabs } from "@/components/common/scope-tabs";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useExecutorUnits } from "@/hooks/use-lookups";
import { errorMessage } from "@/lib/api";
import { isAdmin, isExecutorStaff } from "@/lib/auth";
import { PM_SCOPE_DESCRIPTIONS, PM_SCOPE_LABELS } from "@/lib/pm-constants";
import { listPmTasks, pmTaskExportUrl } from "@/lib/pm-tasks";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { Me } from "@/types/auth";
import type { PmTaskScope, UnitRef } from "@/types/pm";
import { TaskCards } from "./task-cards";
import { TaskFilters } from "./task-filters";
import { TaskTable } from "./task-table";
import { useTaskListParams } from "./use-task-list-params";

/** "Tugas Saya"/"Unit Saya" need a unit membership; "Semua" is for admin. */
function scopesFor(me: Me): PmTaskScope[] {
  const scopes: PmTaskScope[] = [];
  if (isExecutorStaff(me)) scopes.push("mine", "unit");
  if (isAdmin(me)) scopes.push("all");
  return scopes.length ? scopes : ["mine"];
}

/** Placeholder shaped like the list: table rows on desktop, cards on phones. */
export function TaskListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden>
      <div className="panel hidden overflow-hidden md:block">
        <div className="flex h-10 items-center gap-6 border-b bg-surface-2/70 px-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="ml-auto h-3 w-24" />
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-6 border-b px-3 py-3 last:border-0">
            <Skeleton className="h-4 w-24" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
      <ul className="space-y-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, index) => (
          <li key={index} className="panel space-y-3 p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TaskListView() {
  const me = useCurrentUser();
  const scopes = React.useMemo(() => scopesFor(me), [me]);
  const { scope, filters, apiParams, activeFilterCount, setFilters, setScope, setPage, resetFilters } =
    useTaskListParams(scopes);

  const allUnits = useExecutorUnits("work_order");
  const units: UnitRef[] = scope === "all" ? allUnits.data ?? [] : me.executor_units;

  const query = useQuery({
    queryKey: queryKeys.pmTaskList(apiParams),
    queryFn: ({ signal }) => listPmTasks(apiParams, signal),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.data ?? [];
  const meta = query.data?.meta;
  const hasFilters = activeFilterCount > 0 || !!filters.q;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tugas PM"
        description="Tugas preventive maintenance yang digenerate dari jadwal."
        actions={
          <>
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <Link href="/pm/calendar">
                <CalendarDays />
                Kalender
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <a href={pmTaskExportUrl(apiParams)} download>
                <FileSpreadsheet />
                Export Excel
              </a>
            </Button>
          </>
        }
      />

      {scopes.length > 1 ? (
        <ScopeTabs
          scopes={scopes}
          value={scope}
          labels={PM_SCOPE_LABELS}
          descriptions={PM_SCOPE_DESCRIPTIONS}
          onChange={setScope}
          ariaLabel="Lingkup daftar tugas PM"
        />
      ) : null}

      <TaskFilters
        filters={filters}
        activeFilterCount={activeFilterCount}
        units={units}
        onChange={setFilters}
        onReset={resetFilters}
      />

      {query.isPending ? (
        <TaskListSkeleton />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Tidak ada tugas PM yang cocok" : "Belum ada tugas PM"}
          description={
            hasFilters
              ? "Tidak ada tugas dengan status/filter ini. Coba ubah atau reset filter."
              : "Tugas muncul otomatis setelah jadwal PM dibuat."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                Tampilkan semua tugas
              </Button>
            ) : null
          }
        />
      ) : (
        <div
          className={cn("transition-opacity duration-150", query.isPlaceholderData && "opacity-60")}
          aria-busy={query.isPlaceholderData || undefined}
        >
          <div className="panel hidden overflow-hidden md:block">
            <TaskTable items={items} />
          </div>
          <div className="md:hidden">
            <TaskCards items={items} />
          </div>
        </div>
      )}

      {meta && items.length > 0 ? (
        <Pagination meta={meta} onPageChange={setPage} itemLabel="tugas" disabled={query.isFetching} />
      ) : null}
    </div>
  );
}
