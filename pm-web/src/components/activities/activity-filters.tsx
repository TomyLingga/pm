"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { PeriodFields, PeriodHint } from "@/components/common/period-fields";
import { SearchBox } from "@/components/common/search-box";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { listDailyActivityPeople } from "@/lib/daily-activities";
import { ACTIVITY_STATUS_OPTIONS, WEEK_OPTIONS } from "@/lib/daily-activity-constants";
import { formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { DailyActivityScope } from "@/types/daily-activity";
import { ACTIVITY_STATUS_STYLES } from "./activity-badges";
import { encodeStatusParam, type ActivityFilters as Filters } from "./use-activity-list-params";

interface ActivityFiltersProps {
  filters: Filters;
  scope: DailyActivityScope;
  /** Statuses in effect (empty = every status). */
  selectedStatuses: readonly string[];
  /** Whether the period applies to the selection (closed or every status). */
  showPeriod: boolean;
  /** Effective period (URL value or the default); empty when it does not apply. */
  period: { from?: string; to?: string };
  /** Period differs from the default; counts as an active filter. */
  customPeriod: boolean;
  activeFilterCount: number;
  /** `meta.summary.total` of the current result. */
  total: number | undefined;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
}

/** Status chip: 40px tall on touch screens, compact on desktop (same as the PM task list). */
const chipClassName =
  "inline-flex h-10 shrink-0 select-none items-center rounded-full border px-3 text-xs font-semibold transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] sm:h-8";
const chipIdleClassName = "border-border bg-card text-muted-foreground hover:bg-surface-2 hover:text-foreground";

const WEEK_SEGMENTS = [
  { value: "", label: "Semua minggu" },
  ...WEEK_OPTIONS.map((option) => ({
    value: option.value,
    label: (
      <>
        {option.label}
        <span className="ml-1 font-normal opacity-80">({option.range})</span>
      </>
    ),
  })),
];

export function ActivityFilters({
  filters,
  scope,
  selectedStatuses,
  showPeriod,
  period,
  customPeriod,
  activeFilterCount,
  total,
  onChange,
  onReset,
}: ActivityFiltersProps) {
  const [expanded, setExpanded] = React.useState(false);
  const showPeople = scope !== "mine";
  const people = useQuery({
    queryKey: queryKeys.dailyActivityPeople(""),
    queryFn: ({ signal }) => listDailyActivityPeople("", signal),
    enabled: showPeople,
    staleTime: 5 * 60 * 1000,
  });

  // Status and week chips are always visible; only the PIC select and the period live in the collapsible panel.
  const panelCount = (showPeople && filters.user_id ? 1 : 0) + (customPeriod ? 1 : 0);
  const hasAnyFilter = activeFilterCount > 0 || !!filters.q;

  const toggleStatus = (status: string) => {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((value) => value !== status)
      : [...selectedStatuses, status];
    // `encodeStatusParam` keeps a stable order and maps the default selection to an empty URL value.
    onChange({ status: encodeStatusParam(next) });
  };

  return (
    <div className="panel space-y-3 p-3 sm:p-4">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox
            value={filters.q}
            onCommit={(q) => onChange({ q })}
            placeholder="Cari judul, kegiatan, atau kendala…"
            aria-label="Cari laporan"
          />
        </div>
        <Button
          variant="outline"
          className="shrink-0 lg:hidden"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="activity-filter-panel"
          aria-label={panelCount > 0 ? `Filter lainnya, ${panelCount} aktif` : "Filter lainnya"}
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filter</span>
          {panelCount > 0 ? (
            <span className="tabular rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">
              {panelCount}
            </span>
          ) : null}
        </Button>
      </div>

      <div role="group" aria-label="Filter status" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => onChange({ status: encodeStatusParam([]) })}
          aria-pressed={selectedStatuses.length === 0}
          className={cn(
            chipClassName,
            selectedStatuses.length === 0 ? "border-primary bg-primary text-primary-foreground" : chipIdleClassName,
          )}
        >
          Semua status
        </button>
        {ACTIVITY_STATUS_OPTIONS.map((option) => {
          const active = selectedStatuses.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleStatus(option.value)}
              aria-pressed={active}
              className={cn(
                chipClassName,
                "font-bold tracking-wide",
                active ? ACTIVITY_STATUS_STYLES[option.value] : chipIdleClassName,
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        id="activity-filter-panel"
        className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", expanded ? "grid" : "hidden lg:grid")}
      >
        {showPeople ? (
          <Field label="Penanggung jawab (PIC)" htmlFor="activity-filter-pic">
            <Select
              id="activity-filter-pic"
              value={filters.user_id}
              onChange={(event) => onChange({ user_id: event.target.value })}
              disabled={people.isPending}
            >
              <option value="">{people.isPending ? "Memuat…" : "Semua orang"}</option>
              {people.data?.map((person) => (
                <option key={person.id} value={String(person.id)}>
                  {person.name}
                  {person.org_unit?.name ? ` (${person.org_unit.name})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {showPeriod ? (
          <PeriodFields
            idPrefix="activity-filter"
            from={period.from ?? ""}
            to={period.to ?? ""}
            onChange={onChange}
            labels={{ from: "Tanggal dari", to: "Tanggal sampai" }}
          />
        ) : null}

        <div className="flex items-end">
          <Button variant="ghost" className="w-full" onClick={onReset} disabled={!hasAnyFilter}>
            <RotateCcw />
            Reset filter
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 max-w-full overflow-x-auto px-1 py-0.5">
          <Segmented
            name="activity-week"
            aria-label="Minggu dalam bulan"
            value={filters.week ?? ""}
            options={WEEK_SEGMENTS}
            onChange={(value) => onChange({ week: value })}
            size="sm"
            className="[&_label]:min-h-10 [&_label]:whitespace-nowrap sm:[&_label]:min-h-8"
          />
        </div>
        <p className="tabular text-xs text-muted-foreground" aria-live="polite">
          Total:{" "}
          <span className="font-semibold text-foreground">{total !== undefined ? total.toLocaleString("id-ID") : "…"}</span>{" "}
          laporan
          {showPeriod && period.from && period.to ? (
            <>
              {" "}
              &middot; Periode: {formatDate(period.from)} s/d {formatDate(period.to)}
            </>
          ) : null}
        </p>
      </div>

      <PeriodHint
        visible={showPeriod}
        finished="laporan yang sudah closed"
        running="laporan open dan on progress"
        by="menurut tanggal aktivitas"
      />
    </div>
  );
}
