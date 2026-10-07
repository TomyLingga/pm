"use client";

import { useQuery } from "@tanstack/react-query";
import { listChecklistTemplates } from "@/lib/pm-templates";
import { getPmTaskSummary } from "@/lib/pm-tasks";
import { queryKeys } from "@/lib/query-keys";
import type { ChecklistTemplateListParams } from "@/types/pm";

/** Counters for the "Tugas PM" badge (polled every 60 s). */
export function usePmTaskSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.pmTaskSummary,
    queryFn: ({ signal }) => getPmTaskSummary(signal),
    enabled,
    refetchInterval: 60 * 1000,
  });
}

export function useChecklistTemplates(params: ChecklistTemplateListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.checklistTemplateList(params),
    queryFn: ({ signal }) => listChecklistTemplates(params, signal),
    enabled,
  });
}
