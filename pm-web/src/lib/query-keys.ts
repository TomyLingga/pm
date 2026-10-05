import type { ExecutorUnitPurpose } from "@/types/lookups";
import type { ServiceRequestListParams } from "@/types/service-request";
import type { WorkOrderListParams } from "@/types/work-order";

/** Central React Query keys so invalidation stays consistent. */
export const queryKeys = {
  me: ["me"] as const,
  executorUnits: (purpose: ExecutorUnitPurpose = "work_order") => ["executor-units", purpose] as const,
  executorStaff: (executorUnitId: number) => ["executor-units", executorUnitId, "staff"] as const,
  locations: (q: string) => ["locations", q] as const,
  equipment: (q: string, executorUnitId: number | null) => ["equipment", executorUnitId, q] as const,
  materials: (q: string) => ["materials", q] as const,
  offices: ["offices"] as const,
  superiorCandidates: (q: string) => ["superior-candidates", q] as const,
  mySuperior: ["my-superior"] as const,

  workOrders: ["work-orders"] as const,
  workOrderLists: ["work-orders", "list"] as const,
  workOrderList: (params: WorkOrderListParams) => ["work-orders", "list", params] as const,
  workOrder: (id: number) => ["work-orders", "detail", id] as const,

  serviceRequests: ["service-requests"] as const,
  serviceRequestLists: ["service-requests", "list"] as const,
  serviceRequestList: (params: ServiceRequestListParams) => ["service-requests", "list", params] as const,
  serviceRequest: (id: number) => ["service-requests", "detail", id] as const,

  approvals: ["approvals"] as const,
  approvalsPending: ["approvals", "pending"] as const,
  approvalsCount: ["approvals", "count"] as const,

  notifications: ["notifications"] as const,
  notificationList: ["notifications", "list"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
  publicSignature: (token: string) => ["public-signature", token] as const,
};
