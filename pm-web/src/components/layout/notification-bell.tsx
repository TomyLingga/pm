"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
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
    documentHref("work_order", notification.work_order_id)
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
          <Bell className="!size-5" />
          {count > 0 ? (
            <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <p className="text-sm font-semibold">Notifikasi</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={count === 0 || markAll.isPending}
            loading={markAll.isPending}
            onClick={(event) => {
              event.preventDefault();
              markAll.mutate();
            }}
          >
            {markAll.isPending ? null : <CheckCheck />}
            Tandai semua dibaca
          </Button>
        </div>
        <DropdownMenuSeparator className="mx-0 my-0" />
        <div className="max-h-[min(26rem,70dvh)] overflow-y-auto p-1">
          {list.isPending ? (
            <div className="flex justify-center py-8">
              <Spinner label="Memuat notifikasi..." />
            </div>
          ) : list.isError ? (
            <p className="px-3 py-6 text-center text-sm text-destructive">{errorMessage(list.error)}</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Belum ada notifikasi.</p>
          ) : (
            items.map((notification) => {
              const isUnread = !notification.read_at;
              return (
                <DropdownMenuItem
                  key={notification.id}
                  onSelect={() => openNotification(notification)}
                  className={cn("items-start gap-3 px-3 py-2.5", isUnread && "bg-accent/50")}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      notification.alarm ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary",
                    )}
                    aria-hidden
                  >
                    {notification.alarm ? <BellRing /> : <Bell />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", isUnread ? "font-semibold" : "font-medium")}>
                      {notification.title}
                    </span>
                    {notification.body ? (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                        {notification.body}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {formatRelative(notification.created_at)}
                    </span>
                  </span>
                  {isUnread ? (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Belum dibaca" />
                  ) : null}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
