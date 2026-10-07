"use client";

import { useQuery } from "@tanstack/react-query";
import { getExecutorStaff, getExecutorUnits, getMySuperior, getOffices } from "@/lib/lookups";
import { queryKeys } from "@/lib/query-keys";
import type { ExecutorUnitPurpose } from "@/types/lookups";

/** Executor units + their service categories (`for=work_order` or `for=request`). */
export function useExecutorUnits(purpose: ExecutorUnitPurpose = "work_order", enabled = true) {
  return useQuery({
    queryKey: queryKeys.executorUnits(purpose),
    queryFn: ({ signal }) => getExecutorUnits(purpose, signal),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

/** Staff of an executor unit (only readable by that unit's staff/leads). */
export function useExecutorStaff(executorUnitId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.executorStaff(executorUnitId ?? 0),
    queryFn: ({ signal }) => getExecutorStaff(executorUnitId as number, signal),
    enabled: enabled && !!executorUnitId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOffices() {
  return useQuery({
    queryKey: queryKeys.offices,
    queryFn: ({ signal }) => getOffices(signal),
    staleTime: 30 * 60 * 1000,
  });
}

/** Default superior from the Portal (`atasan_id`). */
export function useMySuperior(enabled = true) {
  return useQuery({
    queryKey: queryKeys.mySuperior,
    queryFn: ({ signal }) => getMySuperior(signal),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}
