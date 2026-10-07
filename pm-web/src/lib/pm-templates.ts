import type { ApiEnvelope } from "@/types/api";
import type {
  ChecklistTemplateDetail,
  ChecklistTemplateListItem,
  ChecklistTemplateListParams,
  ChecklistTemplatePayload,
} from "@/types/pm";
import { api, unwrap } from "./api";

const BASE = "/checklist-templates";

/** Not paginated. */
export function listChecklistTemplates(
  params: ChecklistTemplateListParams = {},
  signal?: AbortSignal,
): Promise<ChecklistTemplateListItem[]> {
  return unwrap(api.get<ApiEnvelope<ChecklistTemplateListItem[]>>(BASE, params, { signal }));
}

export function getChecklistTemplate(id: number, signal?: AbortSignal): Promise<ChecklistTemplateDetail> {
  return unwrap(api.get<ApiEnvelope<ChecklistTemplateDetail>>(`${BASE}/${id}`, undefined, { signal }));
}

export function createChecklistTemplate(payload: ChecklistTemplatePayload): Promise<ChecklistTemplateDetail> {
  return unwrap(api.post<ApiEnvelope<ChecklistTemplateDetail>>(BASE, payload));
}

/** Items are matched by `id` (no id = new, not sent = deleted). Applies to tasks not started yet. */
export function updateChecklistTemplate(id: number, payload: ChecklistTemplatePayload): Promise<ChecklistTemplateDetail> {
  return unwrap(api.put<ApiEnvelope<ChecklistTemplateDetail>>(`${BASE}/${id}`, payload));
}

/** 409 when the template is used by a schedule. */
export function deleteChecklistTemplate(id: number): Promise<void> {
  return api.delete<void>(`${BASE}/${id}`);
}

/** Returns the copy ("... (salinan)"). */
export function duplicateChecklistTemplate(id: number): Promise<ChecklistTemplateDetail> {
  return unwrap(api.post<ApiEnvelope<ChecklistTemplateDetail>>(`${BASE}/${id}/duplicate`));
}
