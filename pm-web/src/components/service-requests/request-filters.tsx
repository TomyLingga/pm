"use client";

import * as React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { PeriodFields, PeriodHint } from "@/components/common/period-fields";
import { SearchBox } from "@/components/common/search-box";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useExecutorUnits, useOffices } from "@/hooks/use-lookups";
import { SR_PRIORITY_OPTIONS, SR_STATUS_OPTIONS } from "@/lib/constants";
import { REQUEST_FINAL_STATUSES, defaultPeriod, periodApplies } from "@/lib/list-period";
import { cn } from "@/lib/utils";
import type { RequestFilters as Filters } from "./use-request-list-params";

interface RequestFiltersProps {
  filters: Filters;
  activeFilterCount: number;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
}

export function RequestFilters({ filters, activeFilterCount, onChange, onReset }: RequestFiltersProps) {
  const [expanded, setExpanded] = React.useState(false);
  const executorUnits = useExecutorUnits("request");
  const offices = useOffices();
  const fallback = React.useMemo(() => defaultPeriod(), []);
  const showPeriod = periodApplies(filters.status, REQUEST_FINAL_STATUSES);

  const selectedUnit = executorUnits.data?.find((unit) => String(unit.id) === filters.executor_unit_id);
  const categories = selectedUnit?.categories ?? [];
  const canReset = activeFilterCount > 0 || !!filters.q;

  return (
    <div className="panel space-y-3 p-3 sm:p-4">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox
            value={filters.q}
            onCommit={(q) => onChange({ q })}
            placeholder="Cari nomor request atau keperluan…"
            aria-label="Cari Form Request"
          />
        </div>
        <Button
          variant={expanded ? "secondary" : "outline"}
          className="shrink-0 xl:hidden"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="sr-filter-panel"
        >
          <SlidersHorizontal aria-hidden />
          <span className="sr-only sm:not-sr-only">Filter</span>
          {activeFilterCount > 0 ? (
            <span className="tabular inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {activeFilterCount}
              <span className="sr-only"> filter aktif</span>
            </span>
          ) : null}
        </Button>
      </div>

      <div
        id="sr-filter-panel"
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8",
          expanded ? "grid" : "hidden xl:grid",
        )}
      >
        <Field label="Status" htmlFor="sr-filter-status">
          <Select id="sr-filter-status" value={filters.status} onChange={(e) => onChange({ status: e.target.value })}>
            <option value="">Semua</option>
            {SR_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Prioritas" htmlFor="sr-filter-priority">
          <Select
            id="sr-filter-priority"
            value={filters.priority}
            onChange={(e) => onChange({ priority: e.target.value })}
          >
            <option value="">Semua</option>
            {SR_PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Unit pelaksana" htmlFor="sr-filter-executor">
          <Select
            id="sr-filter-executor"
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

        <Field label="Jenis permintaan" htmlFor="sr-filter-category">
          <Select
            id="sr-filter-category"
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

        <Field label="Office" htmlFor="sr-filter-office">
          <Select
            id="sr-filter-office"
            value={filters.office_id}
            onChange={(e) => onChange({ office_id: e.target.value })}
            disabled={offices.isPending}
          >
            <option value="">{offices.isPending ? "Memuat…" : "Semua"}</option>
            {offices.data?.map((office) => (
              <option key={office.id} value={String(office.id)}>
                {office.name}
              </option>
            ))}
          </Select>
        </Field>

        {showPeriod ? (
          <PeriodFields
            idPrefix="sr-filter"
            from={filters.from || fallback.from}
            to={filters.to || fallback.to}
            onChange={onChange}
          />
        ) : null}

        <div className="flex items-end">
          <Button variant="ghost" className="w-full" onClick={onReset} disabled={!canReset}>
            <RotateCcw aria-hidden />
            Reset filter
          </Button>
        </div>
      </div>
      <PeriodHint
        visible={showPeriod}
        finished="request yang sudah selesai, ditolak, dibatalkan, atau dialihkan"
        running="request yang masih berjalan (draft, menunggu atasan/divisi, diproses)"
      />
    </div>
  );
}
