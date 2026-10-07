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
    <Table className="min-w-[880px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[156px]">No WO</TableHead>
          <TableHead className="w-[112px]">Tanggal</TableHead>
          <TableHead>Permintaan</TableHead>
          <TableHead className="hidden w-[170px] 2xl:table-cell">Alat</TableHead>
          <TableHead className="w-[160px]">Pelaksana / Kategori</TableHead>
          <TableHead className="w-[96px]">Prioritas</TableHead>
          <TableHead className="w-[116px]">Status</TableHead>
          <TableHead className="w-[150px]">Teknisi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((wo) => {
          const href = `/work-orders/${wo.id}`;
          const equipment = equipmentLabel(wo);
          const category = categoryLabel(wo);
          return (
            // Row click is a convenience; the WO number is the real link (keyboard, cmd-click).
            <TableRow key={wo.id} className="cursor-pointer" onClick={() => router.push(href)}>
              <TableCell>
                <Link
                  href={href}
                  className="rounded-sm font-mono text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(event) => event.stopPropagation()}
                >
                  {wo.wo_number}
                </Link>
              </TableCell>
              <TableCell className="tabular whitespace-nowrap text-xs text-muted-foreground">
                {formatDateTime(wo.issued_at)}
              </TableCell>
              <TableCell className="min-w-0">
                <p className="line-clamp-2 break-words font-medium">{wo.request_description}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {wo.requester.name}
                  {wo.requester_sub_bagian_name ? ` - ${wo.requester_sub_bagian_name}` : ""}
                </p>
                {equipment ? <p className="mt-0.5 truncate text-xs text-muted-foreground 2xl:hidden">Alat: {equipment}</p> : null}
              </TableCell>
              <TableCell className="hidden min-w-0 2xl:table-cell">
                <p className="line-clamp-2 break-words text-sm">{equipment || "-"}</p>
                {wo.location_name ? <p className="truncate text-xs text-muted-foreground">{wo.location_name}</p> : null}
              </TableCell>
              <TableCell className="min-w-0">
                <p className="truncate text-sm font-medium">{wo.executor_unit.display_name}</p>
                <p className="line-clamp-2 break-words text-xs text-muted-foreground">{category || "-"}</p>
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
                      <li key={assignee.id} className="flex min-w-0 items-center gap-1">
                        {assignee.is_lead ? (
                          <>
                            <Crown className="h-3 w-3 shrink-0 text-warning" aria-hidden />
                            <span className="sr-only">Ketua: </span>
                          </>
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
