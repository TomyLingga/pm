import type { UserBrief } from "./auth";
import type { ActivityLog } from "./common";
import type { LocationOption } from "./lookups";
import type { Attachment, MaterialInput, WorkOrderMaterial, WorkOrderPriority } from "./work-order";

/* ---------- Enums ---------- */

export type FrequencyType = "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "every_n_days";

export type PmTaskStatus = "scheduled" | "due" | "in_progress" | "completed" | "overdue" | "skipped";

/** Calendar-only pseudo status for occurrences beyond the generation horizon. */
export type CalendarStatus = PmTaskStatus | "projected";

export type ChecklistInputType = "ok_nok_na" | "number" | "text";

export type ItemResult = "ok" | "not_ok" | "na";

export type EquipmentStatus = "active" | "under_repair" | "inactive" | "disposed";

export type PmTaskScope = "mine" | "unit" | "all";

export interface UnitRef {
  id: number;
  code: string;
  display_name: string;
}

/* ---------- Equipment ---------- */

export interface EquipmentItem {
  id: number;
  code: string | null;
  name: string;
  location: LocationOption | null;
  executor_unit: UnitRef | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: EquipmentStatus;
  status_label: string;
}

export interface EquipmentStats {
  open_work_orders: number;
  last_pm_completed_at: string | null;
  next_pm_due_at: string | null;
  active_schedules: number;
}

export interface EquipmentDetail extends EquipmentItem {
  stats: EquipmentStats;
  permissions: { can_update: boolean; can_delete: boolean };
}

/** Body of `POST /equipment` and `PUT /equipment/{id}`. */
export interface EquipmentPayload {
  code: string;
  name: string;
  location_id?: number | null;
  executor_unit_id?: number | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  status?: EquipmentStatus;
}

export interface EquipmentListParams {
  q?: string;
  executor_unit_id?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

/** Maintenance history entry of an equipment (PM tasks + work orders, newest first). */
export interface HistoryEntry {
  type: "pm_task" | "work_order";
  id: number;
  number: string;
  date: string;
  status: string;
  status_label: string;
  title: string;
  actor_name: string | null;
  /** null for work orders */
  findings_count: number | null;
  /** null for work orders */
  is_late: boolean | null;
}

/* ---------- Checklist templates ---------- */

export interface ChecklistItemDef {
  id: number;
  sort_order: number;
  section: string | null;
  description: string;
  input_type: ChecklistInputType;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  is_required: boolean;
  photo_required: boolean;
}

export interface ChecklistTemplateListItem {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  executor_unit: UnitRef;
  items_count: number;
  schedules_count: number;
  updated_at: string;
}

export interface ChecklistTemplateDetail extends ChecklistTemplateListItem {
  items: ChecklistItemDef[];
  permissions: { can_update: boolean; can_delete: boolean };
}

export interface ChecklistItemInput {
  /** Existing item id; omit for a new item. Items not sent are deleted. */
  id?: number;
  section?: string | null;
  description: string;
  input_type: ChecklistInputType;
  unit?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  is_required: boolean;
  photo_required: boolean;
}

export interface ChecklistTemplatePayload {
  executor_unit_id: number;
  name: string;
  description?: string | null;
  is_active?: boolean;
  /** Order of the array = order of the checklist. */
  items: ChecklistItemInput[];
}

export interface ChecklistTemplateListParams {
  executor_unit_id?: string;
  q?: string;
  /** "1" = active only */
  active?: string;
}

/* ---------- PM schedules ---------- */

export interface PmScheduleListItem {
  id: number;
  name: string;
  is_active: boolean;
  executor_unit: UnitRef;
  checklist_template: { id: number; name: string };
  frequency_type: FrequencyType;
  frequency_interval: number;
  frequency_label: string;
  start_at: string;
  end_at: string | null;
  tolerance_hours: number;
  due_window_hours: number | null;
  estimated_minutes: number | null;
  pic: UserBrief | null;
  equipment: Array<{ id: number; code: string | null; name: string }>;
  equipment_count: number;
  next_due_at: string | null;
  generated_until: string | null;
}

export type PmTaskCounts = Record<PmTaskStatus, number>;

export interface PmScheduleDetail extends PmScheduleListItem {
  /** Next 5 occurrences */
  upcoming: string[];
  task_counts: Partial<PmTaskCounts>;
  permissions: { can_update: boolean; can_delete: boolean };
}

/** Body of `POST /pm-schedules` and `PUT /pm-schedules/{id}`. */
export interface PmSchedulePayload {
  name: string;
  executor_unit_id: number;
  checklist_template_id: number;
  equipment_ids: number[];
  frequency_type: FrequencyType;
  frequency_interval: number;
  /** ISO-8601 +07:00, date + time of the first occurrence */
  start_at: string;
  end_at?: string | null;
  tolerance_hours: number;
  due_window_hours?: number | null;
  estimated_minutes?: number | null;
  pic_user_id: number;
  is_active?: boolean;
}

export interface PmSchedulePreviewPayload {
  frequency_type: FrequencyType;
  frequency_interval: number;
  start_at: string;
  end_at?: string | null;
  /** <= 20, default 8 */
  count?: number;
}

export interface PmSchedulePreview {
  frequency_label: string;
  dates: string[];
}

export interface PmScheduleListParams {
  executor_unit_id?: string;
  equipment_id?: string;
  pic_user_id?: string;
  /** "1" | "0" */
  active?: string;
  q?: string;
  page?: number;
}

/* ---------- PM tasks ---------- */

export interface PmTaskListItem {
  id: number;
  number: string;
  status: PmTaskStatus;
  status_label: string;
  due_at: string;
  /** Start of the JATUH_TEMPO window (due_at - window) */
  due_window_at: string | null;
  /** due_at + tolerance */
  overdue_at: string | null;
  is_late: boolean;
  schedule: { id: number; name: string; frequency_label: string } | null;
  equipment: { id: number; code: string | null; name: string; location_name: string | null };
  executor_unit: UnitRef;
  pic: UserBrief | null;
  started_at: string | null;
  completed_at: string | null;
  has_skip_proposal: boolean;
  findings_count: number;
}

export interface PmTaskItemWorkOrder {
  id: number;
  wo_number: string;
  status: string;
  status_label: string;
}

/** Checklist item of a started task (definition snapshot + answer). */
export interface PmTaskItem extends Omit<ChecklistItemDef, "id"> {
  id: number;
  result: ItemResult | null;
  result_label: string | null;
  value_number: number | null;
  value_text: string | null;
  notes: string | null;
  attachments: Attachment[];
  work_order: PmTaskItemWorkOrder | null;
}

export interface PmTaskPermissions {
  can_start: boolean;
  can_work: boolean;
  can_complete: boolean;
  can_propose_skip: boolean;
  can_skip: boolean;
  can_reassign: boolean;
  can_create_work_order: boolean;
}

export interface SkipProposal {
  reason: string;
  by: UserBrief;
  at: string;
}

export interface PmTaskDetail extends PmTaskListItem {
  checklist_template: { id: number; name: string } | null;
  tolerance_hours: number | null;
  estimated_minutes: number | null;
  started_by: UserBrief | null;
  completed_by: UserBrief | null;
  duration_minutes: number | null;
  notes: string | null;
  skip_reason: string | null;
  /** null with status `skipped` = skipped by the system */
  skipped_by: UserBrief | null;
  skipped_at: string | null;
  skip_proposal: SkipProposal | null;
  /** Filled while the task has NOT been started (items empty). */
  checklist_preview: ChecklistItemDef[];
  /** Filled after start. */
  items: PmTaskItem[];
  materials: WorkOrderMaterial[];
  /** General task photos (not per item). */
  attachments: Attachment[];
  logs: ActivityLog[];
  permissions: PmTaskPermissions;
}

/** One entry of `PUT /pm-tasks/{id}/items` (partial save). */
export interface PmTaskItemInput {
  id: number;
  result?: ItemResult | null;
  value_number?: number | null;
  value_text?: string | null;
  notes?: string | null;
}

export interface PmTaskCompletePayload {
  duration_minutes?: number | null;
  notes?: string | null;
  items?: PmTaskItemInput[];
  materials?: MaterialInput[];
}

export interface PmTaskWorkOrderPayload {
  service_category_id: number;
  priority: WorkOrderPriority;
  /** Defaults to the task's unit */
  executor_unit_id?: number;
  request_description?: string;
}

export interface PmTaskListParams {
  scope?: PmTaskScope;
  /** comma separated */
  status?: string;
  executor_unit_id?: string;
  equipment_id?: string;
  schedule_id?: string;
  pic_user_id?: string;
  due_from?: string;
  due_to?: string;
  /** Period for finished tasks only (completed/skipped, by end date). */
  from?: string;
  to?: string;
  q?: string;
  sort?: string;
  page?: number;
  per_page?: number;
}

export interface PmTaskSummaryCounts {
  due: number;
  overdue: number;
  in_progress: number;
}

export interface PmTaskSummary {
  mine: PmTaskSummaryCounts;
  unit: PmTaskSummaryCounts;
}

/* ---------- Calendar ---------- */

export interface CalendarEvent {
  /** "t-12" for a task, "p-5-7-2026-12-05T08:00" for a projection */
  key: string;
  /** null for projections */
  task_id: number | null;
  projected: boolean;
  schedule_id: number;
  schedule_name: string;
  equipment: { id: number; code: string | null; name: string };
  due_at: string;
  status: CalendarStatus;
  status_label: string;
  is_late: boolean;
  pic: UserBrief | null;
}

export interface CalendarParams {
  /** YYYY-MM-DD, range <= 62 days */
  start: string;
  end: string;
  scope?: PmTaskScope;
  executor_unit_id?: string;
  equipment_id?: string;
  pic_user_id?: string;
}
