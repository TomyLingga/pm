"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { WORK_PROGRAM_LISTS_KEY, getWorkProgram, getWorkProgramActivity } from "@/lib/work-programs";
import type { WorkProgramActivityDetail, WorkProgramDetail } from "@/types/work-program";

export function useWorkProgram(id: number) {
  return useQuery({
    queryKey: queryKeys.workProgram(id),
    queryFn: ({ signal }) => getWorkProgram(id, signal),
  });
}

/** One activity with its status log (`GET /work-program-activities/{id}`); fetched only while `enabled`. */
export function useWorkProgramActivity(id: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workProgramActivity(id ?? 0),
    queryFn: ({ signal }) => getWorkProgramActivity(id as number, signal),
    enabled: enabled && id !== null,
  });
}

/**
 * Cache helpers shared by every programme mutation: the detail (`queryKeys.workProgram(id)`)
 * and the list are invalidated after each change; when the server answered with the fresh
 * detail it is written to the cache first so the screen updates without a flash.
 * Activity mutations also refresh that activity's own detail (`queryKeys.workProgramActivity(id)`),
 * so a reopened activity dialog shows the new log.
 */
export function useWorkProgramCache(programId: number) {
  const queryClient = useQueryClient();
  return React.useMemo(() => {
    /** Refresh detail + lists (after an activity change, a delete, ...). */
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workProgram(programId) });
      void queryClient.invalidateQueries({ queryKey: WORK_PROGRAM_LISTS_KEY });
    };
    return {
      invalidate,
      /** Write the detail returned by the server, then refresh in the background. */
      applyDetail: (detail: WorkProgramDetail) => {
        queryClient.setQueryData(queryKeys.workProgram(programId), detail);
        invalidate();
      },
      /** After the programme itself is deleted. */
      remove: () => {
        queryClient.removeQueries({ queryKey: queryKeys.workProgram(programId) });
        void queryClient.invalidateQueries({ queryKey: WORK_PROGRAM_LISTS_KEY });
      },
      /** After an activity changed (edit, progress, status) without a detail response to write. */
      invalidateActivity: (activityId: number) => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workProgramActivity(activityId) });
        invalidate();
      },
      /** Write the activity detail returned by PUT / status (it carries the fresh log), then refresh the rest. */
      applyActivity: (activity: WorkProgramActivityDetail) => {
        queryClient.setQueryData(queryKeys.workProgramActivity(activity.id), activity);
        void queryClient.invalidateQueries({ queryKey: queryKeys.workProgramActivity(activity.id) });
        invalidate();
      },
      /** After an activity was deleted: drop its cached detail so a stale dialog cannot show it. */
      removeActivity: (activityId: number) => {
        queryClient.removeQueries({ queryKey: queryKeys.workProgramActivity(activityId) });
        invalidate();
      },
    };
  }, [queryClient, programId]);
}
