"use client";

import { AlertTriangle, ArrowRightCircle, Clock, Eye, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatDateTime } from "@/lib/format";
import type { DailyActivity } from "@/types/daily-activity";
import { ActivityStatusBadge, WeekChip, WorkOrderChip } from "./activity-badges";
import type { ActivityRowActions } from "./activity-table";

interface ActivityCardsProps extends ActivityRowActions {
  items: DailyActivity[];
}

/** Mobile list (below md). Buttons are 40px tall; the title block opens the detail. */
export function ActivityCards({ items, onOpen, onEdit, onStatus, onDelete, canManage }: ActivityCardsProps) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const manage = canManage(item);
        return (
          <li key={item.id} className="panel p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <WeekChip week={item.week_of_month} />
                <span className="tabular truncate text-xs text-muted-foreground">{formatDate(item.activity_date)}</span>
              </div>
              <ActivityStatusBadge status={item.status} label={item.status_label} className="shrink-0" />
            </div>

            <button
              type="button"
              onClick={() => onOpen(item)}
              className="mt-2 block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              <p className="break-words font-semibold">{item.title}</p>
              <p className="mt-1 line-clamp-3 break-words text-sm text-muted-foreground">{item.description}</p>
            </button>

            {item.work_order ? (
              <div className="mt-2">
                {/* 40px tall on phones (touch target). */}
                <WorkOrderChip workOrder={item.work_order} className="h-10 px-3 text-xs" />
              </div>
            ) : null}

            <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              {item.follow_up ? (
                <div className="flex items-start gap-2">
                  <dt className="shrink-0 pt-px">
                    <ArrowRightCircle className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Tindak lanjut</span>
                  </dt>
                  <dd className="line-clamp-2 break-words">{item.follow_up}</dd>
                </div>
              ) : null}
              {item.obstacles ? (
                <div className="flex items-start gap-2">
                  <dt className="shrink-0 pt-px">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Kendala</span>
                  </dt>
                  <dd className="line-clamp-2 break-words">{item.obstacles}</dd>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <dt className="shrink-0">
                  <UserAvatar name={item.user.name} photoUrl={item.user.photo_url} className="h-5 w-5 text-[9px]" />
                  <span className="sr-only">Penanggung jawab</span>
                </dt>
                <dd className="min-w-0 truncate">
                  <span className="font-medium text-foreground">{item.user.name}</span>
                  {item.org_unit?.name ? ` · ${item.org_unit.name}` : ""}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="shrink-0">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Waktu upload</span>
                </dt>
                <dd className="tabular min-w-0 truncate">
                  {formatDateTime(item.created_at)}
                  {item.created_by && item.created_by.id !== item.user.id ? ` oleh ${item.created_by.name}` : ""}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex gap-2 border-t pt-3">
              <Button variant="outline" className="flex-1" onClick={() => onOpen(item)}>
                <Eye />
                Detail
              </Button>
              {manage ? (
                <>
                  <Button variant="soft" className="flex-1" onClick={() => onStatus(item)}>
                    <RefreshCw />
                    Update Status
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="outline" aria-label={`Aksi lainnya untuk ${item.title}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
