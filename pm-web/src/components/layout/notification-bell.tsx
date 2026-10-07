"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, BellRing, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { errorMessage } from "@/lib/api";
import { documentHref } from "@/lib/approvals";
import { formatRelative } from "@/lib/format";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/notification";

/** Route by `document_type`/`document_id`, falling back to the per-type id fields. */
function notificationHref(notification: AppNotification): string | null {
  return (
    documentHref(notification.document_type, notification.document_id) ??
    documentHref("service_request", notification.service_request_id) ??
    documentHref("pm_task", notification.pm_task_id) ??
    documentHref("work_program", notification.work_program_id) ??
    documentHref("work_order", notification.work_order_id)
  );
}

/** Rows shaped like the list while it loads. */
function ListSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-1 p-1">
      <span className="sr-only">Memuat notifikasi…</span>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 px-3 py-2.5" aria-hidden>
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const unread = useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: ({ signal }) => getUnreadCount(signal),
    refetchInterval: 60 * 1000,
  });

  const list = useQuery({
    queryKey: queryKeys.notificationList,
    queryFn: ({ signal }) => getNotifications({ page: 1 }, signal),
    enabled: open,
    staleTime: 0,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications });

  const markRead = useMutation({
    mutationFn: (id: AppNotification["id"]) => markNotificationRead(id),
    onSettled: invalidate,
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => toast.success("Semua notifikasi ditandai dibaca."),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: invalidate,
  });

  const count = unread.data ?? 0;
  const items = list.data?.data ?? [];

  const openNotification = (notification: AppNotification) => {
    if (!notification.read_at) markRead.mutate(notification.id);
    const href = notificationHref(notification);
    if (href) router.push(href);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count > 0 ? `Notifikasi, ${count} belum dibaca` : "Notifikasi"}
        >
          <Bell className="!size-5" aria-hidden />
          {count > 0 ? (
            <span
              className="tabular absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background"
              aria-hidden
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-sm font-semibold">
            Notifikasi
            {count > 0 ? <span className="tabular ml-1.5 text-xs font-medium text-muted-foreground">{count} baru</span> : null}
          </p>
          <Button
            variant="soft"
            size="xs"
            disabled={count === 0 || markAll.isPending}
            loading={markAll.isPending}
            onClick={(event) => {
              event.preventDefault();
              markAll.mutate();
            }}
          >
            {markAll.isPending ? null : <CheckCheck aria-hidden />}
            Tandai semua dibaca
          </Button>
        </div>
        <DropdownMenuSeparator className="mx-0 my-0" />
        <div className="max-h-[min(26rem,70dvh)] overflow-y-auto [overscroll-behavior:contain]">
          {list.isPending ? (
            <ListSkeleton />
          ) : list.isError ? (
            <div role="alert" className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <p className="text-sm text-danger-foreground">{errorMessage(list.error)}</p>
              <Button variant="outline" size="xs" onClick={() => list.refetch()}>
                Coba lagi
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-muted-foreground">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2">
                <BellOff className="h-4 w-4" aria-hidden />
              </span>
              <p className="text-sm">Belum ada notifikasi.</p>
            </div>
          ) : (
            <div className="p-1">
              {items.map((notification) => {
                const isUnread = !notification.read_at;
                return (
                  <DropdownMenuItem
                    key={notification.id}
                    onSelect={() => openNotification(notification)}
                    className={cn("items-start gap-3 px-3 py-2.5", isUnread && "bg-primary-soft/50 focus:bg-primary-soft/70")}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        notification.alarm
                          ? "bg-danger-soft text-danger-foreground"
                          : "bg-primary-soft text-primary-soft-foreground",
                      )}
                      aria-hidden
                    >
                      {notification.alarm ? <BellRing /> : <Bell />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("line-clamp-2 block text-sm", isUnread ? "font-semibold" : "font-medium")}>
                        {notification.title}
                      </span>
                      {notification.body ? (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{notification.body}</span>
                      ) : null}
                      <span className="tabular mt-1 block text-[11px] text-muted-foreground">
                        {formatRelative(notification.created_at)}
                      </span>
                    </span>
                    {isUnread ? (
                      <span className="mt-1.5 flex shrink-0 items-center">
                        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                        <span className="sr-only">Belum dibaca</span>
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
