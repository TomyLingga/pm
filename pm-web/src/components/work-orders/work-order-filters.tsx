"use client";

import * as React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { PeriodFields, PeriodHint } from "@/components/common/period-fields";
import { SearchBox } from "@/components/common/search-box";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useExecutorUnits } from "@/hooks/use-lookups";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "@/lib/constants";
import { WO_FINAL_STATUSES, defaultPeriod, periodApplies } from "@/lib/list-period";
import { cn } from "@/lib/utils";
import type { ListFilters } from "./use-list-params";

interface WorkOrderFiltersProps {
  filters: ListFilters;
  activeFilterCount: number;
  onChange: (patch: Partial<ListFilters>) => void;
  onReset: () => void;
}

export function WorkOrderFilters({ filters, activeFilterCount, onChange, onReset }: WorkOrderFiltersProps) {
  const [expanded, setExpanded] = React.useState(false);
  const executorUnits = useExecutorUnits();
  const fallback = React.useMemo(() => defaultPeriod(), []);
  const showPeriod = periodApplies(filters.status, WO_FINAL_STATUSES);

  const selectedUnit = executorUnits.data?.find((unit) => String(unit.id) === filters.executor_unit_id);
  const categories = selectedUnit?.categories ?? [];

  return (
    <div className="panel space-y-3 p-3 sm:p-4">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox
            value={filters.q}
            onCommit={(q) => onChange({ q })}
            placeholder="Cari no WO, permintaan, atau alat…"
            aria-label="Cari Work Order"
          />
        </div>
        <Button
          variant="outline"
          className="shrink-0 lg:hidden"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="wo-filter-panel"
          aria-label={activeFilterCount > 0 ? `Filter, ${activeFilterCount} aktif` : "Filter"}
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filter</span>
          {activeFilterCount > 0 ? (
            <span className="tabular rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </div>

      <div
        id="wo-filter-panel"
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7",
          expanded ? "grid" : "hidden lg:grid",
        )}
      >
        <Field label="Status" htmlFor="filter-status">
          <Select id="filter-status" value={filters.status} onChange={(e) => onChange({ status: e.target.value })}>
            <option value="">Semua</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Prioritas" htmlFor="filter-priority">
          <Select
            id="filter-priority"
            value={filters.priority}
            onChange={(e) => onChange({ priority: e.target.value })}
          >
            <option value="">Semua</option>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Unit pelaksana" htmlFor="filter-executor">
          <Select
            id="filter-executor"
            value={filters.executor_unit_id}
            onChange={(e) => onChange({ executor_unit_id: e.target.value, service_category_id: "" })}
            disabled={executorUnits.isPending}
          >
            <option value="">{executorUnits.isPending ? "Memuat…" : "Semua"}</option>
            {executorUnits.data?.map((unit) => (
              <option key={unit.id} value={String(unit.id)}>
                {unit.display_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Kategori"
          htmlFor="filter-category"
          hint={selectedUnit ? undefined : "Pilih unit pelaksana terlebih dahulu."}
        >
          <Select
            id="filter-category"
            value={filters.service_category_id}
            onChange={(e) => onChange({ service_category_id: e.target.value })}
            disabled={!selectedUnit}
          >
            <option value="">{selectedUnit ? "Semua" : "Pilih unit dulu"}</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        {showPeriod ? (
          <PeriodFields
            idPrefix="filter"
            from={filters.from || fallback.from}
            to={filters.to || fallback.to}
            onChange={onChange}
          />
        ) : null}

        <div className="flex items-end">
          <Button
            variant="ghost"
            className="w-full"
            onClick={onReset}
            disabled={activeFilterCount === 0 && !filters.q}
          >
            <RotateCcw />
            Reset filter
          </Button>
        </div>
      </div>
      <PeriodHint
        visible={showPeriod}
        finished="WO yang sudah closed, dibatalkan, atau dialihkan"
        running="WO yang masih berjalan (diajukan, diterima, dikerjakan, selesai)"
      />
    </div>
  );
}
