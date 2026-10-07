// Types mirroring docs/API_WORK_ORDER.md (binding API contract v1).

export type WorkOrderStatus =
  | 'submitted'
  | 'received'
  | 'in_progress'
  | 'completed'
  | 'closed'
  | 'cancelled'
  | 'converted';

export type Priority = 'high' | 'medium' | 'low';

export type ClearanceResult = 'ok' | 'not_ok';

export type WorkOrderScope = 'mine' | 'unit' | 'pool' | 'assigned' | 'executor' | 'all';

export type AttachmentCollection = 'photo_before' | 'photo_after' | 'document';

export interface OrgUnit {
  id: number;
  code: string;
  name: string;
  type: string;
}

export interface MyExecutorUnit {
  id: number;
  code: string;
  display_name: string;
  is_lead: boolean;
}

export interface Me {
  id: number;
  nrk: string;
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
  executor_units: MyExecutorUnit[];
}

export interface UserBrief {
  id: number;
  nrk: string;
  name: string;
  position: string | null;
  photo_url: string | null;
}

export interface Assignee extends UserBrief {
  is_lead: boolean;
}

export interface StaffMember extends UserBrief {
  grade_code: string | null;
  is_lead: boolean;
}

// ---- Auth ----

export interface LoginSuccess {
  token: string;
  user: Me;
}

export interface LoginTotpRequired {
  requires_totp: true;
  totp_token: string;
}

export type LoginResponse = LoginSuccess | LoginTotpRequired;

// ---- Lookups ----

export interface ServiceCategory {
  id: number;
  name: string;
  requires_note: boolean;
}

export interface ExecutorUnit {
  id: number;
  code: string;
  display_name: string;
  categories: ServiceCategory[];
}

export interface LocationItem {
  id: number;
  code: string;
  name: string;
}

export type EquipmentStatus = 'active' | 'under_repair' | 'inactive' | 'disposed';

export interface EquipmentItem {
  id: number;
  code: string;
  name: string;
  location: LocationItem | null;
  // Added by API_PM.md §2 (optional so older lookups keep type-checking).
  executor_unit?: { id: number; code: string; display_name: string } | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  status?: EquipmentStatus | string;
  status_label?: string;
}

export interface MaterialItem {
  id: number;
  code: string;
  name: string;
  unit: string;
}

// ---- Work order ----

export interface WorkOrderListItem {
  id: number;
  wo_number: string;
  issued_at: string;
  status: WorkOrderStatus;
  status_label: string;
  priority: Priority;
  priority_label: string;
  executor_unit: { id: number; code: string; display_name: string };
  service_category: { id: number; name: string } | null;
  category_note: string | null;
  equipment_code: string | null;
  equipment_name: string | null;
  location_name: string | null;
  request_description: string;
  requester: UserBrief;
  requester_sub_bagian_name: string | null;
  assignees: Assignee[];
  picked_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
}

export interface WorkOrderMaterial {
  id: number;
  material_id: number | null;
  material_name: string;
  quantity: number | string;
  unit: string;
}

export interface WorkOrderLabour {
  id: number;
  user_id: number | null;
  worker_name: string;
  started_at: string;
  finished_at: string;
  duration_minutes: number;
}

export interface Clearance {
  item_no: number;
  item_label: string;
  mtc_result: ClearanceResult | null;
  mtc_confirmed_by: UserBrief | null;
  mtc_confirmed_at: string | null;
  user_result: ClearanceResult | null;
  user_confirmed_by: UserBrief | null;
  user_confirmed_at: string | null;
}

export interface Attachment {
  id: number;
  collection: AttachmentCollection;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  uploaded_by: UserBrief | null;
  created_at: string;
}

export interface Signature {
  role_key: 'requested' | 'received' | 'completed' | 'accepted' | string;
  role_label: string;
  signer_name: string;
  signed_at: string;
  verify_url: string | null;
}

export interface WorkOrderLog {
  id: number;
  action: string;
  action_label: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  user: UserBrief | null;
  created_at: string;
}

export interface WorkOrderPermissions {
  can_update: boolean;
  can_cancel: boolean;
  can_pick: boolean;
  can_receive: boolean;
  can_reassign: boolean;
  can_start: boolean;
  can_work: boolean;
  can_complete: boolean;
  can_accept: boolean;
  can_upload: boolean;
  /** Executor lead may convert a submitted/received WO into a Form Request (API_SERVICE_REQUEST §4). */
  can_convert?: boolean;
}

export interface WorkOrderDetail extends WorkOrderListItem {
  requester_org_unit_name: string | null;
  requester_bagian_name: string | null;
  equipment: { id: number; code: string; name: string } | null;
  location: LocationItem | null;
  location_note: string | null;
  received_by: UserBrief | null;
  received_at: string | null;
  picked_by: UserBrief | null;
  completed_by: UserBrief | null;
  work_done: string | null;
  accepted_by: UserBrief | null;
  accepted_at: string | null;
  auto_accepted: boolean;
  acceptance_due_at: string | null;
  total_breakdown_hours: number | null;
  remarks: string | null;
  rework_count: number;
  cancel_reason: string | null;
  cancelled_at: string | null;
  sla_minutes: number | null;
  materials: WorkOrderMaterial[];
  labours: WorkOrderLabour[];
  total_labour_minutes: number;
  clearances: Clearance[];
  attachments: Attachment[];
  signatures: Signature[];
  logs: WorkOrderLog[];
  permissions: WorkOrderPermissions;
  // Conversion fields (API_SERVICE_REQUEST.md §4); optional until the backend ships them.
  converted_service_request?: { id: number; request_number: string | null } | null;
  source_service_request?: { id: number; request_number: string | null } | null;
  conversion_reason?: string | null;
  /** WO created from a PM finding (API_PM.md §6). */
  source_pm_task?: { id: number; number: string; item_description: string | null } | null;
}

// ---- Request bodies ----

export interface CreateWorkOrderBody {
  executor_unit_id: number;
  service_category_id: number;
  category_note: string | null;
  equipment_id: number | null;
  equipment_code: string | null;
  equipment_name: string | null;
  location_id: number | null;
  location_note: string | null;
  request_description: string;
  priority: Priority;
}

export interface MaterialInput {
  material_id?: number | null;
  material_name: string;
  quantity: number;
  unit: string;
}

export interface LabourInput {
  user_id?: number | null;
  worker_name: string;
  started_at: string;
  finished_at: string;
}

export interface ClearanceInput {
  item_no: 1 | 2;
  result: ClearanceResult;
}

export interface CompleteBody {
  work_done: string;
  materials?: MaterialInput[];
  labours?: LabourInput[];
  clearance: ClearanceInput[];
  remarks?: string | null;
}

export type AcceptBody =
  | {
      acceptance: 'yes';
      clearance: ClearanceInput[];
      total_breakdown_hours?: number | null;
      remarks?: string | null;
    }
  | { acceptance: 'no'; reason: string };

// ---- Envelopes ----

export interface DataEnvelope<T> {
  data: T;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface Paginated<T> {
  data: T[];
  links?: Record<string, string | null>;
  meta: PaginationMeta;
}

// ---- Notifications ----

export type DocumentType = 'work_order' | 'service_request' | 'pm_task';

export interface AppNotification {
  id: number | string;
  event: string;
  title: string;
  body: string;
  work_order_id: number | null;
  document_type?: DocumentType | string | null;
  document_id?: number | null;
  service_request_id?: number | null;
  pm_task_id?: number | null;
  alarm: boolean;
  read_at: string | null;
  created_at: string;
}

// ======================================================================
// Form Request & generic approvals (docs/API_SERVICE_REQUEST.md)
// ======================================================================

export type ServiceRequestStatus =
  | 'draft'
  | 'waiting_superior'
  | 'waiting_executor'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'converted';

export type ApprovalStepKey = 'submission' | 'superior' | 'executor_lead' | 'executor';

export type ApprovalStepStatus =
  | 'waiting'
  | 'pending'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'revision_requested'
  | 'skipped'
  | 'cancelled';

export type ServiceRequestScope = 'mine' | 'unit' | 'executor' | 'all';

export interface Office {
  id: number;
  code: string;
  name: string;
}

export interface RequestExecutorUnit extends ExecutorUnit {
  request_rules: string | null;
  contact_footer: string | null;
}

export interface SuperiorCandidate extends UserBrief {
  grade_code: string | null;
  grade_level?: number | null;
}

export interface CurrentStep {
  key: ApprovalStepKey | string;
  label: string;
  assignee_label: string | null;
  waiting_since: string | null;
}

export interface ServiceRequestListItem {
  id: number;
  request_number: string | null;
  status: ServiceRequestStatus;
  status_label: string;
  priority: Priority;
  priority_label: string;
  executor_unit: { id: number; code: string; display_name: string };
  service_category: { id: number; name: string } | null;
  office: Office | null;
  purpose: string;
  requester: UserBrief;
  requester_sub_bagian_name: string | null;
  current_step: CurrentStep | null;
  revision_no: number;
  created_at: string;
  submitted_at: string | null;
  completed_at: string | null;
}

export interface RequestIdentity {
  name: string | null;
  employment_status: string | null;
  nrk: string | null;
  position: string | null;
  superior_name: string | null;
  bagian: string | null;
  sub_bagian: string | null;
  email: string | null;
  phone: string | null;
}

export interface ApprovalStep {
  id: number;
  round: number;
  order: number;
  key: ApprovalStepKey | string;
  label: string;
  kind: 'submission' | 'approval' | 'completion' | string;
  status: ApprovalStepStatus | string;
  status_label: string;
  assignee_label: string | null;
  assignee_user: UserBrief | null;
  acted_by: UserBrief | null;
  actor_phone: string | null;
  acted_at: string | null;
  notes: string | null;
  activated_at: string | null;
}

export interface ServiceRequestPermissions {
  can_update: boolean;
  can_delete: boolean;
  can_submit: boolean;
  can_cancel: boolean;
  can_change_superior: boolean;
  can_approve: boolean;
  can_reject: boolean;
  can_request_revision: boolean;
  can_complete: boolean;
  can_convert: boolean;
  can_upload: boolean;
}

export interface ServiceRequestDetail extends ServiceRequestListItem {
  estimated_cost: number | string | null;
  identity: RequestIdentity | null;
  superior: (UserBrief & { grade_code?: string | null }) | null;
  assigned_executor: UserBrief | null;
  executor_notes: string | null;
  rules: string | null;
  contact_footer: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  rejected_at: string | null;
  conversion_reason: string | null;
  converted_at: string | null;
  source_work_order: { id: number; wo_number: string } | null;
  converted_work_order: { id: number; wo_number: string } | null;
  approval_steps: ApprovalStep[];
  approval_history: ApprovalStep[];
  attachments: Attachment[];
  signatures: Signature[];
  logs: WorkOrderLog[];
  permissions: ServiceRequestPermissions;
}

export interface ServiceRequestBody {
  executor_unit_id: number;
  service_category_id: number;
  office_id: number;
  purpose: string;
  priority: Priority;
  estimated_cost?: number | null;
  superior_id?: number | null;
}

export interface PendingApproval {
  step_id: number;
  step_key: ApprovalStepKey | string;
  step_label: string;
  action: 'approve' | 'complete' | string;
  document_type: DocumentType | string;
  document_type_label: string;
  document_id: number;
  document_number: string | null;
  title: string;
  requester: UserBrief | null;
  executor_unit: { id: number; code: string; display_name: string } | null;
  priority: Priority;
  priority_label: string;
  waiting_since: string | null;
  overdue: boolean;
}

// ======================================================================
// Preventive Maintenance (docs/API_PM.md) — task execution only on mobile
// ======================================================================

export type PmTaskStatus = 'scheduled' | 'due' | 'in_progress' | 'completed' | 'overdue' | 'skipped';

export type PmInputType = 'ok_nok_na' | 'number' | 'text';

export type PmItemResult = 'ok' | 'not_ok' | 'na';

export type PmTaskScope = 'mine' | 'unit' | 'all';

/** Checklist item definition (template); shown as a read-only preview before the task starts. */
export interface ChecklistItemDef {
  id: number;
  sort_order: number;
  section: string | null;
  description: string;
  input_type: PmInputType;
  unit: string | null;
  min_value: number | string | null;
  max_value: number | string | null;
  is_required: boolean;
  photo_required: boolean;
}

export interface PmTaskItemWorkOrder {
  id: number;
  wo_number: string;
  status: string;
  status_label: string;
}

/** Checklist item of a started task (definition snapshot + result). */
export interface PmTaskItem extends ChecklistItemDef {
  result: PmItemResult | null;
  result_label: string | null;
  value_number: number | string | null;
  value_text: string | null;
  notes: string | null;
  attachments: Attachment[];
  work_order: PmTaskItemWorkOrder | null;
}

export interface PmTaskListItem {
  id: number;
  number: string;
  status: PmTaskStatus;
  status_label: string;
  due_at: string;
  due_window_at: string | null;
  overdue_at: string | null;
  is_late: boolean;
  schedule: { id: number; name: string; frequency_label: string } | null;
  equipment: { id: number; code: string; name: string; location_name: string | null } | null;
  executor_unit: { id: number; code: string; display_name: string };
  pic: UserBrief | null;
  started_at: string | null;
  completed_at: string | null;
  has_skip_proposal: boolean;
  findings_count: number;
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

export interface PmSkipProposal {
  reason: string;
  by: UserBrief | null;
  at: string | null;
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
  /** null while status is `skipped` = skipped by the system. */
  skipped_by: UserBrief | null;
  skipped_at: string | null;
  skip_proposal: PmSkipProposal | null;
  /** Filled while the task has NOT been started (items is empty). */
  checklist_preview: ChecklistItemDef[];
  /** Filled after start. */
  items: PmTaskItem[];
  materials: WorkOrderMaterial[];
  /** General task photos (not per item). */
  attachments: Attachment[];
  logs: WorkOrderLog[];
  permissions: PmTaskPermissions;
}

/** Partial item save (auto-save) — only the changed keys are sent. */
export interface PmItemPayload {
  id: number;
  result?: PmItemResult | null;
  value_number?: number | null;
  value_text?: string | null;
  notes?: string | null;
}

export interface PmCompleteBody {
  duration_minutes?: number | null;
  notes?: string | null;
  items?: PmItemPayload[];
  materials?: MaterialInput[];
}

export interface PmFindingWorkOrderBody {
  service_category_id: number;
  priority: Priority;
  executor_unit_id?: number;
  request_description?: string;
}

export interface PmSummaryCounts {
  due: number;
  overdue: number;
  in_progress: number;
}

export interface PmSummary {
  mine: PmSummaryCounts;
  unit: PmSummaryCounts;
}

export interface EquipmentDetail extends EquipmentItem {
  stats?: {
    open_work_orders: number;
    last_pm_completed_at: string | null;
    next_pm_due_at: string | null;
    active_schedules: number;
  } | null;
  permissions?: { can_update: boolean; can_delete: boolean };
}

/** Maintenance history of one equipment (PM tasks + work orders), newest first. */
export interface HistoryEntry {
  type: 'pm_task' | 'work_order';
  id: number;
  number: string;
  date: string | null;
  status: string;
  status_label: string;
  title: string | null;
  actor_name: string | null;
  /** null for work orders. */
  findings_count: number | null;
  /** null for work orders. */
  is_late: boolean | null;
}
