"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Plus } from "lucide-react";
import { Pagination } from "@/components/common/pagination";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api";
import { hasGlobalRole, isExecutorStaff } from "@/lib/auth";
import { SR_SCOPE_LABELS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { listServiceRequests, serviceRequestExportUrl } from "@/lib/service-requests";
import type { Me } from "@/types/auth";
import type { ServiceRequestScope } from "@/types/service-request";
import { RequestCards } from "./request-cards";
import { RequestFilters } from "./request-filters";
import { RequestTable } from "./request-table";
import { useRequestListParams } from "./use-request-list-params";

function scopesFor(me: Me): ServiceRequestScope[] {
  const scopes: ServiceRequestScope[] = ["mine", "unit"];
  if (isExecutorStaff(me)) scopes.push("executor");
  if (hasGlobalRole(me, "admin", "management")) scopes.push("all");
  return scopes;
}

export function RequestListView() {
  const me = useCurrentUser();
  const scopes = React.useMemo(() => scopesFor(me), [me]);
  const { scope, filters, apiParams, activeFilterCount, setFilters, setScope, setPage, resetFilters } =
    useRequestListParams(scopes);

  const query = useQuery({
    queryKey: queryKeys.serviceRequestList(apiParams),
    queryFn: ({ signal }) => listServiceRequests(apiParams, signal),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.data ?? [];
  const meta = query.data?.meta;
  const hasFilters = activeFilterCount > 0 || !!filters.q;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Form Request</h1>
          <p className="text-sm text-muted-foreground">Permintaan yang membutuhkan biaya atau persetujuan atasan.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1 sm:flex-none">
            <a href={serviceRequestExportUrl(apiParams)} download>
              <FileSpreadsheet />
              Export Excel
            </a>
          </Button>
          <Button asChild className="flex-1 sm:flex-none">
            <Link href="/requests/new">
              <Plus />
              Buat Request
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={scope} onValueChange={(value) => setScope(value as ServiceRequestScope)}>
        <TabsList className="w-full justify-start sm:w-auto">
          {scopes.map((item) => (
            <TabsTrigger key={item} value={item}>
              {SR_SCOPE_LABELS[item]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <RequestFilters
        filters={filters}
        activeFilterCount={activeFilterCount}
        onChange={setFilters}
        onReset={resetFilters}
      />

      {query.isPending ? (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Tidak ada Form Request yang cocok" : "Belum ada Form Request"}
          description={
            hasFilters
              ? "Coba ubah atau reset filter pencarian."
              : scope === "mine"
                ? "Form Request yang Anda buat akan tampil di sini."
                : "Belum ada Form Request pada tab ini."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                Reset filter
              </Button>
            ) : scope === "mine" ? (
              <Button asChild>
                <Link href="/requests/new">
                  <Plus />
                  Buat Request
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className={query.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <div className="hidden overflow-hidden rounded-lg border bg-card shadow-sm md:block">
            <RequestTable items={items} />
          </div>
          <div className="md:hidden">
            <RequestCards items={items} />
          </div>
        </div>
      )}

      {meta && items.length > 0 ? (
        <Pagination meta={meta} onPageChange={setPage} itemLabel="request" disabled={query.isFetching} />
      ) : null}
    </div>
  );
}
