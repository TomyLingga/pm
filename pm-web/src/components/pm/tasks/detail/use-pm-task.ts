"use client";

import { useQuery } from "@tanstack/react-query";
import { useDocumentAction } from "@/hooks/use-document-action";
import { getPmTask } from "@/lib/pm-tasks";
import { queryKeys } from "@/lib/query-keys";
import type { PmTaskDetail } from "@/types/pm";

export function usePmTask(id: number | null) {
  return useQuery({
    queryKey: queryKeys.pmTask(id ?? 0),
    queryFn: ({ signal }) => getPmTask(id as number, signal),
    enabled: id !== null,
  });
}

/** PM task action: updates the cached detail; refreshes lists, the sidebar badge and the calendar. */
export function usePmTaskAction<TVariables = void>(
  taskId: number,
  action: (variables: TVariables) => Promise<PmTaskDetail | null>,
  options: { successMessage: string; onSuccess?: (detail: PmTaskDetail | null) => void },
) {
  return useDocumentAction<PmTaskDetail, TVariables>(action, {
    detailKey: queryKeys.pmTask(taskId),
    invalidate: [queryKeys.pmTaskLists, queryKeys.pmTaskSummary, queryKeys.pmCalendars],
    ...options,
  });
}
