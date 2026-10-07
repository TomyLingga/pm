import type { ApiEnvelope } from "@/types/api";
import type { PendingApproval } from "@/types/approval";
import { api, unwrap } from "./api";

/** Documents waiting for the current user (oldest first, no pagination). */
export function getPendingApprovals(signal?: AbortSignal): Promise<PendingApproval[]> {
  return unwrap(api.get<ApiEnvelope<PendingApproval[]>>("/approvals/pending", undefined, { signal }));
}

export async function getPendingApprovalCount(signal?: AbortSignal): Promise<number> {
  const res = await api.get<ApiEnvelope<{ count: number }>>("/approvals/pending-count", undefined, { signal });
  return res?.data?.count ?? 0;
}

/** In-app route of a document referenced by approvals / notifications. */
export function documentHref(type: string | null | undefined, id: number | null | undefined): string | null {
  if (!id) return null;
  if (type === "service_request") return `/requests/${id}`;
  if (type === "work_order") return `/work-orders/${id}`;
  if (type === "pm_task") return `/pm/tasks/${id}`;
  if (type === "work_program") return `/programs/${id}`;
  return null;
}
