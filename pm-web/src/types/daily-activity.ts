import type { PaginationMeta } from "./api";
import type { UserBrief } from "./auth";
import type { ActivityLog } from "./common";

/** `open` OPEN · `on_progress` ON PROGRESS · `closed` CLOSED (docs/API_PROGRAM_ACTIVITY.md, section 1). */
export type DailyActivityStatus = "open" | "on_progress" | "closed";

/** `mine` own reports · `team` subtree (leads) · `all` every unit (admin). */
export type DailyActivityScope = "mine" | "team" | "all";

export interface DailyActivityOrgUnit {
  id: number;
  code: string | null;
  name: string;
}

/** The yearly work-programme activity a daily report is linked to (`work_program_activity_id`). */
export interface DailyActivityProgramLink {
  id: number;
  title: string;
  item_code: string;
  item_title: string;
  program_id: number;
  program_code: string;
  program_title: string;
}

/** The work order a report was created from automatically when a technician completed it (section 3). */
export interface DailyActivityWorkOrderLink {
  id: number;
  wo_number: string;
  status: string;
  request_description: string | null;
}

/** `DailyActivity` list item (section 3). */
export interface DailyActivity {
  id: number;
  /** Y-m-d */
  activity_date: string;
  /** 1 (1-7) · 2 (8-14) · 3 (15-21) · 4 (22-28) · 5 (29-31) */
  week_of_month: number;
  title: string;
  description: string;
  follow_up: string | null;
  obstacles: string | null;
  status: DailyActivityStatus;
  status_label: string;
  closed_at: string | null;
  /** The person the report belongs to (PIC). */
  user: UserBrief;
  org_unit: DailyActivityOrgUnit | null;
  program_activity: DailyActivityProgramLink | null;
  /** Set on reports created automatically from a completed work order. */
  work_order: DailyActivityWorkOrderLink | null;
  /** Who recorded it (a lead may report on behalf of a subordinate). */
  created_by: UserBrief | null;
  /** Upload time. */
  created_at: string;
  updated_at: string;
}

export interface DailyActivityPermissions {
  can_update: boolean;
  can_delete: boolean;
}

/** `GET /daily-activities/{id}` */
export interface DailyActivityDetail extends DailyActivity {
  logs: ActivityLog[];
  permissions: DailyActivityPermissions;
}

export interface DailyActivitySummary {
  total: number;
  open: number;
  on_progress: number;
  closed: number;
}

export interface DailyActivityListMeta extends PaginationMeta {
  summary: DailyActivitySummary;
  scope: DailyActivityScope;
  available_scopes: DailyActivityScope[];
  can_report_for_others: boolean;
}

/** `GET /daily-activities` */
export interface DailyActivityListResponse {
  data: DailyActivity[];
  meta: DailyActivityListMeta;
}

/**
 * Query of `GET /daily-activities`. The period (`from`/`to`) only narrows `closed` reports by `activity_date`;
 * `open` and `on_progress` reports are always listed. `week` applies to every status.
 */
export type DailyActivityListParams = {
  scope?: DailyActivityScope;
  week?: number;
  from?: string;
  to?: string;
  /** Comma separated; absent = every status. */
  status?: string;
  user_id?: string | number;
  work_program_activity_id?: number;
  q?: string;
  page?: number;
  per_page?: number;
};

/** `GET /daily-activities/people` (same shape as `/work-programs/people`). */
export interface DailyActivityPerson extends UserBrief {
  grade_code?: string | null;
  org_unit?: { id: number; name: string } | null;
}

/** `POST /daily-activities` */
export interface DailyActivityPayload {
  activity_date: string;
  title: string;
  description: string;
  follow_up?: string | null;
  obstacles?: string | null;
  status?: DailyActivityStatus;
  /** Report on behalf of a subordinate (leads only). */
  user_id?: number;
  work_program_activity_id?: number | null;
}

/** `PUT /daily-activities/{id}` (`status` and `user_id` are not accepted here). */
export interface DailyActivityUpdatePayload {
  activity_date?: string;
  title?: string;
  description?: string;
  follow_up?: string | null;
  obstacles?: string | null;
  work_program_activity_id?: number | null;
}

/** `POST /daily-activities/{id}/status` */
export interface DailyActivityStatusPayload {
  status: DailyActivityStatus;
  notes?: string | null;
}
