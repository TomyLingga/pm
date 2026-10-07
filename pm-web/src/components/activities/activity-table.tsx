"use client";

import { Clock, Eye, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import type { DailyActivity } from "@/types/daily-activity";
import { ActivityStatusBadge, WeekChip, WorkOrderChip } from "./activity-badges";

export interface ActivityRowActions {
  onOpen: (item: DailyActivity) => void;
  onEdit: (item: DailyActivity) => void;
  onStatus: (item: DailyActivity) => void;
  onDelete: (item: DailyActivity) => void;
  /** Whether the row shows edit/status/delete (the server still decides; 403 becomes a toast). */
  canManage: (item: DailyActivity) => boolean;
}

interface ActivityTableProps extends ActivityRowActions {
  items: DailyActivity[];
  /** Row number of the first item (`meta.from`). */
  startNumber: number;
}

/** Desktop table (md and up). Follow-up and obstacles get their own columns from 2xl up. */
export function ActivityTable({ items, startNumber, onOpen, onEdit, onStatus, onDelete, canManage }: ActivityTableProps) {
  return (
    <Table className="table-fixed min-w-[1000px] 2xl:min-w-[1260px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-11 text-right">No</TableHead>
          <TableHead className="w-[60px]">Minggu</TableHead>
          <TableHead>Laporan kegiatan</TableHead>
          <TableHead className="hidden w-[150px] 2xl:table-cell">Tindak lanjut</TableHead>
          <TableHead className="hidden w-[140px] 2xl:table-cell">Kendala</TableHead>
          <TableHead className="w-[96px]">Tanggal</TableHead>
          <TableHead className="w-[112px]">Status</TableHead>
          <TableHead className="w-[160px]">Penanggung jawab</TableHead>
          <TableHead className="w-[124px]">Waktu upload</TableHead>
          <TableHead className="w-[176px] text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => {
          const manage = canManage(item);
          const recordedByOther = item.created_by && item.created_by.id !== item.user.id;
          return (
            // Row click opens the detail; the title is the real button (keyboard users).
            <TableRow key={item.id} className="cursor-pointer" onClick={() => onOpen(item)}>
              <TableCell className="tabular text-right text-xs text-muted-foreground">{startNumber + index}</TableCell>
              <TableCell>
                <WeekChip week={item.week_of_month} />
              </TableCell>
              <TableCell className="min-w-0">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(item);
                  }}
                  className="rounded-sm text-left font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="line-clamp-2 break-words">{item.title}</span>
                </button>
                <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">{item.description}</p>
                {item.work_order ? (
                  <div className="mt-1">
                    <WorkOrderChip workOrder={item.work_order} />
                  </div>
                ) : null}
                <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground 2xl:hidden">
                  {item.follow_up ? (
                    <div className="flex gap-1">
                      <dt className="shrink-0 font-medium">Tindak lanjut:</dt>
                      <dd className="line-clamp-1 break-words">{item.follow_up}</dd>
                    </div>
                  ) : null}
                  {item.obstacles ? (
                    <div className="flex gap-1">
                      <dt className="shrink-0 font-medium">Kendala:</dt>
                      <dd className="line-clamp-1 break-words">{item.obstacles}</dd>
                    </div>
                  ) : null}
                </dl>
              </TableCell>
              <TableCell className="hidden min-w-0 2xl:table-cell">
                <p className="line-clamp-3 break-words text-sm">{item.follow_up || <span className="text-muted-foreground">-</span>}</p>
              </TableCell>
              <TableCell className="hidden min-w-0 2xl:table-cell">
                <p className="line-clamp-3 break-words text-sm">{item.obstacles || <span className="text-muted-foreground">-</span>}</p>
              </TableCell>
              <TableCell className="tabular whitespace-nowrap text-xs">{formatDate(item.activity_date)}</TableCell>
              <TableCell>
                <ActivityStatusBadge status={item.status} label={item.status_label} />
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar name={item.user.name} photoUrl={item.user.photo_url} className="h-7 w-7 text-[11px]" />
                  <div className="min-w-0">
                    <p className="line-clamp-2 break-words text-sm font-medium leading-tight">{item.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.org_unit?.name ?? item.user.position ?? "-"}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="tabular inline-flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{formatDateTime(item.created_at)}</span>
                </span>
                {recordedByOther ? (
                  <p className="mt-0.5 line-clamp-2 break-words text-[11px] text-muted-foreground">oleh {item.created_by?.name}</p>
                ) : null}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                  {manage ? (
                    <Button size="xs" variant="outline" onClick={() => onStatus(item)}>
                      <RefreshCw />
                      Update Status
                    </Button>
                  ) : (
                    <Button size="xs" variant="outline" onClick={() => onOpen(item)}>
                      <Eye />
                      Detail
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" aria-label={`Aksi lainnya untuk ${item.title}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    {/* Portaled, but React events still bubble to the row: stop them here. */}
                    <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => onOpen(item)}>
                        <Eye />
                        Lihat detail
                      </DropdownMenuItem>
                      {manage ? (
                        <>
                          <DropdownMenuItem onSelect={() => onEdit(item)}>
                            <Pencil />
                            Ubah laporan
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => onDelete(item)}
                            className="text-danger-foreground focus:bg-danger-soft focus:text-danger-foreground"
                          >
                            <Trash2 />
                            Hapus laporan
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
