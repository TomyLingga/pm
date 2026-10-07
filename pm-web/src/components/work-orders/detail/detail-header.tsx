import Link from "next/link";
import { Pencil, Printer } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTimeLong } from "@/lib/format";
import { workOrderPdfUrl } from "@/lib/work-orders";
import type { WorkOrderDetail } from "@/types/work-order";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";

/**
 * Page header of the detail page: number + status/priority as the eyebrow, the request as the title,
 * document-level actions (edit, PDF) on the right. Workflow actions live in `ActionBar`.
 */
export function DetailHeader({ wo }: { wo: WorkOrderDetail }) {
  return (
    <PageHeader
      backHref="/work-orders"
      backLabel="Daftar Work Order"
      eyebrow={
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="font-mono text-sm font-semibold text-foreground">{wo.wo_number}</span>
          <StatusBadge status={wo.status} label={wo.status_label} />
          <PriorityBadge priority={wo.priority} label={`Prioritas ${wo.priority_label}`} />
        </span>
      }
      title={
        <>
          <span className="sr-only">{wo.wo_number}: </span>
          <span className="line-clamp-2 text-pretty break-words">{wo.request_description}</span>
        </>
      }
      description={
        <>
          Diterbitkan <span className="tabular">{formatDateTimeLong(wo.issued_at)}</span> oleh{" "}
          <span className="font-medium text-foreground">{wo.requester.name}</span>
          {wo.requester_sub_bagian_name ? ` (${wo.requester_sub_bagian_name})` : ""}
        </>
      }
      actions={
        <>
          {wo.permissions.can_update ? (
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <Link href={`/work-orders/${wo.id}/edit`}>
                <Pencil />
                Ubah
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="flex-1 sm:flex-none">
            <a href={workOrderPdfUrl(wo.id)} target="_blank" rel="noopener">
              <Printer />
              Cetak PDF
            </a>
          </Button>
        </>
      }
    />
  );
}
