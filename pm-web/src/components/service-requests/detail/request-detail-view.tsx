"use client";

import { Ban, CircleX } from "lucide-react";
import { HistoryTimeline } from "@/components/common/history-timeline";
import { LoadError } from "@/components/common/load-error";
import { RelatedDocumentNotice } from "@/components/common/related-document-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { SR_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { ServiceRequestDetail } from "@/types/service-request";
import { useServiceRequest } from "../use-request-action";
import { ApprovalPanel } from "./approval-panel";
import { RequestActionBar } from "./request-action-bar";
import { RequestAttachments } from "./request-attachments";
import { RequestHeader } from "./request-header";
import {
  ExecutorNotesSection,
  IdentitySection,
  PurposeSection,
  RequestTypeSection,
  RulesSection,
} from "./request-sections";

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="panel">
      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-5">
        {Array.from({ length: rows * 2 }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors the detail layout: header, action bar, two columns of sections. */
function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Skeleton className="h-8 w-full max-w-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="panel flex flex-wrap gap-2 p-3">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <SectionSkeleton rows={2} />
          <SectionSkeleton rows={2} />
          <SectionSkeleton rows={4} />
        </div>
        <div className="space-y-4">
          <div className="panel">
            <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="space-y-5 p-4 sm:p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex gap-4">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <SectionSkeleton rows={1} />
        </div>
      </div>
    </div>
  );
}

function StatusNotices({ request }: { request: ServiceRequestDetail }) {
  const dangerNotice =
    "flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger-foreground";
  return (
    <>
      {request.status === "cancelled" ? (
        <div role="status" className={dangerNotice}>
          <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">
              Dibatalkan
              {request.cancelled_at ? <span className="tabular font-normal"> {formatDateTime(request.cancelled_at)}</span> : null}
            </p>
            {request.cancel_reason ? <p className="mt-1 whitespace-pre-wrap break-words">{request.cancel_reason}</p> : null}
          </div>
        </div>
      ) : null}
      {request.status === "rejected" ? (
        <div role="status" className={dangerNotice}>
          <CircleX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0">
            <span className="font-semibold">
              Ditolak
              {request.rejected_at ? <span className="tabular font-normal"> {formatDateTime(request.rejected_at)}</span> : null}.
            </span>{" "}
            Alasan penolakan tercantum di blok Pengesahan.
          </p>
        </div>
      ) : null}
      {request.converted_work_order ? (
        <RelatedDocumentNotice
          kind="converted"
          text="Form Request ini dialihkan menjadi Work Order"
          href={`/work-orders/${request.converted_work_order.id}`}
          linkLabel={request.converted_work_order.wo_number}
          reason={request.conversion_reason}
        />
      ) : null}
      {request.source_work_order ? (
        <RelatedDocumentNotice
          kind="source"
          text="Form Request ini hasil pengalihan dari Work Order"
          href={`/work-orders/${request.source_work_order.id}`}
          linkLabel={request.source_work_order.wo_number}
        />
      ) : null}
    </>
  );
}

export function RequestDetailView({ id }: { id: number }) {
  const query = useServiceRequest(id);

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    return <LoadError error={query.error} onRetry={() => query.refetch()} entity="Form Request" backHref="/requests" />;
  }

  const request = query.data;

  return (
    <div className="space-y-4">
      <RequestHeader request={request} />
      <StatusNotices request={request} />
      <RequestActionBar request={request} />

      {/*
       * Phones read top-down: approval chain first, then the request itself.
       * On lg the chain sits at the top of the right column, the request fills the left column.
       */}
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <ApprovalPanel request={request} />
        </div>
        <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1 lg:row-span-2">
          <PurposeSection request={request} />
          <RequestTypeSection request={request} />
          <IdentitySection request={request} />
          <RequestAttachments request={request} />
        </div>
        <div className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-2">
          <ExecutorNotesSection request={request} />
          <RulesSection request={request} />
          <HistoryTimeline logs={request.logs} statusLabels={SR_STATUS_LABELS} />
        </div>
      </div>
    </div>
  );
}
