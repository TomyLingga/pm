export type GlobalRole = "admin" | "management";

/** Compact user shape used across the API. */
export interface UserBrief {
  id: number;
  nrk: string | null;
  name: string;
  position: string | null;
  photo_url: string | null;
}

export interface OrgUnit {
  id: number;
  code: string | null;
  name: string;
  type: string | null;
}

/** Executor unit (seksi pelaksana) the user belongs to. */
export interface ExecutorUnitMembership {
  id: number;
  code: string;
  display_name: string;
  is_lead: boolean;
}

/** `GET /api/v1/auth/me` */
export interface Me {
  id: number;
  nrk: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  employment_status: string | null;
  grade_code: string | null;
  grade_level: number | null;
  photo_url: string | null;
  org_unit: OrgUnit | null;
  bagian: string | null;
  sub_bagian: string | null;
  roles: string[];
  /** Admin sees every unit and manages access; everybody else is a regular user. */
  is_admin: boolean;
  executor_units: ExecutorUnitMembership[];
}
