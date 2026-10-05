import type { UserBrief } from "./auth";

export type ApprovalDocumentType = "service_request" | "work_order";

/** `GET /approvals/pending` item (oldest first). */
export interface PendingApproval {
  step_id: number;
  step_key: string;
  step_label: string;
  /** "approve" or "complete" */
  action: string;
  document_type: ApprovalDocumentType | string;
  document_type_label: string;
  document_id: number;
  document_number: string | null;
  title: string;
  requester: UserBrief;
  executor_unit: { id: number; code: string; display_name: string } | null;
  priority: string;
  priority_label: string;
  waiting_since: string | null;
  /** waiting > 24 hours */
  overdue: boolean;
}
