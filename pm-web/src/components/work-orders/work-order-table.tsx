"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { WorkOrderListItem } from "@/types/work-order";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { categoryLabel, equipmentLabel } from "./helpers";

/** Desktop table (md and up). */
export function WorkOrderTable({ items }: { items: WorkOrderListItem[] }) {
  const router = useRouter();

  return (
    <Table className="min-w-[960px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[170px]">No WO</TableHead>
          <TableHead className="w-[120px]">Tanggal</TableHead>
          <TableHead>Permintaan</TableHead>
          <TableHead className="w-[170px]">Alat</TableHead>
          <TableHead className="w-[170px]">Pelaksana / Kategori</TableHead>
          <TableHead className="w-[100px]">Prioritas</TableHead>
          <TableHead className="w-[120px]">Status</TableHead>
          <TableHead className="w-[160px]">Teknisi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((wo) => {
          const href = `/work-orders/${wo.id}`;
          return (
            <TableRow key={wo.id} className="cursor-pointer" onClick={() => router.push(href)}>
              <TableCell>
                <Link
                  href={href}
                  className="font-mono text-xs font-semibold text-primary hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {wo.wo_number}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {formatDateTime(wo.issued_at)}
              </TableCell>
              <TableCell>
                <p className="line-clamp-2 font-medium">{wo.request_description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {wo.requester.name}
                  {wo.requester_sub_bagian_name ? ` - ${wo.requester_sub_bagian_name}` : ""}
                </p>
              </TableCell>
              <TableCell>
                <p className="line-clamp-2 text-sm">{equipmentLabel(wo) || "-"}</p>
                {wo.location_name ? <p className="text-xs text-muted-foreground">{wo.location_name}</p> : null}
              </TableCell>
              <TableCell>
                <p className="text-sm font-medium">{wo.executor_unit.display_name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{categoryLabel(wo) || "-"}</p>
              </TableCell>
              <TableCell>
                <PriorityBadge priority={wo.priority} label={wo.priority_label} />
              </TableCell>
              <TableCell>
                <StatusBadge status={wo.status} label={wo.status_label} />
              </TableCell>
              <TableCell>
                {wo.assignees.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Belum ada</span>
                ) : (
                  <ul className="space-y-0.5 text-xs">
                    {wo.assignees.map((assignee) => (
                      <li key={assignee.id} className="flex items-center gap-1">
                        {assignee.is_lead ? (
                          <Crown className="h-3 w-3 text-amber-500" aria-label="Ketua" />
                        ) : null}
                        <span className="truncate">{assignee.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
