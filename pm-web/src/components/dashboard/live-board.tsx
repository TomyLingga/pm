"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CalendarClock, ClipboardList, FileSignature, type LucideIcon } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { EmptyState, ErrorState } from "@/components/common/states";
import { PmStatusBadge } from "@/components/pm/pm-badges";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { getLiveBoard } from "@/lib/dashboard";
import { formatRelative } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { DashboardScope } from "@/types/dashboard";
import type { PmTaskListItem } from "@/types/pm";
import type { ServiceRequestListItem } from "@/types/service-request";
import type { WorkOrderListItem } from "@/types/work-order";

export const LIVE_REFRESH_MS = 30_000;

interface LiveBoardProps {
  /** Omitted = server default for the role (technician: own, lead: unit, admin: all). */
  scope?: DashboardScope;
  /** Wall-display mode: larger type, columns fill the viewport and scroll inside. */
  kiosk?: boolean;
  className?: string;
}

/** Polls `GET /dashboard/live` every 30 s (also while the tab is in the background). */
export function useLiveBoard(scope?: DashboardScope) {
  return useQuery({
    queryKey: queryKeys.liveBoard(scope),
    queryFn: ({ signal }) => getLiveBoard(scope, signal),
    refetchInterval: LIVE_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}

const timeFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

function Column({
  icon: Icon,
  title,
  count,
  countLabel,
  tone = "neutral",
  href,
  kiosk,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  countLabel: string;
  tone?: "neutral" | "danger" | "warning" | "info";
  href: string;
  kiosk?: boolean;
  children: React.ReactNode;
}) {
  const chip = { neutral: "bg-surface-2 text-foreground", danger: "bg-danger text-danger-on-solid", warning: "bg-warning text-warning-on-solid", info: "bg-info text-info-on-solid" }[tone];
  return (
    <section className={cn("panel flex min-w-0 flex-col", kiosk && "lg:h-full lg:min-h-0")} aria-label={title}>
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted-foreground", kiosk && "h-9 w-9")}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h3 className={cn("min-w-0 flex-1 truncate text-sm font-semibold", kiosk && "text-base")}>{title}</h3>
        <span className={cn("tabular inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold", chip, kiosk && "h-8 text-sm")} aria-label={`${count} ${countLabel}`}>
          {count}
        </span>
      </header>
      <div className={cn("min-h-0 flex-1", kiosk && "lg:overflow-y-auto")}>{children}</div>
      <footer className="border-t px-4 py-2">
        <Link href={href} className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Lihat semua
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </footer>
    </section>
  );
}

function Row({ href, kiosk, urgent, children }: { href: string; kiosk?: boolean; urgent?: boolean; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-start gap-3 border-b px-4 py-2.5 transition-colors last:border-b-0 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          kiosk && "py-3",
          urgent && "bg-danger-soft/40",
        )}
      >
        {children}
      </Link>
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function WorkOrderRow({ wo, kiosk }: { wo: WorkOrderListItem; kiosk?: boolean }) {
  return (
    <Row href={`/work-orders/${wo.id}`} kiosk={kiosk} urgent={wo.priority === "high" && wo.status === "submitted"}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs font-semibold text-primary">{wo.wo_number}</span>
          <PriorityBadge priority={wo.priority} label={wo.priority_label} />
          <StatusBadge status={wo.status} label={wo.status_label} />
        </div>
        <p className={cn("mt-1 line-clamp-1 text-sm font-medium", kiosk && "text-base")}>{wo.request_description}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {wo.requester.name} &middot; {wo.executor_unit.display_name} &middot; <span className="tabular">{formatRelative(wo.issued_at)}</span>
        </p>
      </div>
    </Row>
  );
}

function RequestRow({ sr, kiosk }: { sr: ServiceRequestListItem; kiosk?: boolean }) {
  return (
    <Row href={`/requests/${sr.id}`} kiosk={kiosk}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs font-semibold text-primary">{sr.request_number ?? "DRAFT"}</span>
          <PriorityBadge priority={sr.priority} label={sr.priority_label} />
          <StatusBadge status={sr.status} label={sr.status_label} />
        </div>
        <p className={cn("mt-1 line-clamp-1 text-sm font-medium", kiosk && "text-base")}>{sr.purpose}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {sr.requester.name} &middot; {sr.current_step ? `${sr.current_step.label}${sr.current_step.assignee_label ? `: ${sr.current_step.assignee_label}` : ""}` : sr.executor_unit.display_name}
          {sr.submitted_at ? (
            <>
              {" "}&middot; <span className="tabular">{formatRelative(sr.submitted_at)}</span>
            </>
          ) : null}
        </p>
      </div>
    </Row>
  );
}

function PmRow({ task, kiosk }: { task: PmTaskListItem; kiosk?: boolean }) {
  const overdue = task.status === "overdue";
  return (
    <Row href={`/pm/tasks/${task.id}`} kiosk={kiosk} urgent={overdue}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs font-semibold text-primary">{task.number}</span>
          <PmStatusBadge status={task.status} label={task.status_label} />
          {task.has_skip_proposal ? <Badge variant="warning">Usulan skip</Badge> : null}
        </div>
        <p className={cn("mt-1 line-clamp-1 text-sm font-medium", kiosk && "text-base")}>
          {task.equipment.code ? <span className="font-mono text-xs text-muted-foreground">{task.equipment.code} </span> : null}
          {task.equipment.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {task.schedule?.name ?? "Tugas PM"} &middot; {task.pic?.name ?? "PIC belum ditetapkan"}
        </p>
      </div>
      <div className={cn("tabular shrink-0 text-right text-xs", overdue ? "font-semibold text-danger-foreground" : task.status === "due" ? "font-semibold text-warning-foreground" : "text-muted-foreground")}>
        {overdue ? <AlertTriangle className="mb-0.5 ml-auto h-3.5 w-3.5" aria-hidden /> : null}
        {formatRelative(task.due_at)}
      </div>
    </Row>
  );
}

function BoardSkeleton({ kiosk }: { kiosk?: boolean }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-3", kiosk && "lg:h-full")} aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="panel space-y-3 p-4">
          <Skeleton className="h-8 w-40" />
          {Array.from({ length: 4 }).map((_, j) => (
            <Skeleton key={j} className="h-14 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Three live columns: WO waiting to be picked up, Form Requests awaiting approval, PM due soon. */
export function LiveBoard({ scope, kiosk, className }: LiveBoardProps) {
  const query = useLiveBoard(scope);
  const data = query.data;
  const [, tick] = React.useReducer((n: number) => n + 1, 0);

  // Re-render every 10 s so "x menit yang lalu" stays honest between polls.
  React.useEffect(() => {
    const id = window.setInterval(tick, 10_000);
    return () => window.clearInterval(id);
  }, []);

  if (query.isPending) return <BoardSkeleton kiosk={kiosk} />;
  if (query.isError && !data) return <ErrorState title="Gagal memuat papan monitor" message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  if (!data) return null;

  const pmUrgent = data.pm.overdue + data.pm.due;
  const scopeLabel = { mine: "lingkup saya", unit: "unit saya", all: "semua unit" }[data.scope];
  const boardAll = data.scope === "all";
  const woHref = `/work-orders?scope=${boardAll ? "all" : data.scope === "unit" ? "executor" : "mine"}&status=submitted,received`;
  const srHref = `/requests?scope=${boardAll ? "all" : data.scope === "unit" ? "executor" : "mine"}&status=waiting_superior,waiting_executor`;
  const pmHref = `/pm/tasks?scope=${data.scope}&status=due,overdue,in_progress`;

  return (
    <div className={cn("space-y-3", kiosk && "lg:flex lg:h-full lg:min-h-0 lg:flex-col", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" aria-hidden />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" aria-hidden />
          </span>
          Live
        </span>
        <span>Diperbarui otomatis setiap 30 detik ({scopeLabel})</span>
        {query.dataUpdatedAt ? (
          <span className="tabular" aria-live="polite">
            Terakhir {timeFormat.format(new Date(query.dataUpdatedAt))}
          </span>
        ) : null}
        {query.isError ? <span className="text-danger-foreground">Pembaruan terakhir gagal, mencoba lagi…</span> : null}
      </div>

      <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-3", kiosk && "lg:min-h-0 lg:flex-1 lg:auto-rows-fr")} aria-busy={query.isFetching || undefined}>
        <Column icon={ClipboardList} title="WO diajukan" count={data.work_orders.total} countLabel="WO menunggu" tone={data.work_orders.submitted > 0 ? "info" : "neutral"} href={woHref} kiosk={kiosk}>
          {data.work_orders.items.length ? (
            <ul>
              {data.work_orders.items.map((wo) => (
                <WorkOrderRow key={wo.id} wo={wo} kiosk={kiosk} />
              ))}
            </ul>
          ) : (
            <Empty text="Tidak ada WO yang menunggu diambil." />
          )}
        </Column>

        <Column icon={FileSignature} title="Form Request menunggu persetujuan" count={data.requests.total} countLabel="request menunggu" tone={data.requests.total > 0 ? "warning" : "neutral"} href={srHref} kiosk={kiosk}>
          {data.requests.items.length ? (
            <ul>
              {data.requests.items.map((sr) => (
                <RequestRow key={sr.id} sr={sr} kiosk={kiosk} />
              ))}
            </ul>
          ) : (
            <Empty text="Tidak ada Form Request yang menunggu persetujuan." />
          )}
        </Column>

        <Column icon={CalendarClock} title={`PM jatuh tempo & ${data.upcoming_hours} jam ke depan`} count={pmUrgent} countLabel="tugas PM jatuh tempo atau terlambat" tone={data.pm.overdue > 0 ? "danger" : pmUrgent > 0 ? "warning" : "neutral"} href={pmHref} kiosk={kiosk}>
          {data.pm.items.length ? (
            <ul>
              {data.pm.items.map((task) => (
                <PmRow key={task.id} task={task} kiosk={kiosk} />
              ))}
            </ul>
          ) : (
            <EmptyState title="Tidak ada PM yang mendekati jatuh tempo" className="m-4 py-8" />
          )}
        </Column>
      </div>
    </div>
  );
}
