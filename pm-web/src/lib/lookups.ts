import type { ApiEnvelope } from "@/types/api";
import type { SuperiorUser } from "@/types/service-request";
import type {
  EquipmentOption,
  ExecutorStaff,
  ExecutorUnitOption,
  ExecutorUnitPurpose,
  LocationOption,
  MaterialOption,
  OfficeOption,
  SuperiorCandidate,
} from "@/types/lookups";
import { api, unwrap } from "./api";

export function getExecutorUnits(
  purpose: ExecutorUnitPurpose = "work_order",
  signal?: AbortSignal,
): Promise<ExecutorUnitOption[]> {
  return unwrap(api.get<ApiEnvelope<ExecutorUnitOption[]>>("/executor-units", { for: purpose }, { signal }));
}

export function getExecutorStaff(executorUnitId: number, signal?: AbortSignal): Promise<ExecutorStaff[]> {
  return unwrap(api.get<ApiEnvelope<ExecutorStaff[]>>(`/executor-units/${executorUnitId}/staff`, undefined, { signal }));
}

export function searchLocations(q: string, signal?: AbortSignal): Promise<LocationOption[]> {
  return unwrap(api.get<ApiEnvelope<LocationOption[]>>("/locations", { q }, { signal }));
}

export function searchEquipment(
  q: string,
  executorUnitId: number | null,
  signal?: AbortSignal,
): Promise<EquipmentOption[]> {
  return unwrap(
    api.get<ApiEnvelope<EquipmentOption[]>>("/equipment", { q, executor_unit_id: executorUnitId }, { signal }),
  );
}

export function searchMaterials(q: string, signal?: AbortSignal): Promise<MaterialOption[]> {
  return unwrap(api.get<ApiEnvelope<MaterialOption[]>>("/materials", { q }, { signal }));
}

export function getOffices(signal?: AbortSignal): Promise<OfficeOption[]> {
  return unwrap(api.get<ApiEnvelope<OfficeOption[]>>("/offices", undefined, { signal }));
}

/** Active users with a higher grade than the current user (max 30). */
export function searchSuperiorCandidates(q: string, signal?: AbortSignal): Promise<SuperiorCandidate[]> {
  return unwrap(api.get<ApiEnvelope<SuperiorCandidate[]>>("/users/superior-candidates", { q }, { signal }));
}

/** Default superior from the Portal `atasan_id` (null when none). */
export async function getMySuperior(signal?: AbortSignal): Promise<SuperiorUser | null> {
  const res = await api.get<ApiEnvelope<SuperiorUser | null>>("/users/my-superior", undefined, { signal });
  return res?.data ?? null;
}
