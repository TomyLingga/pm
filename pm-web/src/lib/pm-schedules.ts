import type { ApiEnvelope, Paginated } from "@/types/api";
import type {
  PmScheduleDetail,
  PmScheduleListItem,
  PmScheduleListParams,
  PmSchedulePayload,
  PmSchedulePreview,
  PmSchedulePreviewPayload,
} from "@/types/pm";
import { api, unwrap } from "./api";

const BASE = "/pm-schedules";

export function listPmSchedules(
  params: PmScheduleListParams,
  signal?: AbortSignal,
): Promise<Paginated<PmScheduleListItem>> {
  return api.get<Paginated<PmScheduleListItem>>(BASE, { ...params, page: params.page ?? 1 }, { signal });
}

export function getPmSchedule(id: number, signal?: AbortSignal): Promise<PmScheduleDetail> {
  return unwrap(api.get<ApiEnvelope<PmScheduleDetail>>(`${BASE}/${id}`, undefined, { signal }));
}

/** Tasks are generated right away up to the horizon (60 days; 7 for hourly). */
export function createPmSchedule(payload: PmSchedulePayload): Promise<PmScheduleDetail> {
  return unwrap(api.post<ApiEnvelope<PmScheduleDetail>>(BASE, payload));
}

/** `scheduled` tasks are deleted and regenerated; due/started/finished tasks stay. */
export function updatePmSchedule(id: number, payload: PmSchedulePayload): Promise<PmScheduleDetail> {
  return unwrap(api.put<ApiEnvelope<PmScheduleDetail>>(`${BASE}/${id}`, payload));
}

export function deletePmSchedule(id: number): Promise<void> {
  return api.delete<void>(`${BASE}/${id}`);
}

/** Next occurrences for the form preview (nothing is stored). */
export function previewPmSchedule(payload: PmSchedulePreviewPayload, signal?: AbortSignal): Promise<PmSchedulePreview> {
  return unwrap(api.post<ApiEnvelope<PmSchedulePreview>>(`${BASE}/preview`, payload, { signal }));
}
