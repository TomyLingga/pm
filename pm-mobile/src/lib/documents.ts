// Routing helpers for the two document kinds (work orders and Form Requests).

export type DocumentKind = 'work_order' | 'service_request';

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
 * `{ document_type, document_id }` (API_SERVICE_REQUEST §6) with fallback to
 * `work_order_id` / `service_request_id` for older payloads.
 */
export function documentRefFrom(data: Record<string, unknown> | null | undefined): DocumentRef | null {
  if (!data) return null;
  const type = data.document_type;
  const docId = toId(data.document_id);
  if (docId && (type === 'work_order' || type === 'service_request')) return { type, id: docId };
  const srId = toId(data.service_request_id);
  if (srId) return { type: 'service_request', id: srId };
  const woId = toId(data.work_order_id);
  if (woId) return { type: 'work_order', id: woId };
  return null;
}

export function documentPath(ref: DocumentRef): string {
  return ref.type === 'service_request' ? `/requests/${ref.id}` : `/work-orders/${ref.id}`;
}

/** React Query key of the document's detail. */
export function documentQueryKey(ref: DocumentRef): readonly unknown[] {
  return ref.type === 'service_request' ? ['service-request', ref.id] : ['work-order', ref.id];
}
