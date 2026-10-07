import type { UserBrief } from "./auth";
import type { ActivityLog, DocumentSignature } from "./common";
import type { LocationOption } from "./lookups";

export type WorkOrderStatus =
  | "submitted"
  | "received"
  | "in_progress"
  | "completed"
  | "closed"
  | "cancelled"
  | "converted";

export type WorkOrderPriority = "high" | "medium" | "low";

export type ClearanceResult = "ok" | "not_ok";

export type WorkOrderScope = "mine" | "unit" | "pool" | "assigned" | "executor" | "all";

export type WorkOrderSort = "-issued_at" | "issued_at" | "-priority";

export type AttachmentCollection = "photo_before" | "photo_after" | "document";

export type SignatureRole = "requested" | "received" | "completed" | "accepted";

export interface WorkOrderAssignee extends UserBrief {
  is_lead: boolean;
}

export interface WorkOrderListItem {
  id: number;
  wo_number: string;
  issued_at: string;
  status: WorkOrderStatus;
  status_label: string;
  priority: WorkOrderPriority;
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
  assignees: WorkOrderAssignee[];
  picked_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
}

export interface WorkOrderMaterial {
  id: number;
  material_id: number | null;
  material_name: string;
  quantity: number | string;
  unit: string | null;
}

export interface WorkOrderLabour {
  id: number;
  user_id: number | null;
  worker_name: string;
  started_at: string;
  finished_at: string;
  duration_minutes: number;
}

export interface WorkOrderClearance {
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
  /** `/api/v1/attachments/{id}` (same origin, authenticated by the session cookie). */
  url: string;
  uploaded_by: UserBrief;
  created_at: string;
}

export interface WorkOrderSignature extends DocumentSignature {
  role_key: SignatureRole;
}

export type WorkOrderLog = ActivityLog;

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
  /** Convert to Form Request (executor lead; submitted/received). Absent on older backends. */
  can_convert?: boolean;
}

export interface WorkOrderDetail extends WorkOrderListItem {
  requester_org_unit_name: string | null;
  requester_bagian_name: string | null;
  equipment: { id: number; code: string | null; name: string } | null;
  location: LocationOption | null;
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
  /** picked_at -> completed_at, in minutes */
  sla_minutes: number | null;
  materials: WorkOrderMaterial[];
  labours: WorkOrderLabour[];
  total_labour_minutes: number;
  clearances: WorkOrderClearance[];
  attachments: Attachment[];
  signatures: WorkOrderSignature[];
  logs: WorkOrderLog[];
  permissions: WorkOrderPermissions;
  /** This WO was converted into a Form Request (status `converted`). */
  converted_service_request?: { id: number; request_number: string | null } | null;
  /** This WO was created from a Form Request. */
  source_service_request?: { id: number; request_number: string | null } | null;
  conversion_reason?: string | null;
  /** This WO was created from a finding of a PM task. */
  source_pm_task?: { id: number; number: string; item_description: string | null } | null;
}

/* ---------- Request payloads ---------- */

/** Body of `POST /work-orders` and `PUT /work-orders/{id}`. */
export interface WorkOrderPayload {
  executor_unit_id: number | null;
  service_category_id: number | null;
  category_note: string | null;
  equipment_id: number | null;
  equipment_code: string | null;
  equipment_name: string | null;
  location_id: number | null;
  location_note: string | null;
  request_description: string;
  priority: WorkOrderPriority;
}

export interface ReceivePayload {
  assignee_ids: number[];
  lead_id: number;
  priority?: WorkOrderPriority;
}

export interface AssigneesPayload {
  assignee_ids: number[];
  lead_id: number;
}

export interface MaterialInput {
  material_id?: number | null;
  material_name: string;
  quantity: number;
  unit: string | null;
}

export interface LabourInput {
  user_id?: number | null;
  worker_name: string;
  /** ISO-8601 with +07:00 offset */
  started_at: string;
  finished_at: string;
}

export interface ClearanceInput {
  item_no: number;
  result: ClearanceResult;
}

export interface CompletePayload {
  work_done: string;
  materials?: MaterialInput[];
  labours?: LabourInput[];
  clearance: ClearanceInput[];
  remarks?: string | null;
}

export interface AcceptPayload {
  acceptance: "yes" | "no";
  reason?: string;
  clearance?: ClearanceInput[];
  total_breakdown_hours?: number | null;
  remarks?: string | null;
}

/** Query of `GET /work-orders` and `GET /work-orders/export`. */
export interface WorkOrderListParams {
  scope?: WorkOrderScope;
  status?: string;
  executor_unit_id?: string;
  priority?: string;
  service_category_id?: string;
  location_id?: string;
  equipment_id?: string;
  issued_from?: string;
  issued_to?: string;
  /** Period for finished WOs only (closed/cancelled/converted, by end date). */
  from?: string;
  to?: string;
  q?: string;
  sort?: WorkOrderSort;
  page?: number;
  per_page?: number;
}
