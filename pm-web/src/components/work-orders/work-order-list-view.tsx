"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Plus } from "lucide-react";
import { useCurrentUser } from "@/components/layout/current-user";
import { Pagination } from "@/components/common/pagination";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api";
import { hasGlobalRole, isExecutorStaff } from "@/lib/auth";
import { SCOPE_LABELS } from "@/lib/constants";
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
  if (hasGlobalRole(me, "admin", "management")) scopes.push("all");
  return scopes;
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Work Order</h1>
          <p className="text-sm text-muted-foreground">Permintaan perbaikan &amp; dukungan ke unit pelaksana.</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      <Tabs value={scope} onValueChange={(value) => setScope(value as WorkOrderScope)}>
        <TabsList className="w-full justify-start sm:w-auto">
          {scopes.map((item) => (
            <TabsTrigger key={item} value={item}>
              {SCOPE_LABELS[item]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <WorkOrderFilters
        filters={filters}
        activeFilterCount={activeFilterCount}
        onChange={setFilters}
        onReset={resetFilters}
      />

      {query.isPending ? (
        <ListSkeleton />
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
        <div className={query.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <div className="hidden overflow-hidden rounded-lg border bg-card shadow-sm md:block">
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
