"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ClipboardCheck, History, Wrench } from "lucide-react";
import { StatusBadge } from "@/components/common/badges";
import { Section } from "@/components/common/section";
import { ErrorState } from "@/components/common/states";
import { FindingsChip, LateChip, PmStatusBadge } from "@/components/pm/pm-badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { getEquipmentHistory } from "@/lib/pm-equipment";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/types/pm";

function entryHref(entry: HistoryEntry): string {
  return entry.type === "pm_task" ? `/pm/tasks/${entry.id}` : `/work-orders/${entry.id}`;
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const isPm = entry.type === "pm_task";
  const Icon = isPm ? ClipboardCheck : Wrench;
  const kind = isPm ? "Preventive Maintenance" : "Work Order";
  return (
    <li className="relative pl-10">
      <span
        className={cn(
          "absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card",
          isPm ? "bg-info-soft text-info-foreground" : "bg-warning-soft text-warning-foreground",
        )}
        title={kind}
      >
        <Icon className="h-4 w-4" aria-hidden />
        <span className="sr-only">{kind}</span>
      </span>
      <Link
        href={entryHref(entry)}
        className="block rounded-md border bg-card p-3 transition-colors duration-150 hover:bg-surface-2/60 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isPm ? "PM" : "WO"}
            </span>
            <span className="font-mono text-xs font-semibold text-primary">{entry.number}</span>
          </span>
          {isPm ? (
            <PmStatusBadge status={entry.status} label={entry.status_label} />
          ) : (
            <StatusBadge status={entry.status} label={entry.status_label} />
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm font-medium">{entry.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="tabular">{formatDateTime(entry.date)}</span>
          {entry.actor_name ? <span>{entry.actor_name}</span> : null}
          {entry.findings_count ? <FindingsChip count={entry.findings_count} /> : null}
          {entry.is_late ? <LateChip /> : null}
        </div>
      </Link>
    </li>
  );
}

/** Placeholder shaped like the timeline rows. */
function HistorySkeleton() {
  return (
    <ol className="space-y-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, index) => (
        <li key={index} className="relative pl-10">
          <Skeleton className="absolute left-0 top-0 h-8 w-8 rounded-full" />
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-40" />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Maintenance history of one equipment (PM tasks + work orders, newest first) with "Muat lagi". */
export function EquipmentHistory({ equipmentId }: { equipmentId: number }) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.equipmentHistory(equipmentId),
    queryFn: ({ pageParam, signal }) => getEquipmentHistory(equipmentId, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta;
      return meta && meta.current_page < meta.last_page ? meta.current_page + 1 : undefined;
    },
  });

  const entries = query.data?.pages.flatMap((page) => page.data) ?? [];
  const total = query.data?.pages[0]?.meta?.total;

  return (
    <Section
      title="Riwayat Maintenance"
      icon={<History className="h-4 w-4" aria-hidden />}
      actions={
        typeof total === "number" ? <span className="tabular text-xs text-muted-foreground">{total} entri</span> : undefined
      }
    >
      {query.isPending ? (
        <HistorySkeleton />
      ) : query.isError && entries.length === 0 ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada riwayat PM maupun Work Order untuk equipment ini.</p>
      ) : (
        <div className="space-y-4">
          <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-border">
            {entries.map((entry) => (
              <HistoryRow key={`${entry.type}-${entry.id}`} entry={entry} />
            ))}
          </ol>
          {query.isFetchNextPageError ? (
            <p className="text-sm font-medium text-danger-foreground" role="alert">
              {errorMessage(query.error)}
            </p>
          ) : null}
          {query.hasNextPage ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
                Muat lagi
              </Button>
            </div>
          ) : entries.length > 5 ? (
            <p className="text-center text-xs text-muted-foreground">Semua riwayat sudah ditampilkan.</p>
          ) : null}
        </div>
      )}
    </Section>
  );
}
