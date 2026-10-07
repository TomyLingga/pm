"use client";

import { useCurrentUser } from "@/components/layout/current-user";
import { useExecutorUnits } from "@/hooks/use-lookups";
import { isAdmin, isExecutorStaff, leadUnits } from "@/lib/auth";
import type { Me } from "@/types/auth";
import type { PmTaskScope, UnitRef } from "@/types/pm";

/**
 * Executor units the user can *see* PM data for: every unit for admin,
 * otherwise the units he belongs to.
 */
export function usePmUnits(): { units: UnitRef[]; isPending: boolean } {
  const me = useCurrentUser();
  const seesAll = isAdmin(me);
  const all = useExecutorUnits("work_order");
  return seesAll
    ? { units: all.data ?? [], isPending: all.isPending }
    : { units: me.executor_units, isPending: false };
}

/**
 * Executor units the user may *write* templates / schedules / equipment for:
 * every unit for admin, otherwise the units he leads.
 */
export function useManageableUnits(): { units: UnitRef[]; isPending: boolean } {
  const me = useCurrentUser();
  const admin = isAdmin(me);
  const all = useExecutorUnits("work_order");
  return admin ? { units: all.data ?? [], isPending: all.isPending } : { units: leadUnits(me), isPending: false };
}

/** Widest task scope the user has ("all" for admin, "unit" for staff). */
export function widestTaskScope(me: Me): PmTaskScope {
  if (isAdmin(me)) return "all";
  return isExecutorStaff(me) ? "unit" : "mine";
}

/** Link to the task list pre-filtered by schedule / equipment / status. */
export function pmTasksHref(
  me: Me,
  filters: { schedule_id?: number; equipment_id?: number; status?: string } = {},
): string {
  const params = new URLSearchParams({ scope: widestTaskScope(me) });
  if (filters.status) params.set("status", filters.status);
  if (filters.schedule_id) params.set("schedule_id", String(filters.schedule_id));
  if (filters.equipment_id) params.set("equipment_id", String(filters.equipment_id));
  return `/pm/tasks?${params.toString()}`;
}
