import type { UserBrief } from "./auth";
import type { ActivityLog, DocumentSignature } from "./common";
import type { Attachment } from "./work-order";

export type ServiceRequestStatus =
  | "draft"
  | "waiting_superior"
  | "waiting_executor"
  | "in_progress"
  | "completed"
  | "rejected"
  | "cancelled"
  | "converted";

export type ServiceRequestPriority = "high" | "medium" | "low";

export type ServiceRequestScope = "mine" | "unit" | "executor" | "all";

export type ApprovalStepKey = "submission" | "superior" | "executor_lead" | "executor";

export type ApprovalStepKind = "submission" | "approval" | "completion";

export type ApprovalStepStatus =
  | "waiting"
  | "pending"
  | "approved"
  | "completed"
  | "rejected"
  | "revision_requested"
  | "skipped"
  | "cancelled";

export interface CurrentStep {
  key: ApprovalStepKey;
  label: string;
  assignee_label: string | null;
  waiting_since: string | null;
}

export interface ServiceRequestListItem {
  id: number;
  /** null while the draft has never been submitted */
  request_number: string | null;
  status: ServiceRequestStatus;
  status_label: string;
  priority: ServiceRequestPriority;
  priority_label: string;
  executor_unit: { id: number; code: string; display_name: string };
  service_category: { id: number; name: string } | null;
  office: { id: number; code: string | null; name: string } | null;
  purpose: string;
  requester: UserBrief;
  requester_sub_bagian_name: string | null;
  current_step: CurrentStep | null;
  revision_no: number;
  created_at: string;
  submitted_at: string | null;
  completed_at: string | null;
}

/** Snapshot at submit; while draft it mirrors the current profile. */
export interface ServiceRequestIdentity {
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
  key: ApprovalStepKey;
  label: string;
  kind: ApprovalStepKind;
  status: ApprovalStepStatus;
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

export interface SuperiorUser extends UserBrief {
  grade_code: string | null;
}

export interface ServiceRequestDetail extends ServiceRequestListItem {
  estimated_cost: number | string | null;
  identity: ServiceRequestIdentity | null;
  superior: SuperiorUser | null;
  assigned_executor: UserBrief | null;
  /** KETERANGAN */
  executor_notes: string | null;
  /** PETUNJUK DAN ATURAN (snapshot after submit) */
  rules: string | null;
  contact_footer: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  rejected_at: string | null;
  conversion_reason: string | null;
  converted_at: string | null;
  source_work_order: { id: number; wo_number: string } | null;
  converted_work_order: { id: number; wo_number: string } | null;
  /** Latest round (current revision_no). */
  approval_steps: ApprovalStep[];
  /** All rounds, chronological. */
  approval_history: ApprovalStep[];
  attachments: Attachment[];
  signatures: DocumentSignature[];
  logs: ActivityLog[];
  permissions: ServiceRequestPermissions;
}

/* ---------- Payloads ---------- */

/** Body of `POST /service-requests` and `PUT /service-requests/{id}`. */
export interface ServiceRequestPayload {
  executor_unit_id: number | null;
  service_category_id: number | null;
  office_id: number | null;
  purpose: string;
  priority: ServiceRequestPriority;
  estimated_cost?: number | null;
  superior_id?: number | null;
}

export interface ApprovePayload {
  notes?: string | null;
  assigned_executor_id?: number | null;
}

/** Query of `GET /service-requests` and its export. */
export interface ServiceRequestListParams {
  scope?: ServiceRequestScope;
  status?: string;
  executor_unit_id?: string;
  service_category_id?: string;
  priority?: string;
  office_id?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  per_page?: number;
}
