import type { AccessListParams } from "@/types/access";
import type { DashboardParams, DashboardScope } from "@/types/dashboard";
import type { ExecutorUnitPurpose } from "@/types/lookups";
import type {
  CalendarParams,
  ChecklistTemplateListParams,
  EquipmentListParams,
  PmScheduleListParams,
  PmSchedulePreviewPayload,
  PmTaskListParams,
} from "@/types/pm";
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
  notificationPreferences: ["notification-preferences"] as const,
  categorySections: ["service-categories", "sections"] as const,
  accessUsers: (params?: AccessListParams) => (params ? (["access-users", params] as const) : (["access-users"] as const)),
  dashboard: (params: DashboardParams) => ["dashboard", params] as const,
  liveBoard: (scope?: DashboardScope) => ["dashboard", "live", scope ?? "default"] as const,
  publicSignature: (token: string) => ["public-signature", token] as const,

  /* ---------- Preventive Maintenance ---------- */
  /** Prefix of every equipment query (lookups, list, detail, history). */
  equipmentAll: ["equipment"] as const,
  equipmentList: (params: EquipmentListParams) => ["equipment", "list", params] as const,
  equipmentDetail: (id: number) => ["equipment", "detail", id] as const,
  equipmentHistory: (id: number) => ["equipment", "history", id] as const,
  equipmentItems: (q: string, executorUnitId: number | null) => ["equipment", "items", executorUnitId, q] as const,

  checklistTemplates: ["checklist-templates"] as const,
  checklistTemplateList: (params: ChecklistTemplateListParams) => ["checklist-templates", "list", params] as const,
  checklistTemplate: (id: number) => ["checklist-templates", "detail", id] as const,

  pmSchedules: ["pm-schedules"] as const,
  pmScheduleLists: ["pm-schedules", "list"] as const,
  pmScheduleList: (params: PmScheduleListParams) => ["pm-schedules", "list", params] as const,
  pmSchedule: (id: number) => ["pm-schedules", "detail", id] as const,
  pmSchedulePreview: (payload: PmSchedulePreviewPayload) => ["pm-schedules", "preview", payload] as const,

  pmTasks: ["pm-tasks"] as const,
  pmTaskLists: ["pm-tasks", "list"] as const,
  pmTaskList: (params: PmTaskListParams) => ["pm-tasks", "list", params] as const,
  pmTask: (id: number) => ["pm-tasks", "detail", id] as const,
  pmTaskSummary: ["pm-tasks", "summary"] as const,
  pmCalendars: ["pm-tasks", "calendar"] as const,
  pmCalendar: (params: CalendarParams) => ["pm-tasks", "calendar", params] as const,
};
