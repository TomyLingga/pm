"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExecutorUnits } from "@/hooks/use-lookups";
import { MAX_PERIOD_DAYS, PERIOD_PRESETS, type PeriodPreset } from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardScope } from "@/types/dashboard";
import { LocationFilter } from "./location-filter";
import type { useDashboardParams } from "./use-dashboard-params";

const SCOPE_LABELS: Record<DashboardScope, string> = {
  mine: "Saya",
  unit: "Unit Saya",
  all: "Semua",
};

const PRESET_OPTIONS = PERIOD_PRESETS.map((option) => ({ value: option.value, label: option.label }));

interface DashboardFiltersProps {
  params: ReturnType<typeof useDashboardParams>;
  /** From the last response (drives the scope switch). */
  availableScopes: DashboardScope[];
  activeScope: DashboardScope | undefined;
}

export function DashboardFilters({ params, availableScopes, activeScope }: DashboardFiltersProps) {
  const me = useCurrentUser();
  const [expanded, setExpanded] = React.useState(false);
  const { preset, customFrom, customTo, customInvalid, range, executorUnitId, locationId, categoryId, update } = params;

  const scope = activeScope ?? params.scope;
  const showUnitFilters = scope === "unit" || scope === "all";
  const allUnits = useExecutorUnits("work_order", showUnitFilters);
  // "all": every unit; "unit": only the units the user belongs to.
  const units = scope === "all" ? allUnits.data ?? [] : me.executor_units;
  const selectedUnit = allUnits.data?.find((unit) => String(unit.id) === executorUnitId);
  const categories = selectedUnit?.categories ?? [];

  const setPreset = (next: PeriodPreset) => {
    if (next === "custom") {
      update({ preset: "custom", from: customFrom || range.from, to: customTo || range.to });
    } else {
      update({ preset: next === "30d" ? "" : next, from: "", to: "" });
    }
  };

  return (
    <div className="panel space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {availableScopes.length > 1 ? (
          <Tabs value={scope ?? availableScopes[0]} onValueChange={(value) => update({ scope: value })}>
            <TabsList aria-label="Lingkup dashboard" className="h-9">
              {availableScopes.map((item) => (
                <TabsTrigger key={item} value={item} className="h-7">
                  {SCOPE_LABELS[item]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <span className="text-sm text-muted-foreground">
            Lingkup: <span className="font-medium text-foreground">{SCOPE_LABELS[scope ?? "mine"]}</span>
          </span>
        )}

        <div className="-mx-1 max-w-full overflow-x-auto px-1 py-0.5">
          <Segmented<PeriodPreset>
            name="dash-preset"
            aria-label="Periode"
            value={preset}
            options={PRESET_OPTIONS}
            onChange={setPreset}
            className="[&_label]:min-w-0 [&_label]:px-2.5 [&_label]:text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        {preset === "custom" ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Dari" htmlFor="dash-from">
              <Input
                id="dash-from"
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(event) => update({ from: event.target.value })}
                className="h-9 w-40"
                invalid={customInvalid}
              />
            </Field>
            <Field label="Sampai" htmlFor="dash-to">
              <Input
                id="dash-to"
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(event) => update({ to: event.target.value })}
                className="h-9 w-40"
                invalid={customInvalid}
              />
            </Field>
            {customInvalid ? (
              <FieldError
                className="basis-full sm:basis-auto sm:pb-2.5"
                message={`Isi kedua tanggal (maks. ${MAX_PERIOD_DAYS} hari). Sementara dipakai 30 hari terakhir.`}
              />
            ) : null}
          </div>
        ) : (
          <p className="tabular text-sm text-muted-foreground">
            Periode {formatDate(range.from)} &ndash; {formatDate(range.to)}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="dash-filter-panel"
        >
          <SlidersHorizontal />
          Filter
          {params.activeFilterCount > 0 ? (
            <span className="tabular rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {params.activeFilterCount}
            </span>
          ) : null}
        </Button>
      </div>

      <div
        id="dash-filter-panel"
        className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3", expanded ? "grid" : "hidden lg:grid")}
      >
        {showUnitFilters ? (
          <>
            <Field label="Unit pelaksana" htmlFor="dash-unit">
              <Select
                id="dash-unit"
                value={executorUnitId}
                onChange={(event) => update({ executor_unit_id: event.target.value, service_category_id: "" })}
                disabled={allUnits.isPending}
                className="h-9"
              >
                <option value="">Semua unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={String(unit.id)}>
                    {unit.display_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kategori WO" htmlFor="dash-category">
              <Select
                id="dash-category"
                value={categoryId}
                onChange={(event) => update({ service_category_id: event.target.value })}
                disabled={!selectedUnit}
                title={selectedUnit ? undefined : "Pilih unit pelaksana terlebih dahulu"}
                className="h-9"
              >
                <option value="">{selectedUnit ? "Semua kategori" : "Pilih unit dulu"}</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}
        <Field label="Lokasi" htmlFor="dash-location">
          <LocationFilter id="dash-location" value={locationId} onChange={(value) => update({ location_id: value })} />
        </Field>
      </div>
    </div>
  );
}
