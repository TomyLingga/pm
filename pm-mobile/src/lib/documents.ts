// Routing helpers for the document kinds (work orders, Form Requests, PM tasks and work programmes).

export type DocumentKind = 'work_order' | 'service_request' | 'pm_task' | 'work_program';

export interface DocumentRef {
  type: DocumentKind;
  id: number;
}

const toId = (raw: unknown): number | null => {
  const id = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
};

/**
 * Resolves the target document from a push `data` payload or an in-app notification item:
 * `{ document_type, document_id }` (API_SERVICE_REQUEST §6, API_PM §7, API_PROGRAM_ACTIVITY §2) with
 * fallback to `work_program_id` / `pm_task_id` / `service_request_id` / `work_order_id` for payloads without a type.
 */
export function documentRefFrom(data: Record<string, unknown> | null | undefined): DocumentRef | null {
  if (!data) return null;
  const type = data.document_type;
  const docId = toId(data.document_id);
  if (
    docId &&
    (type === 'work_order' || type === 'service_request' || type === 'pm_task' || type === 'work_program')
  ) {
    return { type, id: docId };
  }
  const programId = toId(data.work_program_id);
  if (programId) return { type: 'work_program', id: programId };
  const pmId = toId(data.pm_task_id);
  if (pmId) return { type: 'pm_task', id: pmId };
  const srId = toId(data.service_request_id);
  if (srId) return { type: 'service_request', id: srId };
  const woId = toId(data.work_order_id);
  if (woId) return { type: 'work_order', id: woId };
  return null;
}

export function documentPath(ref: DocumentRef): string {
  if (ref.type === 'work_program') return `/programs/${ref.id}`;
  if (ref.type === 'pm_task') return `/pm-tasks/${ref.id}`;
  return ref.type === 'service_request' ? `/requests/${ref.id}` : `/work-orders/${ref.id}`;
}

/** React Query key of the document's detail. */
export function documentQueryKey(ref: DocumentRef): readonly unknown[] {
  if (ref.type === 'work_program') return ['work-program', ref.id];
  if (ref.type === 'pm_task') return ['pm-task', ref.id];
  return ref.type === 'service_request' ? ['service-request', ref.id] : ['work-order', ref.id];
}
