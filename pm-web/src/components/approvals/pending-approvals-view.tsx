"use client";

import Link from "next/link";
import { CheckCheck, ChevronRight, Clock, UserRound, Wrench } from "lucide-react";
import { OverdueBadge, PriorityBadge } from "@/components/common/badges";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingApprovals } from "@/hooks/use-approvals";
import { errorMessage } from "@/lib/api";
import { documentHref } from "@/lib/approvals";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PendingApproval } from "@/types/approval";

function ApprovalCard({ item }: { item: PendingApproval }) {
  const href = documentHref(item.document_type, item.document_id);
  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.document_type_label}
          </p>
          <p className="font-mono text-sm font-semibold text-primary">{item.document_number ?? "DRAFT"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.overdue ? <OverdueBadge /> : null}
          <PriorityBadge priority={item.priority} label={item.priority_label} />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium">{item.title}</p>
      <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
        <span className="flex min-w-0 items-center gap-2">
          <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{item.requester.name}</span>
        </span>
        {item.executor_unit ? (
          <span className="flex min-w-0 items-center gap-2">
            <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{item.executor_unit.display_name}</span>
          </span>
        ) : null}
        <span className="flex min-w-0 items-center gap-2">
          <CheckCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {item.step_label} &middot; {item.action === "complete" ? "perlu diselesaikan" : "perlu disetujui"}
          </span>
        </span>
        {item.waiting_since ? (
          <span
            className={cn("flex min-w-0 items-center gap-2", item.overdue && "font-medium text-red-700")}
            title={formatDateTime(item.waiting_since)}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">Menunggu sejak {formatRelative(item.waiting_since)}</span>
          </span>
        ) : null}
      </div>
    </>
  );

  const className = cn(
    "relative block rounded-lg border bg-card p-4 pr-10 shadow-sm transition-colors",
    item.overdue && "border-red-300",
    href && "hover:bg-muted/40 active:bg-muted/60",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
      <ChevronRight className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function PendingApprovalsView() {
  const query = usePendingApprovals();
  const items = query.data ?? [];
  const overdue = items.filter((item) => item.overdue).length;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Menunggu Persetujuan Saya</h1>
        <p className="text-sm text-muted-foreground">
          Dokumen yang menunggu tindakan Anda, diurutkan dari yang paling lama menunggu.
          {overdue > 0 ? <span className="font-medium text-red-700"> {overdue} lewat 24 jam.</span> : null}
        </p>
      </div>

      {query.isPending ? (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckCheck className="h-8 w-8 text-emerald-600" aria-hidden />}
          title="Tidak ada yang menunggu persetujuan Anda"
          description="Dokumen baru yang perlu Anda setujui atau selesaikan akan muncul di sini."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.document_type}-${item.document_id}-${item.step_id}`}>
              <ApprovalCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
