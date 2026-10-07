"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_PRESET,
  isDayString,
  isPeriodPreset,
  presetRange,
  rangeDays,
  MAX_PERIOD_DAYS,
  type PeriodPreset,
} from "@/lib/dashboard";
import type { DashboardParams, DashboardScope } from "@/types/dashboard";

const SCOPES: DashboardScope[] = ["mine", "unit", "all"];

export function isDashboardScope(value: string | null | undefined): value is DashboardScope {
  return !!value && (SCOPES as string[]).includes(value);
}

/** Scope, period preset (+ custom dates) and filters live in the URL. */
export function useDashboardParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawScope = searchParams.get("scope");
  /** Undefined = let the server pick the default scope for the role. */
  const scope = isDashboardScope(rawScope) ? rawScope : undefined;
  const rawPreset = searchParams.get("preset");
  const preset: PeriodPreset = isPeriodPreset(rawPreset) ? rawPreset : DEFAULT_PRESET;
  const customFrom = searchParams.get("from") ?? "";
  const customTo = searchParams.get("to") ?? "";
  const executorUnitId = searchParams.get("executor_unit_id") ?? "";
  const locationId = searchParams.get("location_id") ?? "";
  const categoryId = searchParams.get("service_category_id") ?? "";

  const range = React.useMemo(() => presetRange(preset, { from: customFrom, to: customTo }), [customFrom, customTo, preset]);
  const customInvalid =
    preset === "custom" &&
    (!isDayString(customFrom) || !isDayString(customTo) || customFrom > customTo || rangeDays(customFrom, customTo) > MAX_PERIOD_DAYS);

  const apiParams: DashboardParams = React.useMemo(
    () => ({
      scope,
      from: range.from,
      to: range.to,
      executor_unit_id: executorUnitId || undefined,
      location_id: locationId || undefined,
      service_category_id: categoryId || undefined,
    }),
    [categoryId, executorUnitId, locationId, range.from, range.to, scope],
  );

  const update = React.useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const activeFilterCount = [executorUnitId, locationId, categoryId].filter(Boolean).length;

  return {
    scope,
    preset,
    customFrom,
    customTo,
    customInvalid,
    range,
    executorUnitId,
    locationId,
    categoryId,
    apiParams,
    activeFilterCount,
    update,
  };
}
