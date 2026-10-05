"use client";

import * as React from "react";
import { useUrlListState } from "@/hooks/use-url-list-state";
import type { WorkOrderListParams, WorkOrderScope } from "@/types/work-order";

export const FILTER_KEYS = [
  "status",
  "priority",
  "executor_unit_id",
  "service_category_id",
  "issued_from",
  "issued_to",
  "q",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];
export type ListFilters = Record<FilterKey, string>;

/** WO list state in the URL + the query sent to `GET /work-orders`. */
export function useWorkOrderListParams(allowedScopes: WorkOrderScope[]) {
  const state = useUrlListState(FILTER_KEYS, allowedScopes);
  const { scope, filters, page } = state;

  const apiParams: WorkOrderListParams = React.useMemo(
    () => ({
      scope,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      executor_unit_id: filters.executor_unit_id || undefined,
      service_category_id: filters.service_category_id || undefined,
      issued_from: filters.issued_from || undefined,
      issued_to: filters.issued_to || undefined,
      q: filters.q || undefined,
      page,
      per_page: 20,
    }),
    [filters, page, scope],
  );

  return { ...state, apiParams };
}
