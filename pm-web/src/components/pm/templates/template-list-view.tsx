"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, Plus, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { SearchBox } from "@/components/common/search-box";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useChecklistTemplates } from "@/hooks/use-pm";
import { useUrlListState } from "@/hooks/use-url-list-state";
import { errorMessage } from "@/lib/api";
import { canManagePm } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { ChecklistTemplateListParams } from "@/types/pm";
import { ActiveBadge } from "../pm-badges";
import { usePmUnits } from "../use-pm-units";

const FILTER_KEYS = ["executor_unit_id", "active", "q"] as const;
const SCOPES = ["list"] as const;

/** Placeholder shaped like the table (desktop) and the cards (phones). */
function ListSkeleton() {
  return (
    <div aria-hidden>
      <div className="panel hidden overflow-hidden md:block">
        <div className="h-10 border-b bg-surface-2/70" />
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_200px_90px_90px_150px_100px] items-center gap-3 px-3 py-3"
            >
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-6" />
              <Skeleton className="ml-auto h-4 w-6" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <ul className="space-y-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="panel space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-56" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TemplateListView() {
  const me = useCurrentUser();
  const router = useRouter();
  const { units } = usePmUnits();
  const { filters, activeFilterCount, setFilters, resetFilters } = useUrlListState(FILTER_KEYS, SCOPES);

  const params: ChecklistTemplateListParams = React.useMemo(
    () => ({
      executor_unit_id: filters.executor_unit_id || undefined,
      // The API only knows `active=1`; "nonaktif" is filtered on the client.
      active: filters.active === "1" ? "1" : undefined,
      q: filters.q || undefined,
    }),
    [filters],
  );
  const query = useChecklistTemplates(params);

  const items = (query.data ?? []).filter((template) => (filters.active === "0" ? !template.is_active : true));
  const hasFilters = activeFilterCount > 0 || !!filters.q;
  const canCreate = canManagePm(me);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Template Checklist"
        description="Daftar butir pemeriksaan yang dipakai jadwal PM."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/pm/templates/new">
                <Plus />
                Buat Template
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_12rem_10rem_auto] sm:items-end sm:p-5">
        <SearchBox value={filters.q} onCommit={(q) => setFilters({ q })} placeholder="Cari nama template…" />
        <Field label="Unit pelaksana" htmlFor="template-filter-unit">
          <Select
            id="template-filter-unit"
            value={filters.executor_unit_id}
            onChange={(event) => setFilters({ executor_unit_id: event.target.value })}
          >
            <option value="">Semua</option>
            {units.map((unit) => (
              <option key={unit.id} value={String(unit.id)}>
                {unit.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="template-filter-active">
          <Select
            id="template-filter-active"
            value={filters.active}
            onChange={(event) => setFilters({ active: event.target.value })}
          >
            <option value="">Semua</option>
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </Select>
        </Field>
        <Button variant="ghost" onClick={resetFilters} disabled={!hasFilters}>
          <RotateCcw />
          Reset
        </Button>
      </div>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-5 w-5" aria-hidden />}
          title={hasFilters ? "Tidak ada template yang cocok" : "Belum ada template checklist"}
          description={
            hasFilters ? "Coba ubah atau reset filter." : "Template dibutuhkan sebelum membuat jadwal PM."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                Reset filter
              </Button>
            ) : canCreate ? (
              <Button asChild>
                <Link href="/pm/templates/new">
                  <Plus />
                  Buat Template
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="panel hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Template</TableHead>
                  <TableHead className="w-[200px]">Unit pelaksana</TableHead>
                  <TableHead className="w-[90px] text-right">Butir</TableHead>
                  <TableHead className="w-[90px] text-right">Jadwal</TableHead>
                  <TableHead className="w-[150px]">Diperbarui</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((template) => {
                  const href = `/pm/templates/${template.id}`;
                  return (
                    <TableRow key={template.id} className="cursor-pointer" onClick={() => router.push(href)}>
                      <TableCell>
                        <Link
                          href={href}
                          className="rounded-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {template.name}
                        </Link>
                        {template.description ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{template.description}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">{template.executor_unit.display_name}</TableCell>
                      <TableCell className="tabular text-right">{template.items_count}</TableCell>
                      <TableCell className="tabular text-right">{template.schedules_count}</TableCell>
                      <TableCell className="tabular whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(template.updated_at)}
                      </TableCell>
                      <TableCell>
                        <ActiveBadge active={template.is_active} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <ul className="space-y-3 md:hidden">
            {items.map((template) => (
              <li key={template.id}>
                <Link
                  href={`/pm/templates/${template.id}`}
                  className="panel block p-4 transition-colors duration-150 hover:bg-surface-2/60 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-semibold text-primary">{template.name}</p>
                    <ActiveBadge active={template.is_active} className="shrink-0" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{template.executor_unit.display_name}</p>
                  <p className="tabular mt-2 text-xs text-muted-foreground">
                    {template.items_count} butir &middot; dipakai {template.schedules_count} jadwal &middot; diperbarui{" "}
                    {formatDateTime(template.updated_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="tabular text-sm text-muted-foreground">{items.length} template</p>
        </>
      )}
    </div>
  );
}
