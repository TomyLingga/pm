import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { formatDateTimeLong } from "@/lib/format";
import type { ServiceRequestDetail } from "@/types/service-request";

export function RequestHeader({ request }: { request: ServiceRequestDetail }) {
  return (
    <div className="space-y-2">
      <Link
        href="/requests"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Daftar Form Request
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Form Request</p>
          {request.request_number ? (
            <h1 className="break-all font-mono text-lg font-bold sm:text-2xl">{request.request_number}</h1>
          ) : (
            <h1 className="font-mono text-lg font-bold text-slate-500 sm:text-2xl">DRAFT</h1>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={request.status} label={request.status_label} className="px-3 py-1 text-xs" />
          <PriorityBadge priority={request.priority} label={`Prioritas ${request.priority_label}`} />
          {request.revision_no > 0 ? (
            <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Revisi ke-{request.revision_no}
            </span>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {request.submitted_at ? "Diajukan " : "Dibuat "}
        {formatDateTimeLong(request.submitted_at ?? request.created_at)} oleh{" "}
        <span className="font-medium text-foreground">{request.requester.name}</span>
        {request.requester_sub_bagian_name ? ` (${request.requester_sub_bagian_name})` : ""}
      </p>
    </div>
  );
}
