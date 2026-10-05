import type { ApiEnvelope, Paginated } from "@/types/api";
import type {
  AcceptPayload,
  Attachment,
  AttachmentCollection,
  AssigneesPayload,
  CompletePayload,
  LabourInput,
  MaterialInput,
  ReceivePayload,
  WorkOrderDetail,
  WorkOrderListItem,
  WorkOrderListParams,
  WorkOrderPayload,
} from "@/types/work-order";
import { API_PREFIX, api, buildQuery, unwrap } from "./api";

/* ---------- Reads ---------- */

export function listWorkOrders(
  params: WorkOrderListParams,
  signal?: AbortSignal,
): Promise<Paginated<WorkOrderListItem>> {
  return api.get<Paginated<WorkOrderListItem>>("/work-orders", params, { signal });
}

export function getWorkOrder(id: number, signal?: AbortSignal): Promise<WorkOrderDetail> {
  return unwrap(api.get<ApiEnvelope<WorkOrderDetail>>(`/work-orders/${id}`, undefined, { signal }));
}

/** Same filters & scope as the list, without pagination. Cookie auth, so a plain link works. */
export function workOrderExportUrl(params: WorkOrderListParams): string {
  const filters: WorkOrderListParams = { ...params };
  delete filters.page;
  delete filters.per_page;
  return `${API_PREFIX}/work-orders/export${buildQuery(filters)}`;
}

export function workOrderPdfUrl(id: number): string {
  return `${API_PREFIX}/work-orders/${id}/pdf`;
}

/* ---------- Create / update ---------- */

export function createWorkOrder(payload: WorkOrderPayload): Promise<WorkOrderDetail> {
  return unwrap(api.post<ApiEnvelope<WorkOrderDetail>>("/work-orders", payload));
}

export function updateWorkOrder(id: number, payload: WorkOrderPayload): Promise<WorkOrderDetail> {
  return unwrap(api.put<ApiEnvelope<WorkOrderDetail>>(`/work-orders/${id}`, payload));
}

/* ---------- Transitions (all return the updated detail) ---------- */

export function cancelWorkOrder(id: number, reason: string): Promise<WorkOrderDetail> {
  return unwrap(api.post<ApiEnvelope<WorkOrderDetail>>(`/work-orders/${id}/cancel`, { reason }));
}

export function pickWorkOrder(id: number): Promise<WorkOrderDetail> {
  return unwrap(api.post<ApiEnvelope<WorkOrderDetail>>(`/work-orders/${id}/pick`, {}));
}

export function receiveWorkOrder(id: number, payload: ReceivePayload): Promise<WorkOrderDetail> {
  return unwrap(api.post<ApiEnvelope<WorkOrderDetail>>(`/work-orders/${id}/receive`, payload));
}

export function startWorkOrder(id: number): Promise<WorkOrderDetail> {
  return unwrap(api.post<ApiEnvelope<WorkOrderDetail>>(`/work-orders/${id}/start`, {}));
}

export function completeWorkOrder(id: number, payload: CompletePayload): Promise<WorkOrderDetail> {
  return unwrap(api.post<ApiEnvelope<WorkOrderDetail>>(`/work-orders/${id}/complete`, payload));
}

export function acceptWorkOrder(id: number, payload: AcceptPayload): Promise<WorkOrderDetail> {
  return unwrap(api.post<ApiEnvelope<WorkOrderDetail>>(`/work-orders/${id}/accept`, payload));
}

/* ---------- Non-transition updates ---------- */

/**
 * The contract does not spell out the response of the PUT sub-resources; when the server
 * returns the detail envelope we use it, otherwise callers refetch the detail.
 */
function detailOrNull(res: ApiEnvelope<WorkOrderDetail> | undefined): WorkOrderDetail | null {
  const data = res?.data;
  return data && typeof data === "object" && "permissions" in data ? data : null;
}

export async function updateAssignees(id: number, payload: AssigneesPayload): Promise<WorkOrderDetail | null> {
  return detailOrNull(await api.put<ApiEnvelope<WorkOrderDetail> | undefined>(`/work-orders/${id}/assignees`, payload));
}

export async function updateMaterials(id: number, materials: MaterialInput[]): Promise<WorkOrderDetail | null> {
  return detailOrNull(
    await api.put<ApiEnvelope<WorkOrderDetail> | undefined>(`/work-orders/${id}/materials`, { materials }),
  );
}

export async function updateLabours(id: number, labours: LabourInput[]): Promise<WorkOrderDetail | null> {
  return detailOrNull(
    await api.put<ApiEnvelope<WorkOrderDetail> | undefined>(`/work-orders/${id}/labours`, { labours }),
  );
}

/* ---------- Attachments ---------- */

export async function uploadAttachment(
  workOrderId: number,
  file: File,
  collection: AttachmentCollection,
): Promise<Attachment | undefined> {
  const form = new FormData();
  form.append("file", file);
  form.append("collection", collection);
  const res = await api.post<ApiEnvelope<Attachment> | undefined>(`/work-orders/${workOrderId}/attachments`, form);
  return res?.data;
}

export { deleteAttachment } from "./attachments";

/* ---------- Conversion ---------- */

/** submitted/received WO -> `converted`; creates a draft Form Request (executor lead only). */
export function convertWorkOrderToRequest(id: number, reason: string): Promise<WorkOrderDetail> {
  return unwrap(api.post<ApiEnvelope<WorkOrderDetail>>(`/work-orders/${id}/convert-to-request`, { reason }));
}
