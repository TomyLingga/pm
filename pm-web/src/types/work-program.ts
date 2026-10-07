import type { OrgUnit, UserBrief } from "./auth";
import type { ActivityLog } from "./common";

/* ---------- Enums (docs/API_PROGRAM_ACTIVITY.md section 1) ---------- */

export type WorkProgramStatus = "active" | "closed";
export type WorkProgramActivityStatus = "open" | "on_progress" | "closed" | "cancelled";
export type WorkProgramPicRole = "utama" | "pendukung";

/** Activities per status (programme, sub-item). */
export interface WorkProgramStatusCounts {
  open: number;
  on_progress: number;
  closed: number;
  cancelled: number;
}

/* ---------- List ---------- */

export interface WorkProgramListItem {
  id: number;
  year: number;
  code: string;
  title: string;
  description: string | null;
  status: WorkProgramStatus;
  status_label: string;
  org_unit: OrgUnit | null;
  items_count: number;
  activities_count: number;
  counts: WorkProgramStatusCounts;
  /** Average activity progress; null until the programme has an activity. */
  progress_pct: number | null;
  created_by: UserBrief | null;
  created_at: string;
  updated_at: string;
}

export interface WorkProgramListMeta {
  year: number;
  years: number[];
  org_units: OrgUnit[];
  can_create: boolean;
}

export interface WorkProgramListResponse {
  data: WorkProgramListItem[];
  meta: WorkProgramListMeta;
}

/** `GET /work-programs` filters (strings because they come from the URL). */
export type WorkProgramListParams = {
  year?: string;
  org_unit_id?: string;
  status?: string;
  q?: string;
};

/* ---------- Detail ---------- */

export interface WorkProgramPic extends UserBrief {
  role: WorkProgramPicRole;
}

export interface WorkProgramActivityPermissions {
  can_edit: boolean;
  can_update_progress: boolean;
  can_change_status: boolean;
  can_delete: boolean;
}

export interface WorkProgramActivity {
  id: number;
  work_program_item_id: number;
  sequence: number;
  title: string;
  action_plan: string | null;
  /** Y-m-d */
  target_date: string | null;
  /** Y-m-d */
  closed_date: string | null;
  status: WorkProgramActivityStatus;
  status_label: string;
  progress_pct: number;
  remarks: string | null;
  pics: WorkProgramPic[];
  daily_activities_count: number;
  updated_at: string;
  permissions: WorkProgramActivityPermissions;
}

/** `GET /work-program-activities/{id}` and the responses of PUT / status. */
export interface WorkProgramActivityDetail extends WorkProgramActivity {
  logs: ActivityLog[];
}

export interface WorkProgramItem {
  id: number;
  code: string;
  title: string;
  description: string | null;
  sort_order: number;
  activities_count: number;
  counts: WorkProgramStatusCounts;
  progress_pct: number | null;
  activities: WorkProgramActivity[];
}

export interface WorkProgramPermissions {
  can_manage: boolean;
  can_add_activity: boolean;
}

/** Programme of the same org unit (any year) the viewer may open; feeds the year switcher. */
export interface WorkProgramSibling {
  id: number;
  year: number;
  code: string;
  title: string;
  status: WorkProgramStatus;
}

export interface WorkProgramDetail extends WorkProgramListItem {
  items: WorkProgramItem[];
  logs: ActivityLog[];
  /** Same org unit, every year, ordered year desc then code; includes this programme. */
  siblings: WorkProgramSibling[];
  permissions: WorkProgramPermissions;
}

/* ---------- Lookups ---------- */

/** `GET /work-programs/people?q=` */
export interface WorkProgramPerson extends UserBrief {
  grade_code: string | null;
  org_unit: { id: number; name: string } | null;
}

/* ---------- Payloads ---------- */

export interface WorkProgramCreatePayload {
  year: number;
  code: string;
  title: string;
  description?: string | null;
  org_unit_id: number;
}

export interface WorkProgramUpdatePayload {
  code?: string;
  title?: string;
  description?: string | null;
  status?: WorkProgramStatus;
}

export interface WorkProgramItemPayload {
  code: string;
  title: string;
  description?: string | null;
}

export interface WorkProgramPicInput {
  user_id: number;
  role?: WorkProgramPicRole;
}

export interface WorkProgramActivityPayload {
  title?: string;
  action_plan?: string | null;
  /** Y-m-d */
  target_date?: string | null;
  remarks?: string | null;
  status?: WorkProgramActivityStatus;
  progress_pct?: number;
  pics?: WorkProgramPicInput[];
}

export interface WorkProgramActivityStatusPayload {
  status: WorkProgramActivityStatus;
  notes?: string | null;
  /** Y-m-d, only meaningful for closed / cancelled. */
  closed_date?: string | null;
}
