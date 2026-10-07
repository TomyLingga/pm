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

function SectionSkeleton({ rows, wide }: { rows: number; wide?: boolean }) {
  return (
    <div className="panel">
      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className={wide ? "grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-5" : "space-y-4 p-4 sm:p-5"}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors the loaded page: header, action bar, two-column sections. */
function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <Skeleton className="h-7 w-72 max-w-full sm:w-96" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
      </div>
      <div className="panel flex flex-wrap gap-2 p-3">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionSkeleton rows={8} wide />
          <SectionSkeleton rows={1} />
        </div>
        <div className="space-y-4">
          <SectionSkeleton rows={3} />
          <SectionSkeleton rows={1} />
          <SectionSkeleton rows={3} />
        </div>
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

      {wo.source_pm_task ? (
        <RelatedDocumentNotice
          kind="source"
          text="Dibuat dari temuan"
          href={`/pm/tasks/${wo.source_pm_task.id}`}
          linkLabel={wo.source_pm_task.number}
          suffix={wo.source_pm_task.item_description ? `(${wo.source_pm_task.item_description})` : undefined}
        />
      ) : null}

      <ActionBar wo={wo} completeOpen={completeOpen && canFinish} onOpenComplete={() => setCompleteOpen(true)} />

      {canFinish && completeOpen ? (
        <CompletePanel ref={panelRef} key={wo.id} wo={wo} onClose={() => setCompleteOpen(false)} />
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
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
        <div className="min-w-0 space-y-4">
          <AssignmentSection wo={wo} />
          <SignaturesSection signatures={wo.signatures} />
          <HistoryTimeline logs={wo.logs} statusLabels={WO_STATUS_LABELS} />
        </div>
      </div>
    </div>
  );
}
