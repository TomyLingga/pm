"use client";

import Link from "next/link";
import { ArrowRight, CheckCheck, Clock, UserRound, Wrench } from "lucide-react";
import { OverdueBadge, PriorityBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingApprovals } from "@/hooks/use-approvals";
import { errorMessage } from "@/lib/api";
import { documentHref } from "@/lib/approvals";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PendingApproval } from "@/types/approval";

/** Inbox row: document, what is asked of me, how long it has waited, one clear action. */
function ApprovalRow({ item }: { item: PendingApproval }) {
  const href = documentHref(item.document_type, item.document_id);
  const actionLabel = item.action === "complete" ? "Selesaikan" : "Tinjau & Setujui";
  const askLabel = item.action === "complete" ? "perlu diselesaikan" : "perlu disetujui";

  const body = (
    <>
      {item.overdue ? <span className="absolute inset-y-0 left-0 w-0.5 bg-danger" aria-hidden /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {item.document_type_label}
          </span>
          <span className="tabular font-mono text-sm font-semibold text-primary">{item.document_number ?? "DRAFT"}</span>
          <PriorityBadge priority={item.priority} label={item.priority_label} />
          {item.overdue ? <OverdueBadge /> : null}
        </div>
        <p className="line-clamp-2 break-words text-sm font-medium text-foreground">{item.title}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{item.requester.name}</span>
          </span>
          {item.executor_unit ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{item.executor_unit.display_name}</span>
            </span>
          ) : null}
          <span className="flex min-w-0 items-center gap-1.5">
            <CheckCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {item.step_label}, {askLabel}
            </span>
          </span>
          {item.waiting_since ? (
            <span
              className={cn(
                "tabular flex min-w-0 items-center gap-1.5",
                item.overdue && "font-medium text-danger-foreground",
              )}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <time dateTime={item.waiting_since} title={formatDateTime(item.waiting_since)} className="truncate">
                Menunggu sejak {formatRelative(item.waiting_since)}
              </time>
            </span>
          ) : null}
        </div>
      </div>
      {href ? (
        <span
          className={cn(
            buttonVariants({ variant: item.overdue ? "default" : "soft", size: "sm" }),
            "mt-1 w-full shrink-0 sm:mt-0 sm:w-auto",
          )}
        >
          {actionLabel}
          <ArrowRight aria-hidden />
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5",
    item.overdue && "bg-danger-soft/30",
  );

  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-colors duration-150 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-surface-2",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Rows shaped like the inbox list. */
function InboxSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="panel divide-y overflow-hidden" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-4/5" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-9 w-full sm:w-36" />
        </div>
      ))}
    </div>
  );
}

export function PendingApprovalsView() {
  const query = usePendingApprovals();
  const items = query.data ?? [];
  const overdue = items.filter((item) => item.overdue).length;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Menunggu Persetujuan Saya"
        description="Dokumen yang menunggu tindakan Anda, diurutkan dari yang paling lama menunggu."
        actions={
          query.isSuccess && items.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2" aria-live="polite">
              <Badge variant="neutral" className="tabular">
                {items.length} dokumen
              </Badge>
              {overdue > 0 ? (
                <Badge variant="danger" className="tabular">
                  {overdue} lewat 24 jam
                </Badge>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {query.isPending ? (
        <InboxSkeleton />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckCheck className="h-5 w-5 text-success" aria-hidden />}
          title="Tidak ada yang menunggu persetujuan Anda"
          description="Dokumen baru yang perlu Anda setujui atau selesaikan akan muncul di sini."
        />
      ) : (
        <ul className="panel divide-y overflow-hidden" aria-label="Daftar dokumen menunggu persetujuan">
          {items.map((item) => (
            <li key={`${item.document_type}-${item.document_id}-${item.step_id}`}>
              <ApprovalRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
