"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { ScopeTabs } from "@/components/common/scope-tabs";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { isAdmin, isExecutorStaff } from "@/lib/auth";
import { SR_SCOPE_DESCRIPTIONS, SR_SCOPE_LABELS } from "@/lib/constants";
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
  if (isAdmin(me)) scopes.push("all");
  return scopes;
}

/** Placeholder shaped like the list: a table on desktop, stacked cards on phones. */
export function RequestListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden>
      <div className="panel hidden overflow-hidden md:block">
        <div className="flex items-center gap-6 border-b bg-surface-2/70 px-3 py-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="ml-auto h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-6 border-b px-3 py-3 last:border-0">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-24" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
      <div className="space-y-3 md:hidden">
        {Array.from({ length: Math.min(rows, 3) }).map((_, index) => (
          <div key={index} className="panel space-y-3 p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <div className="space-y-1.5 pt-1">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
      <PageHeader
        title="Form Request"
        description="Permintaan yang membutuhkan biaya atau persetujuan atasan."
        actions={
          <>
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <a href={serviceRequestExportUrl(apiParams)} download>
                <FileSpreadsheet aria-hidden />
                Export Excel
              </a>
            </Button>
            <Button asChild className="flex-1 sm:flex-none">
              <Link href="/requests/new">
                <Plus aria-hidden />
                Buat Request
              </Link>
            </Button>
          </>
        }
      />

      <ScopeTabs
        scopes={scopes}
        value={scope}
        labels={SR_SCOPE_LABELS}
        descriptions={SR_SCOPE_DESCRIPTIONS}
        onChange={setScope}
        ariaLabel="Lingkup daftar Form Request"
      />

      <RequestFilters
        filters={filters}
        activeFilterCount={activeFilterCount}
        onChange={setFilters}
        onReset={resetFilters}
      />

      {query.isPending ? (
        <RequestListSkeleton />
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
                  <Plus aria-hidden />
                  Buat Request
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
