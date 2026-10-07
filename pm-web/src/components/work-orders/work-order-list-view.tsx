"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Plus } from "lucide-react";
import { useCurrentUser } from "@/components/layout/current-user";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { ScopeTabs } from "@/components/common/scope-tabs";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { isAdmin, isExecutorStaff } from "@/lib/auth";
import { SCOPE_DESCRIPTIONS, SCOPE_LABELS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { listWorkOrders, workOrderExportUrl } from "@/lib/work-orders";
import type { Me } from "@/types/auth";
import type { WorkOrderScope } from "@/types/work-order";
import { useWorkOrderListParams } from "./use-list-params";
import { WorkOrderCards } from "./work-order-cards";
import { WorkOrderFilters } from "./work-order-filters";
import { WorkOrderTable } from "./work-order-table";

function scopesFor(me: Me): WorkOrderScope[] {
  const scopes: WorkOrderScope[] = ["mine", "unit"];
  if (isExecutorStaff(me)) scopes.push("pool", "assigned", "executor");
  if (isAdmin(me)) scopes.push("all");
  return scopes;
}

/** Column widths mirror `WorkOrderTable` so the skeleton does not jump when data arrives. */
const SKELETON_COLUMNS = [
  "w-[170px]",
  "w-[120px]",
  "min-w-0 flex-1",
  "w-[170px]",
  "w-[170px]",
  "w-[100px]",
  "w-[120px]",
  "w-[160px]",
] as const;

function TableRowSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b px-3 py-3 last:border-0">
      <div className={SKELETON_COLUMNS[0]}>
        <Skeleton className="h-3.5 w-28" />
      </div>
      <div className={SKELETON_COLUMNS[1]}>
        <Skeleton className="h-3 w-24" />
      </div>
      <div className={`${SKELETON_COLUMNS[2]} space-y-1.5`}>
        <Skeleton className="h-3.5 w-[85%]" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className={`${SKELETON_COLUMNS[3]} space-y-1.5`}>
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className={`${SKELETON_COLUMNS[4]} space-y-1.5`}>
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className={SKELETON_COLUMNS[5]}>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className={SKELETON_COLUMNS[6]}>
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className={`${SKELETON_COLUMNS[7]} space-y-1.5`}>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <li className="panel p-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
      <div className="mt-3 space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-3.5 rounded-sm" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-3 h-5 w-20 rounded-full" />
    </li>
  );
}

/** Skeleton shaped like the list: a table on desktop, cards on phones. */
export function WorkOrderListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden>
      <div className="panel hidden overflow-hidden md:block">
        <div className="flex h-10 items-center gap-3 border-b bg-surface-2/70 px-3">
          {SKELETON_COLUMNS.map((width, index) => (
            <div key={index} className={width}>
              <Skeleton className="h-2.5 w-16" />
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

export function WorkOrderListView() {
  const me = useCurrentUser();
  const scopes = React.useMemo(() => scopesFor(me), [me]);
  const { scope, filters, apiParams, activeFilterCount, setFilters, setScope, setPage, resetFilters } =
    useWorkOrderListParams(scopes);

  const query = useQuery({
    queryKey: queryKeys.workOrderList(apiParams),
    queryFn: ({ signal }) => listWorkOrders(apiParams, signal),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.data ?? [];
  const meta = query.data?.meta;
  const hasFilters = activeFilterCount > 0 || !!filters.q;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Work Order"
        description="Permintaan perbaikan & dukungan ke unit pelaksana."
        actions={
          <>
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <a href={workOrderExportUrl(apiParams)} download>
                <FileSpreadsheet />
                Export Excel
              </a>
            </Button>
            <Button asChild className="flex-1 sm:flex-none">
              <Link href="/work-orders/new">
                <Plus />
                Buat WO
              </Link>
            </Button>
          </>
        }
      />

      <ScopeTabs
        scopes={scopes}
        value={scope}
        labels={SCOPE_LABELS}
        descriptions={SCOPE_DESCRIPTIONS}
        onChange={setScope}
        ariaLabel="Lingkup daftar Work Order"
      />

      <WorkOrderFilters
        filters={filters}
        activeFilterCount={activeFilterCount}
        onChange={setFilters}
        onReset={resetFilters}
      />

      {query.isPending ? (
        <WorkOrderListSkeleton />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Tidak ada WO yang cocok" : "Belum ada Work Order"}
          description={
            hasFilters
              ? "Coba ubah atau reset filter pencarian."
              : scope === "mine"
                ? "Work Order yang Anda ajukan akan tampil di sini."
                : "Belum ada Work Order pada tab ini."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                Reset filter
              </Button>
            ) : scope === "mine" ? (
              <Button asChild>
                <Link href="/work-orders/new">
                  <Plus />
                  Buat WO
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div
          className={query.isPlaceholderData ? "opacity-60 transition-opacity duration-150" : undefined}
          aria-busy={query.isPlaceholderData || undefined}
        >
          <div className="panel hidden overflow-hidden md:block">
            <WorkOrderTable items={items} />
          </div>
          <div className="md:hidden">
            <WorkOrderCards items={items} />
          </div>
        </div>
      )}

      {meta && items.length > 0 ? (
        <Pagination meta={meta} onPageChange={setPage} itemLabel="WO" disabled={query.isFetching} />
      ) : null}
    </div>
  );
}
