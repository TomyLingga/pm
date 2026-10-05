"use client";

import * as React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { SearchBox } from "@/components/common/search-box";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useExecutorUnits } from "@/hooks/use-lookups";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "@/lib/constants";
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

  const selectedUnit = executorUnits.data?.find((unit) => String(unit.id) === filters.executor_unit_id);
  const categories = selectedUnit?.categories ?? [];

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchBox
            value={filters.q}
            onCommit={(q) => onChange({ q })}
            placeholder="Cari no WO, permintaan, atau alat..."
          />
        </div>
        <Button
          variant="outline"
          className="lg:hidden"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="wo-filter-panel"
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filter</span>
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{activeFilterCount}</span>
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
            <option value="">Semua</option>
            {executorUnits.data?.map((unit) => (
              <option key={unit.id} value={String(unit.id)}>
                {unit.display_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Kategori" htmlFor="filter-category">
          <Select
            id="filter-category"
            value={filters.service_category_id}
            onChange={(e) => onChange({ service_category_id: e.target.value })}
            disabled={!selectedUnit}
            title={selectedUnit ? undefined : "Pilih unit pelaksana terlebih dahulu"}
          >
            <option value="">{selectedUnit ? "Semua" : "Pilih unit dulu"}</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Dari tanggal" htmlFor="filter-from">
          <Input
            id="filter-from"
            type="date"
            value={filters.issued_from}
            max={filters.issued_to || undefined}
            onChange={(e) => onChange({ issued_from: e.target.value })}
          />
        </Field>

        <Field label="Sampai tanggal" htmlFor="filter-to">
          <Input
            id="filter-to"
            type="date"
            value={filters.issued_to}
            min={filters.issued_from || undefined}
            onChange={(e) => onChange({ issued_to: e.target.value })}
          />
        </Field>

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
    </div>
  );
}
