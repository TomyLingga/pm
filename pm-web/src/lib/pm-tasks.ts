import type { ApiEnvelope, Paginated } from "@/types/api";
import type {
  CalendarEvent,
  CalendarParams,
  PmTaskCompletePayload,
  PmTaskDetail,
  PmTaskItemInput,
  PmTaskListItem,
  PmTaskListParams,
  PmTaskSummary,
  PmTaskWorkOrderPayload,
} from "@/types/pm";
import type { Attachment, MaterialInput } from "@/types/work-order";
import { API_PREFIX, api, buildQuery, unwrap } from "./api";

const BASE = "/pm-tasks";

type Detail = Promise<PmTaskDetail>;

const post = (path: string, body: unknown = {}): Detail => unwrap(api.post<ApiEnvelope<PmTaskDetail>>(path, body));
const put = (path: string, body: unknown): Detail => unwrap(api.put<ApiEnvelope<PmTaskDetail>>(path, body));

/* ---------- Reads ---------- */

export function listPmTasks(params: PmTaskListParams, signal?: AbortSignal): Promise<Paginated<PmTaskListItem>> {
  return api.get<Paginated<PmTaskListItem>>(BASE, params, { signal });
}

export function getPmTask(id: number, signal?: AbortSignal): Detail {
  return unwrap(api.get<ApiEnvelope<PmTaskDetail>>(`${BASE}/${id}`, undefined, { signal }));
}

/** Counters for the sidebar badge. */
export function getPmTaskSummary(signal?: AbortSignal): Promise<PmTaskSummary> {
  return unwrap(api.get<ApiEnvelope<PmTaskSummary>>(`${BASE}/summary`, undefined, { signal }));
}

/** Tasks + projections for a date range (max 62 days). */
export function getPmCalendar(params: CalendarParams, signal?: AbortSignal): Promise<CalendarEvent[]> {
  return unwrap(api.get<ApiEnvelope<CalendarEvent[]>>(`${BASE}/calendar`, params, { signal }));
}

/** Same filters as the list, without pagination (cookie auth: a plain link works). */
export function pmTaskExportUrl(params: PmTaskListParams): string {
  const filters: PmTaskListParams = { ...params };
  delete filters.page;
  delete filters.per_page;
  return `${API_PREFIX}${BASE}/export${buildQuery(filters)}`;
}

/* ---------- Actions (all return the updated detail) ---------- */

/** due/overdue -> in_progress; checklist items are copied from the template. */
export function startPmTask(id: number): Detail {
  return post(`${BASE}/${id}/start`);
}

/** Partial save (auto-save) of checklist answers; only while in_progress. */
export function savePmTaskItems(id: number, items: PmTaskItemInput[]): Detail {
  return put(`${BASE}/${id}/items`, { items });
}

/** Replaces the whole material list. */
export function savePmTaskMaterials(id: number, materials: MaterialInput[]): Detail {
  return put(`${BASE}/${id}/materials`, { materials });
}

export function completePmTask(id: number, payload: PmTaskCompletePayload): Detail {
  return post(`${BASE}/${id}/complete`, payload);
}

export function proposeSkipPmTask(id: number, reason: string): Detail {
  return post(`${BASE}/${id}/propose-skip`, { reason });
}

export function skipPmTask(id: number, reason: string): Detail {
  return post(`${BASE}/${id}/skip`, { reason });
}

export function reassignPmTask(id: number, picUserId: number): Detail {
  return post(`${BASE}/${id}/reassign`, { pic_user_id: picUserId });
}

/** Creates a work order from a `not_ok` item (once per item, 409 afterwards). */
export function createWorkOrderFromItem(id: number, itemId: number, payload: PmTaskWorkOrderPayload): Detail {
  return post(`${BASE}/${id}/items/${itemId}/work-order`, payload);
}

/* ---------- Attachments ---------- */

/** Uploads a task photo; with `itemId` it is attached to that checklist item. */
export async function uploadPmTaskAttachment(
  id: number,
  file: File,
  itemId?: number | null,
): Promise<Attachment | undefined> {
  const form = new FormData();
  form.append("file", file);
  if (itemId) form.append("item_id", String(itemId));
  const res = await api.post<ApiEnvelope<Attachment> | undefined>(`${BASE}/${id}/attachments`, form);
  return res?.data;
}
