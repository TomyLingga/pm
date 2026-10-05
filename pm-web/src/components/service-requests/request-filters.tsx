"use client";

import * as React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { SearchBox } from "@/components/common/search-box";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useExecutorUnits, useOffices } from "@/hooks/use-lookups";
import { SR_PRIORITY_OPTIONS, SR_STATUS_OPTIONS } from "@/lib/constants";
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

  const selectedUnit = executorUnits.data?.find((unit) => String(unit.id) === filters.executor_unit_id);
  const categories = selectedUnit?.categories ?? [];

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchBox
            value={filters.q}
            onCommit={(q) => onChange({ q })}
            placeholder="Cari nomor request atau keperluan..."
          />
        </div>
        <Button
          variant="outline"
          className="xl:hidden"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="sr-filter-panel"
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filter</span>
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{activeFilterCount}</span>
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
            <option value="">Semua</option>
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
            <option value="">Semua</option>
            {offices.data?.map((office) => (
              <option key={office.id} value={String(office.id)}>
                {office.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Dari tanggal" htmlFor="sr-filter-from">
          <Input
            id="sr-filter-from"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => onChange({ from: e.target.value })}
          />
        </Field>

        <Field label="Sampai tanggal" htmlFor="sr-filter-to">
          <Input
            id="sr-filter-to"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => onChange({ to: e.target.value })}
          />
        </Field>

        <div className="flex items-end">
          <Button variant="ghost" className="w-full" onClick={onReset} disabled={activeFilterCount === 0 && !filters.q}>
            <RotateCcw />
            Reset filter
          </Button>
        </div>
      </div>
    </div>
  );
}
