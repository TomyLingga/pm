/** `GET /service-categories/sections` — kategori layanan per seksi pelaksana. */
export interface ServiceCategoryItem {
  id: number;
  executor_unit_id: number;
  name: string;
  for_work_order: boolean;
  for_request: boolean;
  requires_note: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface CategorySection {
  org_unit: { id: number; code: string; name: string; parents: string[] };
  /** null until the seksi gets its first category. */
  executor_unit: { id: number; code: string; display_name: string; is_active: boolean } | null;
  /** Leads of the seksi (incl. Kasubag/Kabag above it) and admins may rename/deactivate. */
  can_manage: boolean;
  categories: ServiceCategoryItem[];
}

export interface NewCategoryPayload {
  org_unit_id: number;
  name: string;
  for_work_order: boolean;
  for_request: boolean;
  requires_note: boolean;
}

export type CategoryUpdatePayload = Partial<Pick<ServiceCategoryItem, "name" | "for_work_order" | "for_request" | "requires_note" | "is_active">>;
