"use client";

import * as React from "react";
import { useUrlListState } from "@/hooks/use-url-list-state";
import { PM_FINAL_STATUSES, defaultPeriod, effectivePeriod } from "@/lib/list-period";
import type { PmTaskListParams, PmTaskScope } from "@/types/pm";

export const TASK_FILTER_KEYS = [
  "status",
  "executor_unit_id",
  "from",
  "to",
  // Set by links from a schedule / equipment page; shown as removable chips.
  "schedule_id",
  "equipment_id",
  "sort",
  "q",
] as const;

export type TaskFilterKey = (typeof TASK_FILTER_KEYS)[number];
export type TaskFilters = Record<TaskFilterKey, string>;

/** Keys that count as "active filters" (search and sort are not filters). */
const COUNTED_KEYS: TaskFilterKey[] = ["status", "executor_unit_id", "from", "to", "schedule_id", "equipment_id"];

/** PM task list state in the URL + the query for `GET /pm-tasks`. */
export function useTaskListParams(allowedScopes: PmTaskScope[]) {
  const state = useUrlListState(TASK_FILTER_KEYS, allowedScopes);
  const { scope, filters, page } = state;
  const fallback = React.useMemo(() => defaultPeriod(), []);

  const apiParams: PmTaskListParams = React.useMemo(
    () => ({
      scope,
      status: filters.status || undefined,
      executor_unit_id: filters.executor_unit_id || undefined,
      schedule_id: filters.schedule_id || undefined,
      equipment_id: filters.equipment_id || undefined,
      // Default period: this month. It only narrows finished documents; running ones are always listed.
      ...effectivePeriod(filters, PM_FINAL_STATUSES, fallback),
      q: filters.q || undefined,
      sort: filters.sort === "-due_at" ? "-due_at" : undefined,
      page,
      per_page: 20,
    }),
    [fallback, filters, page, scope],
  );

  const activeFilterCount = COUNTED_KEYS.filter((key) => filters[key]).length;

  return { ...state, activeFilterCount, apiParams };
}
