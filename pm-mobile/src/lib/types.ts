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

export interface EquipmentItem {
  id: number;
  code: string;
  name: string;
  location: LocationItem | null;
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

export type DocumentType = 'work_order' | 'service_request';

export interface AppNotification {
  id: number | string;
  event: string;
  title: string;
  body: string;
  work_order_id: number | null;
  document_type?: DocumentType | string | null;
  document_id?: number | null;
  service_request_id?: number | null;
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
