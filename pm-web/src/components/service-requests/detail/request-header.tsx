import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeLong } from "@/lib/format";
import type { ServiceRequestDetail } from "@/types/service-request";

/** Detail header: request number as eyebrow, the purpose as title, status and priority on the right. */
export function RequestHeader({ request }: { request: ServiceRequestDetail }) {
  return (
    <PageHeader
      backHref="/requests"
      backLabel="Daftar Form Request"
      eyebrow={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Form Request</span>
          <span aria-hidden>/</span>
          {request.request_number ? (
            <span className="tabular break-all font-mono font-semibold text-foreground">{request.request_number}</span>
          ) : (
            <Badge variant="dashed" className="rounded-md px-1.5 py-0 font-mono text-[11px] font-bold">
              DRAFT
            </Badge>
          )}
          {request.revision_no > 0 ? (
            <Badge variant="neutral" className="tabular px-2 text-[11px]">
              Revisi ke-{request.revision_no}
            </Badge>
          ) : null}
        </span>
      }
      title={<span className="line-clamp-2 break-words">{request.purpose}</span>}
      description={
        <>
          {request.submitted_at ? "Diajukan " : "Dibuat "}
          <span className="tabular">{formatDateTimeLong(request.submitted_at ?? request.created_at)}</span> oleh{" "}
          <span className="font-medium text-foreground">{request.requester.name}</span>
          {request.requester_sub_bagian_name ? ` (${request.requester_sub_bagian_name})` : ""}
        </>
      }
      actions={
        <>
          <StatusBadge status={request.status} label={request.status_label} className="px-3 py-1 text-xs" />
          <PriorityBadge priority={request.priority} label={`Prioritas ${request.priority_label}`} />
        </>
      }
    />
  );
}
