"use client";

import * as React from "react";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { PeriodFields, PeriodHint } from "@/components/common/period-fields";
import { SearchBox } from "@/components/common/search-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { PM_FINAL_STATUSES, defaultPeriod, periodApplies } from "@/lib/list-period";
import { PM_STATUS_OPTIONS } from "@/lib/pm-constants";
import { cn } from "@/lib/utils";
import type { UnitRef } from "@/types/pm";
import { PM_STATUS_STYLES } from "../pm-badges";
import type { TaskFilters as Filters } from "./use-task-list-params";

interface TaskFiltersProps {
  filters: Filters;
  activeFilterCount: number;
  /** Units offered in the unit filter (own units, or all units for the "Semua" tab). */
  units: UnitRef[];
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
}

/** Status chip: 40px tall on touch screens, compact on desktop. */
const chipClassName =
  "inline-flex h-10 shrink-0 select-none items-center rounded-full border px-3 text-xs font-semibold transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] sm:h-8";
const chipIdleClassName = "border-border bg-card text-muted-foreground hover:bg-surface-2 hover:text-foreground";

export function TaskFilters({ filters, activeFilterCount, units, onChange, onReset }: TaskFiltersProps) {
  const [expanded, setExpanded] = React.useState(false);
  const selectedStatuses = filters.status ? filters.status.split(",").filter(Boolean) : [];
  const fallback = React.useMemo(() => defaultPeriod(), []);
  const showPeriod = periodApplies(filters.status, PM_FINAL_STATUSES);
  const linked = [
    filters.schedule_id ? { key: "schedule_id" as const, label: "Hanya tugas dari satu jadwal" } : null,
    filters.equipment_id ? { key: "equipment_id" as const, label: "Hanya tugas satu equipment" } : null,
  ].filter((entry): entry is { key: "schedule_id" | "equipment_id"; label: string } => entry !== null);
  const panelCount = activeFilterCount - (filters.status ? 1 : 0) - linked.length;

  const toggleStatus = (status: string) => {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((value) => value !== status)
      : [...selectedStatuses, status];
    // Keep a stable order so equal selections produce the same URL.
    const ordered = PM_STATUS_OPTIONS.map((option) => option.value as string).filter((value) => next.includes(value));
    onChange({ status: ordered.join(",") });
  };

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox value={filters.q} onCommit={(q) => onChange({ q })} placeholder="Cari alat atau jadwal…" />
        </div>
        <Button
          variant="outline"
          className="lg:hidden"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="pm-task-filter-panel"
          aria-label="Filter lainnya"
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filter</span>
          {panelCount > 0 ? (
            <Badge className="tabular min-w-5 justify-center px-1.5 py-0 text-[11px] leading-5">{panelCount}</Badge>
          ) : null}
        </Button>
      </div>

      {linked.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {linked.map((entry) => (
            <Badge key={entry.key} variant="primary" className="gap-1 py-0.5 pr-1">
              {entry.label}
              <button
                type="button"
                onClick={() => onChange(entry.key === "schedule_id" ? { schedule_id: "" } : { equipment_id: "" })}
                className="-my-1 inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-150 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Hapus filter: ${entry.label}`}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div role="group" aria-label="Filter status" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => onChange({ status: "" })}
          aria-pressed={selectedStatuses.length === 0}
          className={cn(
            chipClassName,
            selectedStatuses.length === 0 ? "border-primary bg-primary text-primary-foreground" : chipIdleClassName,
          )}
        >
          Semua status
        </button>
        {PM_STATUS_OPTIONS.map((option) => {
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
                active ? PM_STATUS_STYLES[option.value] : chipIdleClassName,
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        id="pm-task-filter-panel"
        className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5", expanded ? "grid" : "hidden lg:grid")}
      >
        <Field label="Unit pelaksana" htmlFor="pm-filter-unit">
          <Select
            id="pm-filter-unit"
            value={filters.executor_unit_id}
            onChange={(event) => onChange({ executor_unit_id: event.target.value })}
            disabled={units.length === 0}
          >
            <option value="">Semua</option>
            {units.map((unit) => (
              <option key={unit.id} value={String(unit.id)}>
                {unit.display_name}
              </option>
            ))}
          </Select>
        </Field>

        {showPeriod ? (
          <PeriodFields
            idPrefix="pm-filter"
            from={filters.from || fallback.from}
            to={filters.to || fallback.to}
            onChange={onChange}
          />
        ) : null}

        <Field label="Urutkan" htmlFor="pm-filter-sort">
          <Select id="pm-filter-sort" value={filters.sort} onChange={(event) => onChange({ sort: event.target.value })}>
            <option value="">Jatuh tempo terlama dulu</option>
            <option value="-due_at">Jatuh tempo terbaru dulu</option>
          </Select>
        </Field>

        <div className="flex items-end">
          <Button
            variant="ghost"
            className="w-full"
            onClick={onReset}
            disabled={activeFilterCount === 0 && !filters.q && !filters.sort}
          >
            <RotateCcw />
            Reset filter
          </Button>
        </div>
      </div>
      <PeriodHint
        visible={showPeriod}
        finished="tugas yang sudah selesai atau dilewati"
        running="tugas terjadwal, jatuh tempo, terlambat, dan dikerjakan"
      />
    </div>
  );
}
