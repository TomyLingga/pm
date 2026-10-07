"use client";

import * as React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users } from "lucide-react";
import { useUrlListState } from "@/hooks/use-url-list-state";
import { Pagination } from "@/components/common/pagination";
import { SearchBox } from "@/components/common/search-box";
import { EmptyState, ErrorState } from "@/components/common/states";
import { UserAvatar } from "@/components/common/user-avatar";
import { useCurrentUser } from "@/components/layout/current-user";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, isApiError } from "@/lib/api";
import { listAccessUsers, setAdmin } from "@/lib/access";
import { isAdmin } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AccessUser } from "@/types/access";

const FILTER_KEYS = ["q"] as const;
const ROLE_SCOPES = ["all", "admin", "user"] as const;
type RoleScope = (typeof ROLE_SCOPES)[number];
const ROLE_LABELS: Record<RoleScope, string> = { all: "Semua pengguna", admin: "Admin", user: "User biasa" };

function RoleSwitch({ user, disabled }: { user: AccessUser; disabled?: boolean }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (next: boolean) => setAdmin(user.id, next),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accessUsers() });
      toast.success(saved.is_admin ? `${saved.name} sekarang admin.` : `Hak admin ${saved.name} dicabut.`);
    },
    onError: (error) => {
      toast.error(isApiError(error) ? (error.fieldError("is_admin") ?? errorMessage(error)) : errorMessage(error));
    },
  });
  const checked = user.is_admin;
  const locked = disabled || user.is_me || mutation.isPending;

  return (
    <Switch
      checked={checked}
      onCheckedChange={(next) => mutation.mutate(next)}
      disabled={locked}
      label={`${checked ? "Cabut" : "Berikan"} hak admin ${user.name}`}
      title={user.is_me ? "Anda tidak dapat mengubah hak akses sendiri" : undefined}
    />
  );
}

function RowSkeleton() {
  return (
    <ul className="divide-y" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

/** Admin page: who sees everything (admin) and who sees only their unit (regular users). */
export function UserAccess() {
  const me = useCurrentUser();
  const admin = isAdmin(me);
  const { scope, filters, page, setFilters, setScope, setPage } = useUrlListState(FILTER_KEYS, ROLE_SCOPES);

  const params = React.useMemo(
    () => ({ q: filters.q || undefined, role: scope === "all" ? undefined : scope, page }),
    [filters.q, page, scope],
  );
  const query = useQuery({
    queryKey: queryKeys.accessUsers(params),
    queryFn: ({ signal }) => listAccessUsers(params, signal),
    placeholderData: keepPreviousData,
    enabled: admin,
  });

  if (!admin) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
        title="Hanya admin yang dapat mengatur hak akses"
        description="Minta admin PrevenTech untuk memberikan hak admin bila Anda perlu melihat semua unit."
      />
    );
  }

  const items = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="panel flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Admin</p>
            <p className="text-xs text-muted-foreground">
              Melihat Work Order, Form Request, dan PM semua unit, mengelola kategori, serta mengatur hak akses ini.
            </p>
          </div>
          {meta ? <span className="tabular ml-auto text-2xl font-semibold">{meta.admin_count}</span> : null}
        </div>
        <div className="panel flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">User biasa</p>
            <p className="text-xs text-muted-foreground">
              Hanya melihat dokumen unitnya sendiri dan dokumen yang ia ajukan. Peran pimpinan/teknisi mengikuti grade di Portal.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={scope} onValueChange={(value) => setScope(value as RoleScope)}>
          <TabsList aria-label="Filter peran">
            {ROLE_SCOPES.map((value) => (
              <TabsTrigger key={value} value={value}>
                {ROLE_LABELS[value]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="sm:w-80">
          <SearchBox value={filters.q} onCommit={(q) => setFilters({ q })} placeholder="Cari nama, NRK, atau email…" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {query.isPending ? (
          <RowSkeleton />
        ) : query.isError ? (
          <CardContent className="p-4">
            <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
          </CardContent>
        ) : items.length === 0 ? (
          <CardContent className="p-4">
            <EmptyState title="Tidak ada pengguna yang cocok" description="Coba kata kunci lain atau ubah filter peran." />
          </CardContent>
        ) : (
          <ul className={cn("divide-y", query.isPlaceholderData && "opacity-60")} aria-busy={query.isFetching || undefined}>
            {items.map((user) => (
              <li key={user.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60">
                <UserAvatar name={user.name} photoUrl={user.photo_url} className="h-9 w-9 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    {user.is_admin ? <Badge variant="primary">Admin</Badge> : null}
                    {user.is_me ? <span className="text-xs text-muted-foreground">(Anda)</span> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="tabular">{user.nrk ?? "-"}</span>
                    {user.position ? <> &middot; {user.position}</> : null}
                    {user.org_unit ? <> &middot; {user.org_unit.name}</> : null}
                  </p>
                </div>
                <RoleSwitch user={user} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {meta && items.length > 0 ? (
        <Pagination meta={meta} onPageChange={setPage} itemLabel="pengguna" disabled={query.isFetching} />
      ) : null}
    </div>
  );
}
