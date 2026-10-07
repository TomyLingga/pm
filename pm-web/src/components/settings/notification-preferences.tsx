"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, Smartphone } from "lucide-react";
import { ErrorState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { errorMessage } from "@/lib/api";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/notifications";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { NotificationPreferences as Preferences } from "@/types/dashboard";


/** One notification channel line: icon, name, explanation, control on the right. */
function ChannelRow({
  icon,
  title,
  description,
  control,
  muted,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  control?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <li className={cn("flex items-center gap-3 px-4 py-3 sm:px-5", muted && "bg-surface-2/60")}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {control ? <div className="shrink-0">{control}</div> : null}
    </li>
  );
}

/** "Kirim juga lewat email" toggle bound to `GET/PUT /notifications/preferences`. */
export function NotificationPreferences() {
  const me = useCurrentUser();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn: ({ signal }) => getNotificationPreferences(signal),
  });

  const mutation = useMutation({
    mutationFn: (email: boolean) => updateNotificationPreferences(email),
    onMutate: async (email) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notificationPreferences });
      const previous = queryClient.getQueryData<Preferences>(queryKeys.notificationPreferences);
      if (previous) queryClient.setQueryData(queryKeys.notificationPreferences, { ...previous, email });
      return { previous };
    },
    onError: (error, _email, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.notificationPreferences, context.previous);
      toast.error(errorMessage(error));
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.notificationPreferences, saved);
      toast.success(saved.email ? "Notifikasi email diaktifkan." : "Notifikasi email dimatikan.");
    },
  });

  const preferences = query.data;
  const emailOn = !!preferences?.email;
  const available = !!preferences?.email_available;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Kanal notifikasi</CardTitle>
          <CardDescription>
            Notifikasi di aplikasi (ikon lonceng) selalu aktif. Push ke HP aktif bila aplikasi mobile terdaftar.
          </CardDescription>
        </CardHeader>
        <ul className="divide-y">
          <ChannelRow
            icon={<Bell aria-hidden />}
            title="Di aplikasi"
            description="Selalu aktif"
            control={<Badge variant="success">Aktif</Badge>}
          />
          <ChannelRow
            icon={<Smartphone aria-hidden />}
            title="Push ke HP"
            description="Aktif otomatis saat masuk dari aplikasi mobile PrevenTech"
            control={<Badge variant="neutral">Otomatis</Badge>}
          />
          {query.isPending ? (
            <li className="flex items-center gap-3 px-4 py-3 sm:px-5" aria-hidden>
              <Skeleton className="h-9 w-9" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </li>
          ) : query.isError ? (
            <li className="p-4 sm:p-5">
              <ErrorState
                title="Gagal memuat preferensi"
                message={errorMessage(query.error)}
                onRetry={() => query.refetch()}
              />
            </li>
          ) : (
            <ChannelRow
              icon={<Mail aria-hidden />}
              title="Kirim juga lewat email"
              muted={!available}
              description={
                available
                  ? `Ke ${me.email ?? "email akun Portal Anda"}. Berisi judul, isi, dan tombol "Buka" ke dokumen.`
                  : me.email
                    ? "Kanal email belum diaktifkan di server oleh admin."
                    : "Akun Anda tidak memiliki alamat email di Portal."
              }
              control={
                <Switch
                  checked={emailOn}
                  onCheckedChange={(next) => mutation.mutate(next)}
                  disabled={!available || mutation.isPending}
                  label="Kirim notifikasi lewat email"
                />
              }
            />
          )}
        </ul>
      </Card>
    </div>
  );
}
