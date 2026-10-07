import type { ApiEnvelope } from "@/types/api";
import type { CategorySection, CategoryUpdatePayload, NewCategoryPayload, ServiceCategoryItem } from "@/types/category";
import { api, unwrap } from "./api";

export function getCategorySections(signal?: AbortSignal): Promise<CategorySection[]> {
  return unwrap(api.get<ApiEnvelope<CategorySection[]>>("/service-categories/sections", undefined, { signal }));
}

export function addCategory(payload: NewCategoryPayload): Promise<ServiceCategoryItem> {
  return unwrap(api.post<ApiEnvelope<ServiceCategoryItem>>("/service-categories", payload));
}

export function updateCategory(id: number, payload: CategoryUpdatePayload): Promise<ServiceCategoryItem> {
  return unwrap(api.put<ApiEnvelope<ServiceCategoryItem>>(`/service-categories/${id}`, payload));
}
