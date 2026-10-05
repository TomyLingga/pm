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

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

function StatusNotices({ request }: { request: ServiceRequestDetail }) {
  return (
    <>
      {request.status === "cancelled" ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Dibatalkan {request.cancelled_at ? formatDateTime(request.cancelled_at) : ""}</p>
            {request.cancel_reason ? <p className="mt-1 whitespace-pre-wrap">{request.cancel_reason}</p> : null}
          </div>
        </div>
      ) : null}
      {request.status === "rejected" ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <CircleX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">
              Ditolak {request.rejected_at ? formatDateTime(request.rejected_at) : ""}.
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

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <PurposeSection request={request} />
          <RequestTypeSection request={request} />
          <IdentitySection request={request} />
          <RequestAttachments request={request} />
        </div>
        <div className="space-y-4">
          <ApprovalPanel request={request} />
          <ExecutorNotesSection request={request} />
          <RulesSection request={request} />
          <HistoryTimeline logs={request.logs} statusLabels={SR_STATUS_LABELS} />
        </div>
      </div>
    </div>
  );
}
