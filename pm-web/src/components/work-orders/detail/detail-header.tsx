import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDateTimeLong } from "@/lib/format";
import type { WorkOrderDetail } from "@/types/work-order";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";

export function DetailHeader({ wo }: { wo: WorkOrderDetail }) {
  return (
    <div className="space-y-2">
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Daftar Work Order
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="break-all font-mono text-lg font-bold sm:text-2xl">{wo.wo_number}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={wo.status} label={wo.status_label} className="px-3 py-1 text-xs" />
          <PriorityBadge priority={wo.priority} label={`Prioritas ${wo.priority_label}`} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Diterbitkan {formatDateTimeLong(wo.issued_at)} oleh{" "}
        <span className="font-medium text-foreground">{wo.requester.name}</span>
        {wo.requester_sub_bagian_name ? ` (${wo.requester_sub_bagian_name})` : ""}
      </p>
    </div>
  );
}
