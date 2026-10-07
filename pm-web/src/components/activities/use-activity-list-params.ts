"use client";

import * as React from "react";
import { useUrlListState } from "@/hooks/use-url-list-state";
import {
  ACTIVITY_DEFAULT_STATUSES,
  ACTIVITY_FINAL_STATUSES,
  ACTIVITY_STATUS_OPTIONS,
} from "@/lib/daily-activity-constants";
import { defaultPeriod, effectivePeriod, periodApplies } from "@/lib/list-period";
import type { DailyActivityListParams, DailyActivityScope, DailyActivityStatus } from "@/types/daily-activity";

export const FILTER_KEYS = ["status", "week", "from", "to", "user_id", "q"] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];
export type ActivityFilters = Record<FilterKey, string>;

/** Every scope the URL may carry; the tabs shown come from `meta.available_scopes`. */
export const ALL_ACTIVITY_SCOPES: readonly DailyActivityScope[] = ["mine", "team", "all"];

export const PER_PAGE = 20;

/** URL value of `status` that means "every status" (the API gets no `status` then). */
export const ACTIVITY_STATUS_ALL = "all";

const KNOWN_STATUSES = ACTIVITY_STATUS_OPTIONS.map((option) => option.value);
const DEFAULT_STATUS_PARAM = ACTIVITY_DEFAULT_STATUSES.join(",");

/**
 * URL `status` -> selected statuses (empty = every status).
 * Absent (or nothing valid) = the default `open,on_progress`; `all` = every status.
 */
export function decodeStatusParam(raw: string): DailyActivityStatus[] {
  if (raw === ACTIVITY_STATUS_ALL) return [];
  const wanted = raw.split(",").filter(Boolean);
  const selected = KNOWN_STATUSES.filter((status) => wanted.includes(status));
  return selected.length > 0 ? selected : [...ACTIVITY_DEFAULT_STATUSES];
}

/**
 * Selected statuses -> URL `status`, in a stable order so equal selections produce the same URL.
 * Empty = `all`; the default selection = "" (removed from the URL).
 */
export function encodeStatusParam(values: readonly string[]): string {
  const ordered = KNOWN_STATUSES.filter((status) => values.includes(status));
  if (ordered.length === 0) return ACTIVITY_STATUS_ALL;
  const joined = ordered.join(",");
  return joined === DEFAULT_STATUS_PARAM ? "" : joined;
}

/**
 * Daily-activity list state in the URL + the query sent to `GET /daily-activities`.
 * Default status: open + on progress. The period (`from`/`to`, default: this month) is only sent, and only shown,
 * when the selection contains `closed` or every status; the API applies it to closed reports alone.
 */
export function useActivityListParams() {
  const state = useUrlListState(FILTER_KEYS, ALL_ACTIVITY_SCOPES);
  const { scope, filters, page } = state;
  const fallback = React.useMemo(() => defaultPeriod(), []);

  const selectedStatuses = React.useMemo(() => decodeStatusParam(filters.status), [filters.status]);
  /** Comma list the period helpers understand ("" = every status). */
  const statusParam = selectedStatuses.join(",");
  const isDefaultStatus = statusParam === DEFAULT_STATUS_PARAM;
  const week = /^[1-5]$/.test(filters.week) ? Number(filters.week) : undefined;

  const showPeriod = periodApplies(statusParam, ACTIVITY_FINAL_STATUSES);
  const period = React.useMemo(
    () => effectivePeriod({ status: statusParam, from: filters.from, to: filters.to }, ACTIVITY_FINAL_STATUSES, fallback),
    [fallback, filters.from, filters.to, statusParam],
  );
  const customPeriod = showPeriod && (period.from !== fallback.from || period.to !== fallback.to);

  const apiParams: DailyActivityListParams = React.useMemo(
    () => ({
      scope,
      status: statusParam || undefined,
      week,
      ...period,
      user_id: scope !== "mine" && filters.user_id ? filters.user_id : undefined,
      q: filters.q || undefined,
      page,
      per_page: PER_PAGE,
    }),
    [filters.q, filters.user_id, page, period, scope, statusParam, week],
  );

  const activeFilterCount = [
    week !== undefined,
    scope !== "mine" && !!filters.user_id,
    !isDefaultStatus,
    customPeriod,
  ].filter(Boolean).length;

  return {
    ...state,
    apiParams,
    week,
    selectedStatuses,
    isDefaultStatus,
    showPeriod,
    /** Effective period (URL value or the default); empty when it does not apply. */
    period,
    customPeriod,
    activeFilterCount,
  };
}
