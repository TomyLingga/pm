import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { pmTaskApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import type { PmTaskDetail } from '@/lib/types';

export function usePmTask(id: number) {
  return useQuery({
    queryKey: queryKeys.pmTask(id),
    queryFn: () => pmTaskApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** Badge counts (`mine` / `unit`), refreshed every 60 s and after each action. */
export function usePmSummary(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.pmSummary,
    queryFn: pmTaskApi.summary,
    enabled,
    refetchInterval: 60_000,
  });
}

function isPmTaskDetail(value: unknown): value is PmTaskDetail {
  return !!value && typeof value === 'object' && 'id' in value && 'permissions' in value && 'number' in value;
}

/**
 * After a PM task action: replace the cached detail with the returned one (or refetch) and
 * invalidate the task lists and the badge summary.
 */
export function applyPmTaskResult(qc: QueryClient, id: number, result: unknown): PmTaskDetail | null {
  const detail = isPmTaskDetail(result) ? result : null;
  if (detail) qc.setQueryData(queryKeys.pmTask(id), detail);
  else void qc.invalidateQueries({ queryKey: queryKeys.pmTask(id) });
  void qc.invalidateQueries({ queryKey: queryKeys.pmTasks });
  void qc.invalidateQueries({ queryKey: queryKeys.pmSummary });
  return detail;
}

export function usePmTaskAction<TVars = void>(id: number, fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      applyPmTaskResult(qc, id, result);
    },
  });
}
