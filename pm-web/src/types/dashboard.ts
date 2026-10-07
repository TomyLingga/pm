import type { PmTaskListItem } from "./pm";
import type { ServiceRequestListItem } from "./service-request";
import type { WorkOrderListItem } from "./work-order";

import type { UserBrief } from "./auth";

export type DashboardScope = "mine" | "unit" | "all";

export type DashboardBucket = "week" | "month";

export interface DashboardPeriod {
  from: string;
  to: string;
  /** week when the period is <= 92 days, otherwise month */
  bucket: DashboardBucket;
}

export interface DashboardKpi {
  /** Not closed/cancelled/converted right now (snapshot) */
  wo_open: number;
  wo_created: number;
  wo_closed: number;
  /** Status completed, waiting for the user's acceptance (snapshot) */
  wo_awaiting_acceptance: number;
  requests_pending_approval: number;
  /** Approval steps I can act on (same as /approvals/pending-count) */
  requests_waiting_me: number;
  pm_due: number;
  pm_overdue: number;
  pm_in_progress: number;
  pm_compliance_pct: number | null;
  wo_avg_response_minutes: number | null;
  wo_avg_completion_minutes: number | null;
  wo_median_completion_minutes: number | null;
  wo_rework_count: number;
}

export interface StatusCount {
  status: string;
  status_label: string;
  count: number;
}

export interface PriorityCount {
  priority: string;
  priority_label: string;
  count: number;
}

export interface CategoryCount {
  id: number;
  name: string;
  count: number;
}

export interface WoTrendPoint {
  period: string;
  label: string;
  created: number;
  closed: number;
}

export interface SlaByPriority {
  priority: string;
  priority_label: string;
  avg_response_minutes: number | null;
  avg_completion_minutes: number | null;
  count: number;
}

export interface StepCount {
  key: string;
  label: string;
  count: number;
}

export interface PmCompliance {
  on_time: number;
  late: number;
  skipped: number;
  open_overdue: number;
  total: number;
  pct_on_time: number | null;
}

export interface PmTrendPoint {
  period: string;
  label: string;
  on_time: number;
  late: number;
  skipped: number;
}

export interface DashboardEquipmentRef {
  id: number;
  code: string | null;
  name: string;
}

export interface EquipmentBreakdown {
  equipment: DashboardEquipmentRef;
  hours: number;
  work_orders: number;
}

export interface EquipmentFailure {
  equipment: DashboardEquipmentRef;
  work_orders: number;
  last_issued_at: string | null;
}

export interface TechnicianWorkload {
  user: UserBrief;
  wo_active: number;
  wo_completed: number;
  pm_open: number;
  pm_completed: number;
  labour_minutes: number;
}

export interface PmUpcoming {
  id: number;
  number: string;
  due_at: string;
  status: string;
  status_label: string;
  equipment: DashboardEquipmentRef;
  schedule_name: string | null;
  pic: UserBrief | null;
}

/** `GET /dashboard` */
export interface Dashboard {
  scope: DashboardScope;
  available_scopes: DashboardScope[];
  period: DashboardPeriod;
  kpi: DashboardKpi;
  wo_by_status: StatusCount[];
  wo_by_priority: PriorityCount[];
  wo_by_category: CategoryCount[];
  wo_trend: WoTrendPoint[];
  wo_sla_by_priority: SlaByPriority[];
  requests_by_status: StatusCount[];
  requests_pending_by_step: StepCount[];
  pm_compliance: PmCompliance | null;
  pm_trend: PmTrendPoint[];
  equipment_breakdown_hours: EquipmentBreakdown[];
  equipment_top_failures: EquipmentFailure[];
  technician_workload: TechnicianWorkload[];
  pm_upcoming: PmUpcoming[];
}

export interface DashboardParams {
  /** Omitted = server default by role */
  scope?: DashboardScope;
  from?: string;
  to?: string;
  executor_unit_id?: string;
  location_id?: string;
  service_category_id?: string;
}

/** `GET /dashboard/live` — what needs attention right now (polled every 30 s). */
export interface LiveBoard {
  scope: DashboardScope;
  available_scopes: DashboardScope[];
  generated_at: string;
  /** Scheduled PM tasks due within this many hours are listed as upcoming. */
  upcoming_hours: number;
  work_orders: { total: number; submitted: number; items: WorkOrderListItem[] };
  requests: { total: number; items: ServiceRequestListItem[] };
  pm: { overdue: number; due: number; in_progress: number; upcoming: number; items: PmTaskListItem[] };
}

/** `GET/PUT /notifications/preferences` */
export interface NotificationPreferences {
  email: boolean;
  /** Email channel enabled on the server and the user has an email address */
  email_available: boolean;
}
