import type { UserBrief } from "./auth";

/** Status-change / activity log entry (WO and Form Request share the shape). */
export interface ActivityLog {
  id: number;
  action: string;
  action_label: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  user: UserBrief | null;
  created_at: string;
}

/** Electronic signature entry rendered in "Pengesahan" (QR in the PDF). */
export interface DocumentSignature {
  role_key: string;
  role_label: string;
  signer_name: string;
  signed_at: string;
  verify_url: string;
}
