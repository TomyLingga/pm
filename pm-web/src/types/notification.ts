export interface AppNotification {
  id: string | number;
  event: string;
  title: string;
  body: string | null;
  /** `work_order` | `service_request` | `pm_task` (newer backends) */
  document_type?: string | null;
  document_id?: number | null;
  work_order_id: number | null;
  service_request_id?: number | null;
  pm_task_id?: number | null;
  alarm: boolean;
  read_at: string | null;
  created_at: string;
}
