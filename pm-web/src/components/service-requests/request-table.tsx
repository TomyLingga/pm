"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { ServiceRequestListItem } from "@/types/service-request";
import { CurrentStepInfo } from "./current-step";
import { RequestNumber } from "./request-number";

const linkClassName =
  "inline-flex rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Desktop table (md and up). The whole row opens the detail; the request number is the real link. */
export function RequestTable({ items }: { items: ServiceRequestListItem[] }) {
  const router = useRouter();

  return (
    <Table className="min-w-[1040px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[190px]">No. Request</TableHead>
          <TableHead className="w-[130px]">Tanggal</TableHead>
          <TableHead>Keperluan</TableHead>
          <TableHead className="w-[170px]">Pelaksana / Jenis</TableHead>
          <TableHead className="w-[110px]">Office</TableHead>
          <TableHead className="w-[100px]">Prioritas</TableHead>
          <TableHead className="w-[150px]">Status</TableHead>
          <TableHead className="w-[180px]">Langkah saat ini</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((request) => {
          const href = `/requests/${request.id}`;
          return (
            <TableRow key={request.id} className="cursor-pointer" onClick={() => router.push(href)}>
              <TableCell>
                <Link href={href} className={linkClassName} onClick={(event) => event.stopPropagation()}>
                  <RequestNumber number={request.request_number} />
                </Link>
                {request.revision_no > 0 ? (
                  <p className="tabular mt-1 text-[11px] text-muted-foreground">Revisi ke-{request.revision_no}</p>
                ) : null}
              </TableCell>
              <TableCell className="tabular whitespace-nowrap text-xs text-muted-foreground">
                {formatDateTime(request.submitted_at ?? request.created_at)}
              </TableCell>
              <TableCell>
                <p className="line-clamp-2 break-words font-medium">{request.purpose}</p>
                <p className="mt-0.5 line-clamp-1 break-words text-xs text-muted-foreground">
                  {request.requester.name}
                  {request.requester_sub_bagian_name ? ` - ${request.requester_sub_bagian_name}` : ""}
                </p>
              </TableCell>
              <TableCell>
                <p className="line-clamp-1 break-words text-sm font-medium">{request.executor_unit.display_name}</p>
                <p className="line-clamp-1 break-words text-xs text-muted-foreground">
                  {request.service_category?.name ?? "-"}
                </p>
              </TableCell>
              <TableCell>
                <p className="line-clamp-2 break-words text-sm">{request.office?.name ?? "-"}</p>
              </TableCell>
              <TableCell>
                <PriorityBadge priority={request.priority} label={request.priority_label} />
              </TableCell>
              <TableCell>
                <StatusBadge status={request.status} label={request.status_label} />
              </TableCell>
              <TableCell>
                <CurrentStepInfo step={request.current_step} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
