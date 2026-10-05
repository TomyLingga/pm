import type { UserBrief } from "./auth";

export interface ServiceCategory {
  id: number;
  name: string;
  requires_note: boolean;
}

/** `GET /executor-units?for=work_order|request` */
export interface ExecutorUnitOption {
  id: number;
  code: string;
  display_name: string;
  categories: ServiceCategory[];
  /** Petunjuk & Aturan (only for `for=request`) */
  request_rules?: string | null;
  contact_footer?: string | null;
}

export type ExecutorUnitPurpose = "work_order" | "request";

/** `GET /offices` */
export interface OfficeOption {
  id: number;
  code: string | null;
  name: string;
}

/** `GET /users/superior-candidates` */
export interface SuperiorCandidate extends UserBrief {
  grade_code: string | null;
  grade_level?: number | null;
}

/** `GET /executor-units/{id}/staff` */
export interface ExecutorStaff extends UserBrief {
  grade_code: string | null;
  is_lead: boolean;
}

export interface LocationOption {
  id: number;
  code: string | null;
  name: string;
}

export interface EquipmentOption {
  id: number;
  code: string | null;
  name: string;
  location: LocationOption | null;
}

export interface MaterialOption {
  id: number;
  code: string | null;
  name: string;
  unit: string | null;
}
