import { useQuery, type QueryClient } from '@tanstack/react-query';

import { activityApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import type { DailyActivityDetail, DailyActivityScope } from '@/lib/types';

export function useDailyActivity(id: number) {
  return useQuery({
    queryKey: queryKeys.activity(id),
    queryFn: () => activityApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export interface ActivityMeta {
  availableScopes: DailyActivityScope[];
  canReportForOthers: boolean;
}

/**
 * Scope / permission flags of the daily-activity module (`meta.available_scopes`,
 * `meta.can_report_for_others`). They only come with the list response, so a one-row
 * request is cached for a few minutes and shared by the tab and the form.
 */
export function useActivityMeta(enabled = true) {
  return useQuery({
    queryKey: queryKeys.activityMeta,
    queryFn: async (): Promise<ActivityMeta> => {
      const page = await activityApi.list({ scope: 'mine', per_page: 1 });
      return {
        availableScopes: page.meta?.available_scopes?.length ? page.meta.available_scopes : ['mine'],
        canReportForOthers: !!page.meta?.can_report_for_others,
      };
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * After create / update / status change: cache the returned detail (shown at once) and mark it
 * stale, because the create response is not guaranteed to carry `logs` / `permissions`; then
 * refresh every list.
 */
export function applyActivityResult(qc: QueryClient, detail: DailyActivityDetail | null | undefined, id?: number) {
  const key = detail ? queryKeys.activity(detail.id) : id ? queryKeys.activity(id) : null;
  if (detail) qc.setQueryData(queryKeys.activity(detail.id), detail);
  if (key) void qc.invalidateQueries({ queryKey: key });
  void qc.invalidateQueries({ queryKey: queryKeys.activities });
  // A linked programme activity shows `daily_activities_count`.
  void qc.invalidateQueries({ queryKey: queryKeys.programs });
}
