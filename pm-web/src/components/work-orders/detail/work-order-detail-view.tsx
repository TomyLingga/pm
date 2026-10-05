"use client";

import * as React from "react";
import { HistoryTimeline } from "@/components/common/history-timeline";
import { RelatedDocumentNotice } from "@/components/common/related-document-notice";
import { SignaturesSection } from "@/components/common/signatures-section";
import { Skeleton } from "@/components/ui/skeleton";
import { WO_STATUS_LABELS } from "@/lib/constants";
import { useWorkOrder } from "../use-work-order";
import { WorkOrderLoadError } from "../work-order-load-error";
import { ActionBar } from "./action-bar";
import { AttachmentsSection } from "./attachments-section";
import { CompletePanel } from "./complete-panel";
import { DetailHeader } from "./detail-header";
import { AssignmentSection, InfoSection, WorkDoneSection } from "./info-sections";
import { ClearanceSection, LaboursSection, MaterialsSection } from "./work-tables";

const WORK_STATUSES = new Set(["in_progress", "completed", "closed"]);

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export function WorkOrderDetailView({ id }: { id: number }) {
  const query = useWorkOrder(id);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (completeOpen) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [completeOpen]);

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) return <WorkOrderLoadError error={query.error} onRetry={() => query.refetch()} />;

  const wo = query.data;
  const canFinish = wo.permissions.can_work || wo.permissions.can_complete;
  const showWork =
    WORK_STATUSES.has(wo.status) || wo.materials.length > 0 || wo.labours.length > 0 || !!wo.work_done;
  const convertedTo = wo.converted_service_request;
  const source = wo.source_service_request;

  return (
    <div className="space-y-4">
      <DetailHeader wo={wo} />

      {convertedTo ? (
        <RelatedDocumentNotice
          kind="converted"
          text="WO ini dialihkan menjadi Form Request"
          href={`/requests/${convertedTo.id}`}
          linkLabel={convertedTo.request_number ?? "(draft)"}
          reason={wo.conversion_reason}
        />
      ) : null}
      {source ? (
        <RelatedDocumentNotice
          kind="source"
          text="WO ini dibuat dari pengalihan Form Request"
          href={`/requests/${source.id}`}
          linkLabel={source.request_number ?? "(draft)"}
        />
      ) : null}

      <ActionBar wo={wo} completeOpen={completeOpen && canFinish} onOpenComplete={() => setCompleteOpen(true)} />

      {canFinish && completeOpen ? (
        <CompletePanel ref={panelRef} key={wo.id} wo={wo} onClose={() => setCompleteOpen(false)} />
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <InfoSection wo={wo} />
          {showWork ? (
            <>
              <WorkDoneSection wo={wo} />
              <MaterialsSection wo={wo} />
              <LaboursSection wo={wo} />
              <ClearanceSection wo={wo} />
            </>
          ) : null}
          <AttachmentsSection wo={wo} />
        </div>
        <div className="space-y-4">
          <AssignmentSection wo={wo} />
          <SignaturesSection signatures={wo.signatures} />
          <HistoryTimeline logs={wo.logs} statusLabels={WO_STATUS_LABELS} />
        </div>
      </div>
    </div>
  );
}
