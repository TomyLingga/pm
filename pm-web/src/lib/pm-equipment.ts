import type { ApiEnvelope, Paginated } from "@/types/api";
import type { LocationOption } from "@/types/lookups";
import type {
  EquipmentDetail,
  EquipmentItem,
  EquipmentListParams,
  EquipmentPayload,
  HistoryEntry,
} from "@/types/pm";
import { API_PREFIX, api, unwrap } from "./api";

const BASE = "/equipment";

/** Paginated master list (sending `page` switches the endpoint from lookup to pagination). */
export function listEquipment(params: EquipmentListParams, signal?: AbortSignal): Promise<Paginated<EquipmentItem>> {
  return api.get<Paginated<EquipmentItem>>(
    BASE,
    { ...params, page: params.page ?? 1, per_page: params.per_page ?? 20 },
    { signal },
  );
}

/** Lookup mode (no `page`): max 50 items. */
export function searchEquipmentItems(
  q: string,
  executorUnitId: number | null,
  signal?: AbortSignal,
): Promise<EquipmentItem[]> {
  return unwrap(api.get<ApiEnvelope<EquipmentItem[]>>(BASE, { q, executor_unit_id: executorUnitId }, { signal }));
}

export function getEquipment(id: number, signal?: AbortSignal): Promise<EquipmentDetail> {
  return unwrap(api.get<ApiEnvelope<EquipmentDetail>>(`${BASE}/${id}`, undefined, { signal }));
}

export function createEquipment(payload: EquipmentPayload): Promise<EquipmentDetail> {
  return unwrap(api.post<ApiEnvelope<EquipmentDetail>>(BASE, payload));
}

export function updateEquipment(id: number, payload: EquipmentPayload): Promise<EquipmentDetail> {
  return unwrap(api.put<ApiEnvelope<EquipmentDetail>>(`${BASE}/${id}`, payload));
}

/** 409 while the equipment is still used by an active PM schedule. */
export function deleteEquipment(id: number): Promise<void> {
  return api.delete<void>(`${BASE}/${id}`);
}

/** Absolute URL of the xlsx import template (sheets Data, Contoh, Petunjuk, Lokasi, Unit Pelaksana). */
export function equipmentImportTemplateUrl(): string {
  return `${API_PREFIX}${BASE}/import-template`;
}

/** Maintenance history (PM tasks + work orders), newest first. */
export function getEquipmentHistory(id: number, page: number, signal?: AbortSignal): Promise<Paginated<HistoryEntry>> {
  return api.get<Paginated<HistoryEntry>>(`${BASE}/${id}/history`, { page }, { signal });
}

/** Leads / admins can add a location on the fly. */
export function createLocation(payload: { code: string; name: string }): Promise<LocationOption> {
  return unwrap(api.post<ApiEnvelope<LocationOption>>("/locations", payload));
}
