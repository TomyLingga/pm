import type { ApiEnvelope } from "@/types/api";
import type {
  DailyActivity,
  DailyActivityDetail,
  DailyActivityListParams,
  DailyActivityListResponse,
  DailyActivityPayload,
  DailyActivityPerson,
  DailyActivityStatusPayload,
  DailyActivityUpdatePayload,
} from "@/types/daily-activity";
import { API_PREFIX, api, buildQuery, unwrap } from "./api";

/** Prefix of every daily-activity query (list, detail, people); see `queryKeys.dailyActivities`. */
export const DAILY_ACTIVITY_KEY_PREFIX = ["daily-activities"] as const;
/** Prefix of the list queries only. */
export const DAILY_ACTIVITY_LIST_PREFIX = ["daily-activities", "list"] as const;

/* ---------- Reads ---------- */

export function listDailyActivities(
  params: DailyActivityListParams,
  signal?: AbortSignal,
): Promise<DailyActivityListResponse> {
  return api.get<DailyActivityListResponse>("/daily-activities", params, { signal });
}

export function getDailyActivity(id: number, signal?: AbortSignal): Promise<DailyActivityDetail> {
  return unwrap(api.get<ApiEnvelope<DailyActivityDetail>>(`/daily-activities/${id}`, undefined, { signal }));
}

/**
 * People whose reports the user may see or fill in (leads: subtree; admin: everyone; staff: self).
 * The contract writes the response as a plain array; a `{ data }` envelope is accepted too.
 */
export async function listDailyActivityPeople(q = "", signal?: AbortSignal): Promise<DailyActivityPerson[]> {
  const res = await api.get<DailyActivityPerson[] | ApiEnvelope<DailyActivityPerson[]>>(
    "/daily-activities/people",
    { q: q || undefined },
    { signal },
  );
  return Array.isArray(res) ? res : (res?.data ?? []);
}

/** Same filters & scope as the list, without pagination. Cookie auth, so a plain link works. */
export function dailyActivityExportUrl(params: DailyActivityListParams): string {
  const filters: DailyActivityListParams = { ...params };
  delete filters.page;
  delete filters.per_page;
  return `${API_PREFIX}/daily-activities/export${buildQuery(filters)}`;
}

/** Excel template of the import (sheets Data, Contoh, Petunjuk, Referensi PIC). Cookie auth, plain link. */
export function dailyActivityImportTemplateUrl(): string {
  return `${API_PREFIX}/daily-activities/import-template`;
}

/** Where `ImportDialog` posts the filled template (multipart `file`). */
export const DAILY_ACTIVITY_IMPORT_PATH = "/daily-activities/import";

/* ---------- Writes ---------- */

export function createDailyActivity(payload: DailyActivityPayload): Promise<DailyActivity> {
  return unwrap(api.post<ApiEnvelope<DailyActivity>>("/daily-activities", payload));
}

export function updateDailyActivity(id: number, payload: DailyActivityUpdatePayload): Promise<DailyActivityDetail> {
  return unwrap(api.put<ApiEnvelope<DailyActivityDetail>>(`/daily-activities/${id}`, payload));
}

/** 422 when the status is unchanged. */
export function setDailyActivityStatus(id: number, payload: DailyActivityStatusPayload): Promise<DailyActivityDetail> {
  return unwrap(api.post<ApiEnvelope<DailyActivityDetail>>(`/daily-activities/${id}/status`, payload));
}

export function deleteDailyActivity(id: number): Promise<void> {
  return api.delete<void>(`/daily-activities/${id}`);
}
