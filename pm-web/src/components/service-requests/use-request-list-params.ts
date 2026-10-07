"use client";

import * as React from "react";
import { useUrlListState } from "@/hooks/use-url-list-state";
import { REQUEST_FINAL_STATUSES, defaultPeriod, effectivePeriod } from "@/lib/list-period";
import type { ServiceRequestListParams, ServiceRequestScope } from "@/types/service-request";

export const REQUEST_FILTER_KEYS = [
  "status",
  "priority",
  "executor_unit_id",
  "service_category_id",
  "office_id",
  "from",
  "to",
  "q",
] as const;

export type RequestFilterKey = (typeof REQUEST_FILTER_KEYS)[number];
export type RequestFilters = Record<RequestFilterKey, string>;

/** Form Request list state in the URL + the query for `GET /service-requests`. */
export function useRequestListParams(allowedScopes: ServiceRequestScope[]) {
  const state = useUrlListState(REQUEST_FILTER_KEYS, allowedScopes);
  const { scope, filters, page } = state;
  const fallback = React.useMemo(() => defaultPeriod(), []);

  const apiParams: ServiceRequestListParams = React.useMemo(
    () => ({
      scope,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      executor_unit_id: filters.executor_unit_id || undefined,
      service_category_id: filters.service_category_id || undefined,
      office_id: filters.office_id || undefined,
      // Default period: this month. It only narrows finished documents; running ones are always listed.
      ...effectivePeriod(filters, REQUEST_FINAL_STATUSES, fallback),
      q: filters.q || undefined,
      page,
      per_page: 20,
    }),
    [fallback, filters, page, scope],
  );

  return { ...state, apiParams };
}
