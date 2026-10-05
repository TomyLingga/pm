import type { ApiEnvelope, Paginated } from "@/types/api";
import type {
  ApprovePayload,
  ServiceRequestDetail,
  ServiceRequestListItem,
  ServiceRequestListParams,
  ServiceRequestPayload,
} from "@/types/service-request";
import type { Attachment, AttachmentCollection } from "@/types/work-order";
import { API_PREFIX, api, buildQuery, unwrap } from "./api";

const BASE = "/service-requests";

type DetailResponse = Promise<ServiceRequestDetail>;

const post = (path: string, body: unknown = {}): DetailResponse =>
  unwrap(api.post<ApiEnvelope<ServiceRequestDetail>>(path, body));

/* ---------- Reads ---------- */

export function listServiceRequests(
  params: ServiceRequestListParams,
  signal?: AbortSignal,
): Promise<Paginated<ServiceRequestListItem>> {
  return api.get<Paginated<ServiceRequestListItem>>(BASE, params, { signal });
}

export function getServiceRequest(id: number, signal?: AbortSignal): DetailResponse {
  return unwrap(api.get<ApiEnvelope<ServiceRequestDetail>>(`${BASE}/${id}`, undefined, { signal }));
}

/** Same filters & scope as the list, without pagination (cookie auth: a plain link works). */
export function serviceRequestExportUrl(params: ServiceRequestListParams): string {
  const filters: ServiceRequestListParams = { ...params };
  delete filters.page;
  delete filters.per_page;
  return `${API_PREFIX}${BASE}/export${buildQuery(filters)}`;
}

export function serviceRequestPdfUrl(id: number): string {
  return `${API_PREFIX}${BASE}/${id}/pdf`;
}

/* ---------- Draft CRUD ---------- */

export function createServiceRequest(payload: ServiceRequestPayload): DetailResponse {
  return post(BASE, payload);
}

export function updateServiceRequest(id: number, payload: ServiceRequestPayload): DetailResponse {
  return unwrap(api.put<ApiEnvelope<ServiceRequestDetail>>(`${BASE}/${id}`, payload));
}

/** Only drafts that were never submitted (`request_number` null). */
export function deleteServiceRequest(id: number): Promise<void> {
  return api.delete<void>(`${BASE}/${id}`);
}

/* ---------- Actions (all return the updated detail) ---------- */

export function submitServiceRequest(id: number, superiorId?: number | null): DetailResponse {
  return post(`${BASE}/${id}/submit`, superiorId ? { superior_id: superiorId } : {});
}

export function changeSuperior(id: number, superiorId: number, reason?: string | null): DetailResponse {
  return post(`${BASE}/${id}/change-superior`, { superior_id: superiorId, reason: reason || null });
}

export function approveServiceRequest(id: number, payload: ApprovePayload): DetailResponse {
  return post(`${BASE}/${id}/approve`, payload);
}

export function rejectServiceRequest(id: number, notes: string): DetailResponse {
  return post(`${BASE}/${id}/reject`, { notes });
}

export function requestRevision(id: number, notes: string): DetailResponse {
  return post(`${BASE}/${id}/request-revision`, { notes });
}

export function completeServiceRequest(id: number, executorNotes: string): DetailResponse {
  return post(`${BASE}/${id}/complete`, { executor_notes: executorNotes });
}

export function cancelServiceRequest(id: number, reason: string): DetailResponse {
  return post(`${BASE}/${id}/cancel`, { reason });
}

export function convertServiceRequestToWorkOrder(id: number, reason: string): DetailResponse {
  return post(`${BASE}/${id}/convert-to-work-order`, { reason });
}

/* ---------- Attachments ---------- */

export async function uploadServiceRequestAttachment(
  id: number,
  file: File,
  collection: AttachmentCollection,
): Promise<Attachment | undefined> {
  const form = new FormData();
  form.append("file", file);
  form.append("collection", collection);
  const res = await api.post<ApiEnvelope<Attachment> | undefined>(`${BASE}/${id}/attachments`, form);
  return res?.data;
}

/** Form Request attachments: PDFs are `document`, images `photo_before`. */
export function serviceRequestCollectionFor(file: File): AttachmentCollection {
  return file.type.startsWith("image/") ? "photo_before" : "document";
}
