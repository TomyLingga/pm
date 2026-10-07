import { useQuery, type QueryClient } from '@tanstack/react-query';

import { programApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import type { ProgramActivityDetail, WorkProgramDetail } from '@/lib/types';

/** Programme list of one year (`null` = server default: latest year with a programme). */
export function useWorkPrograms(year: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.programList(year),
    queryFn: () => programApi.list(year ? { year } : {}),
    enabled,
  });
}

export function useWorkProgram(id: number) {
  return useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => programApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

/**
 * After a progress / status change of one activity: patch it into the cached programme detail
 * (so the sheet and the list update at once) and refetch the programme + lists for the
 * recomputed averages and counts.
 */
export function applyProgramActivityResult(qc: QueryClient, programId: number, activity: ProgramActivityDetail) {
  qc.setQueryData(queryKeys.programActivity(activity.id), activity);
  qc.setQueryData<WorkProgramDetail | undefined>(queryKeys.program(programId), (prev) => {
    if (!prev) return prev;
    const { logs: _logs, ...plain } = activity;
    return {
      ...prev,
      items: prev.items.map((item) =>
        item.id !== activity.work_program_item_id
          ? item
          : { ...item, activities: item.activities.map((a) => (a.id === activity.id ? { ...a, ...plain } : a)) },
      ),
    };
  });
  void qc.invalidateQueries({ queryKey: queryKeys.program(programId) });
  void qc.invalidateQueries({ queryKey: queryKeys.programs });
}
