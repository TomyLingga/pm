import type { ApiEnvelope } from "@/types/api";
import type { OrgUnit } from "@/types/auth";
import type {
  WorkProgramActivity,
  WorkProgramActivityDetail,
  WorkProgramActivityPayload,
  WorkProgramActivityStatusPayload,
  WorkProgramCreatePayload,
  WorkProgramDetail,
  WorkProgramItemPayload,
  WorkProgramListParams,
  WorkProgramListResponse,
  WorkProgramPerson,
  WorkProgramUpdatePayload,
} from "@/types/work-program";
import { API_PREFIX, api, unwrap } from "./api";

const BASE = "/work-programs";
const ITEMS = "/work-program-items";
const ACTIVITIES = "/work-program-activities";

/** Prefix of every programme list query (`queryKeys.workPrograms(params)`), for invalidation. */
export const WORK_PROGRAM_LISTS_KEY = ["work-programs", "list"] as const;

/* ---------- Reads ---------- */

/** Programmes of one year (default: latest year with a programme) plus the filter options. */
export function listWorkPrograms(params: WorkProgramListParams, signal?: AbortSignal): Promise<WorkProgramListResponse> {
  return api.get<WorkProgramListResponse>(BASE, params, { signal });
}

/** Org units the user may create a programme for (leads: subtree; admin: all; staff: none). */
export function getWorkProgramUnits(signal?: AbortSignal): Promise<OrgUnit[]> {
  return unwrap(api.get<ApiEnvelope<OrgUnit[]>>(`${BASE}/units`, undefined, { signal }));
}

/** PIC candidates in my branch of the org tree (max 30). */
export function searchWorkProgramPeople(q: string, signal?: AbortSignal): Promise<WorkProgramPerson[]> {
  return unwrap(api.get<ApiEnvelope<WorkProgramPerson[]>>(`${BASE}/people`, { q }, { signal }));
}

export function getWorkProgram(id: number, signal?: AbortSignal): Promise<WorkProgramDetail> {
  return unwrap(api.get<ApiEnvelope<WorkProgramDetail>>(`${BASE}/${id}`, undefined, { signal }));
}

/** Excel of every activity of the programme. Cookie auth, so a plain link works. */
export function workProgramExportUrl(id: number): string {
  return `${API_PREFIX}${BASE}/${id}/export`;
}

/* ---------- Programme ---------- */

export function createWorkProgram(payload: WorkProgramCreatePayload): Promise<WorkProgramDetail> {
  return unwrap(api.post<ApiEnvelope<WorkProgramDetail>>(BASE, payload));
}

/** Also closes / reopens the programme via `status`. */
export function updateWorkProgram(id: number, payload: WorkProgramUpdatePayload): Promise<WorkProgramDetail> {
  return unwrap(api.put<ApiEnvelope<WorkProgramDetail>>(`${BASE}/${id}`, payload));
}

export function deleteWorkProgram(id: number): Promise<void> {
  return api.delete<void>(`${BASE}/${id}`);
}

/* ---------- Sub-items (every call answers with the programme detail) ---------- */

export function addWorkProgramItem(programId: number, payload: WorkProgramItemPayload): Promise<WorkProgramDetail> {
  return unwrap(api.post<ApiEnvelope<WorkProgramDetail>>(`${BASE}/${programId}/items`, payload));
}

export function updateWorkProgramItem(itemId: number, payload: Partial<WorkProgramItemPayload>): Promise<WorkProgramDetail> {
  return unwrap(api.put<ApiEnvelope<WorkProgramDetail>>(`${ITEMS}/${itemId}`, payload));
}

export function deleteWorkProgramItem(itemId: number): Promise<WorkProgramDetail> {
  return unwrap(api.delete<ApiEnvelope<WorkProgramDetail>>(`${ITEMS}/${itemId}`));
}

/* ---------- Activities ---------- */

export function addWorkProgramActivity(itemId: number, payload: WorkProgramActivityPayload): Promise<WorkProgramActivity> {
  return unwrap(api.post<ApiEnvelope<WorkProgramActivity>>(`${ITEMS}/${itemId}/activities`, payload));
}

export function getWorkProgramActivity(id: number, signal?: AbortSignal): Promise<WorkProgramActivityDetail> {
  return unwrap(api.get<ApiEnvelope<WorkProgramActivityDetail>>(`${ACTIVITIES}/${id}`, undefined, { signal }));
}

/** Managers may send every field (+ `pics`); a PIC only `remarks` and `progress_pct`. */
export function updateWorkProgramActivity(
  id: number,
  payload: WorkProgramActivityPayload,
): Promise<WorkProgramActivityDetail> {
  return unwrap(api.put<ApiEnvelope<WorkProgramActivityDetail>>(`${ACTIVITIES}/${id}`, payload));
}

/** `closed` sets progress 100 + closed_date, `open` resets progress, `cancelled` fills closed_date. */
export function setWorkProgramActivityStatus(
  id: number,
  payload: WorkProgramActivityStatusPayload,
): Promise<WorkProgramActivityDetail> {
  return unwrap(api.post<ApiEnvelope<WorkProgramActivityDetail>>(`${ACTIVITIES}/${id}/status`, payload));
}

export function deleteWorkProgramActivity(id: number): Promise<void> {
  return api.delete<void>(`${ACTIVITIES}/${id}`);
}
