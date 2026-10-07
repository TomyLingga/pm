"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api";
import { getDashboard } from "@/lib/dashboard";
import { formatRelative } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { MonitorPlay } from "lucide-react";
import { DashboardFilters } from "./dashboard-filters";
import { LiveBoard } from "./live-board";
import { KpiTiles } from "./kpi-tiles";
import { useDashboardParams } from "./use-dashboard-params";

/** Placeholder shaped like the KPI tiles (icon chip, number, label). */
function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-hidden>
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="panel p-3 sm:p-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="mt-3 h-6 w-16" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder shaped like the chart panels (title, description, plot area). */
function ChartsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="panel p-4 sm:p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-56" />
          <Skeleton className="mt-5 h-48 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Filter bar placeholder (scope tabs, period presets, filter fields). */
function FiltersSkeleton() {
  return (
    <div className="panel space-y-3 p-3 sm:p-4" aria-hidden>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-9 w-72 max-w-full rounded-md" />
      </div>
      <Skeleton className="h-4 w-48" />
      <div className="hidden gap-3 sm:grid-cols-3 lg:grid">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

/** Full-page placeholder used by the route's Suspense boundary. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" description="Ringkasan Work Order, Form Request, dan preventive maintenance." />
      <FiltersSkeleton />
      <KpiSkeleton />
      <ChartsSkeleton />
    </div>
  );
}

// Recharts is browser-only and heavy: load it on the client, after the page shell.
const DashboardCharts = dynamic(() => import("./dashboard-charts").then((module) => module.DashboardCharts), {
  ssr: false,
  loading: () => <ChartsSkeleton />,
});

export function DashboardView() {
  const me = useCurrentUser();
  const params = useDashboardParams();

  const query = useQuery({
    queryKey: queryKeys.dashboard(params.apiParams),
    queryFn: ({ signal }) => getDashboard(params.apiParams, signal),
    placeholderData: keepPreviousData,
    // The server caches results for 5 minutes anyway.
    staleTime: 60 * 1000,
  });

  const data = query.data;
  const forbiddenScope = query.isError && query.error instanceof ApiError && query.error.status === 403;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description="Ringkasan Work Order, Form Request, dan preventive maintenance."
        actions={
          <div className="flex items-center gap-3">
            {query.dataUpdatedAt ? (
              <span className="tabular text-xs text-muted-foreground" aria-live="polite">
                Diperbarui {formatRelative(new Date(query.dataUpdatedAt))}
              </span>
            ) : null}
            <Button variant="soft" size="sm" asChild>
              <Link href={`/monitor${params.apiParams.scope ? `?scope=${params.apiParams.scope}` : ""}`}>
                <MonitorPlay aria-hidden />
                <span className="hidden sm:inline">Papan monitor</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              aria-label="Muat ulang dashboard"
            >
              <RefreshCw className={cn(query.isFetching && "animate-spin")} aria-hidden />
              <span className="hidden sm:inline">Muat ulang</span>
            </Button>
          </div>
        }
      />

      <DashboardFilters params={params} availableScopes={data?.available_scopes ?? []} activeScope={data?.scope} />

      <LiveBoard scope={params.apiParams.scope} />

      {query.isPending ? (
        <>
          <KpiSkeleton />
          <ChartsSkeleton />
        </>
      ) : query.isError && !data ? (
        <ErrorState
          title={forbiddenScope ? "Lingkup ini tidak tersedia untuk Anda" : "Gagal memuat dashboard"}
          message={errorMessage(query.error)}
          onRetry={forbiddenScope ? () => params.update({ scope: "" }) : () => query.refetch()}
        />
      ) : data ? (
        <div
          className={cn("space-y-4 transition-opacity duration-150", query.isPlaceholderData && "opacity-60")}
          aria-busy={query.isPlaceholderData || undefined}
        >
          {query.isError ? (
            <p
              role="status"
              className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-foreground"
            >
              Gagal memperbarui data: {errorMessage(query.error)}. Menampilkan data sebelumnya.
            </p>
          ) : null}
          <KpiTiles kpi={data.kpi} me={me} />
          <DashboardCharts data={data} me={me} />
        </div>
      ) : null}
    </div>
  );
}
