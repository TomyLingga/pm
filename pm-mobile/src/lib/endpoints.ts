// Typed wrappers for every endpoint used by the mobile app
// (docs/API_WORK_ORDER.md, docs/API_SERVICE_REQUEST.md and docs/API_PM.md).
import { api } from './api';
import type {
  AcceptBody,
  AppNotification,
  Attachment,
  AttachmentCollection,
  CompleteBody,
  CreateWorkOrderBody,
  DataEnvelope,
  EquipmentDetail,
  EquipmentItem,
  ExecutorUnit,
  HistoryEntry,
  LabourInput,
  LocationItem,
  LoginResponse,
  LoginSuccess,
  MaterialInput,
  MaterialItem,
  Me,
  Office,
  Paginated,
  PendingApproval,
  PmCompleteBody,
  PmFindingWorkOrderBody,
  PmItemPayload,
  PmSummary,
  PmTaskDetail,
  PmTaskListItem,
  PmTaskScope,
  Priority,
  RequestExecutorUnit,
  ServiceRequestBody,
  ServiceRequestDetail,
  ServiceRequestListItem,
  ServiceRequestScope,
  StaffMember,
  SuperiorCandidate,
  WorkOrderDetail,
  WorkOrderListItem,
  WorkOrderScope,
} from './types';

// ---- Auth ----

export const authApi = {
  login: (login: string, password: string, deviceName: string) =>
    api<DataEnvelope<LoginResponse>>('/auth/mobile/login', {
      method: 'POST',
      body: { login, password, device_name: deviceName },
      skipAuthHandler: true,
    }).then((r) => r.data),

  totp: (totpToken: string, code: string, deviceName: string) =>
    api<DataEnvelope<LoginSuccess>>('/auth/mobile/totp', {
      method: 'POST',
      body: { totp_token: totpToken, code, device_name: deviceName },
      skipAuthHandler: true,
    }).then((r) => r.data),

  me: () => api<DataEnvelope<Me>>('/auth/me').then((r) => r.data),

  logout: () => api<void>('/auth/logout', { method: 'POST', skipAuthHandler: true }),
};

// ---- Push ----

export const pushApi = {
  subscribe: (token: string, deviceName: string) =>
    api<unknown>('/push-subscriptions', {
      method: 'POST',
      body: { channel: 'expo', token, device_name: deviceName },
    }),
  unsubscribe: (token: string) =>
    api<void>('/push-subscriptions', { method: 'DELETE', body: { token }, skipAuthHandler: true }),
};

// ---- Lookups ----

export const lookupApi = {
  executorUnits: () =>
    api<DataEnvelope<ExecutorUnit[]>>('/executor-units', { query: { for: 'work_order' } }).then((r) => r.data),
  requestExecutorUnits: () =>
    api<DataEnvelope<RequestExecutorUnit[]>>('/executor-units', { query: { for: 'request' } }).then((r) => r.data),
  staff: (executorUnitId: number) =>
    api<DataEnvelope<StaffMember[]>>(`/executor-units/${executorUnitId}/staff`).then((r) => r.data),
  locations: (q: string) => api<DataEnvelope<LocationItem[]>>('/locations', { query: { q } }).then((r) => r.data),
  equipment: (q: string, executorUnitId?: number | null) =>
    api<DataEnvelope<EquipmentItem[]>>('/equipment', {
      query: { q, executor_unit_id: executorUnitId ?? undefined },
    }).then((r) => r.data),
  materials: (q: string) => api<DataEnvelope<MaterialItem[]>>('/materials', { query: { q } }).then((r) => r.data),
  offices: () => api<DataEnvelope<Office[]>>('/offices').then((r) => r.data),
  superiorCandidates: (q: string) =>
    api<DataEnvelope<SuperiorCandidate[]>>('/users/superior-candidates', { query: { q } }).then((r) => r.data),
  mySuperior: () => api<DataEnvelope<SuperiorCandidate | null>>('/users/my-superior').then((r) => r.data ?? null),
};

// ---- Attachments ----

export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

/** Multipart upload of one file (`file` + extra text fields) to an attachments endpoint. */
export function uploadMultipart(path: string, file: UploadFile, fields: Record<string, string | number | null | undefined>) {
  const form = new FormData();
  // React Native's FormData accepts { uri, name, type } objects for file parts.
  form.append('file', file as unknown as Blob);
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
  }
  return api<DataEnvelope<Attachment> | undefined>(path, { method: 'POST', formData: form });
}

/** WO / Form Request attachment (`file` + `collection`). */
export function uploadAttachment(path: string, file: UploadFile, collection: AttachmentCollection) {
  return uploadMultipart(path, file, { collection });
}

export const attachmentApi = {
  remove: (attachmentId: number) => api<void>(`/attachments/${attachmentId}`, { method: 'DELETE' }),
};

// ---- Work orders ----

export interface WorkOrderListParams {
  scope: WorkOrderScope;
  status?: string;
  priority?: Priority;
  q?: string;
  page?: number;
  per_page?: number;
}

/** Response of non-transition endpoints may or may not contain the full detail. */
export type MaybeDetail = DataEnvelope<WorkOrderDetail> | DataEnvelope<unknown> | undefined;

export function isWorkOrderDetail(value: unknown): value is WorkOrderDetail {
  return (
    !!value &&
    typeof value === 'object' &&
    'id' in value &&
    'permissions' in value &&
    'status' in value
  );
}

const detail = (path: string, method: 'POST' | 'PUT', body: unknown = {}) =>
  api<DataEnvelope<WorkOrderDetail>>(path, { method, body }).then((r) => r.data);

export const workOrderApi = {
  list: (params: WorkOrderListParams) =>
    api<Paginated<WorkOrderListItem>>('/work-orders', {
      query: {
        scope: params.scope,
        status: params.status,
        priority: params.priority,
        q: params.q,
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
      },
    }),

  get: (id: number) => api<DataEnvelope<WorkOrderDetail>>(`/work-orders/${id}`).then((r) => r.data),

  create: (body: CreateWorkOrderBody) => detail('/work-orders', 'POST', body),

  cancel: (id: number, reason: string) => detail(`/work-orders/${id}/cancel`, 'POST', { reason }),
  pick: (id: number) => detail(`/work-orders/${id}/pick`, 'POST'),
  receive: (id: number, body: { assignee_ids: number[]; lead_id: number; priority?: Priority }) =>
    detail(`/work-orders/${id}/receive`, 'POST', body),
  start: (id: number) => detail(`/work-orders/${id}/start`, 'POST'),
  complete: (id: number, body: CompleteBody) => detail(`/work-orders/${id}/complete`, 'POST', body),
  accept: (id: number, body: AcceptBody) => detail(`/work-orders/${id}/accept`, 'POST', body),
  convertToRequest: (id: number, reason: string) =>
    detail(`/work-orders/${id}/convert-to-request`, 'POST', { reason }),

  // Non-transition endpoints: handle both a full detail and an empty/other payload.
  updateAssignees: (id: number, body: { assignee_ids: number[]; lead_id: number }) =>
    api<MaybeDetail>(`/work-orders/${id}/assignees`, { method: 'PUT', body }),
  updateMaterials: (id: number, materials: MaterialInput[]) =>
    api<MaybeDetail>(`/work-orders/${id}/materials`, { method: 'PUT', body: { materials } }),
  updateLabours: (id: number, labours: LabourInput[]) =>
    api<MaybeDetail>(`/work-orders/${id}/labours`, { method: 'PUT', body: { labours } }),

  uploadAttachment: (id: number, file: UploadFile, collection: AttachmentCollection) =>
    uploadAttachment(`/work-orders/${id}/attachments`, file, collection),

  deleteAttachment: (attachmentId: number) => attachmentApi.remove(attachmentId),
};

// ---- Form Request ----

export interface ServiceRequestListParams {
  scope: ServiceRequestScope;
  status?: string;
  priority?: Priority;
  q?: string;
  page?: number;
  per_page?: number;
}

const srAction = (path: string, body: unknown = {}) =>
  api<DataEnvelope<ServiceRequestDetail>>(path, { method: 'POST', body }).then((r) => r.data);

export const requestApi = {
  list: (params: ServiceRequestListParams) =>
    api<Paginated<ServiceRequestListItem>>('/service-requests', {
      query: {
        scope: params.scope,
        status: params.status,
        priority: params.priority,
        q: params.q,
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
      },
    }),

  get: (id: number) => api<DataEnvelope<ServiceRequestDetail>>(`/service-requests/${id}`).then((r) => r.data),

  create: (body: ServiceRequestBody) =>
    api<DataEnvelope<ServiceRequestDetail>>('/service-requests', { method: 'POST', body }).then((r) => r.data),
  update: (id: number, body: ServiceRequestBody) =>
    api<DataEnvelope<ServiceRequestDetail>>(`/service-requests/${id}`, { method: 'PUT', body }).then((r) => r.data),
  remove: (id: number) => api<void>(`/service-requests/${id}`, { method: 'DELETE' }),

  submit: (id: number, superiorId?: number | null) =>
    srAction(`/service-requests/${id}/submit`, superiorId ? { superior_id: superiorId } : {}),
  changeSuperior: (id: number, superiorId: number, reason?: string | null) =>
    srAction(`/service-requests/${id}/change-superior`, { superior_id: superiorId, reason: reason || undefined }),
  approve: (id: number, notes?: string | null, assignedExecutorId?: number | null) =>
    srAction(`/service-requests/${id}/approve`, {
      notes: notes || undefined,
      assigned_executor_id: assignedExecutorId ?? undefined,
    }),
  reject: (id: number, notes: string) => srAction(`/service-requests/${id}/reject`, { notes }),
  requestRevision: (id: number, notes: string) => srAction(`/service-requests/${id}/request-revision`, { notes }),
  complete: (id: number, executorNotes: string) =>
    srAction(`/service-requests/${id}/complete`, { executor_notes: executorNotes }),
  cancel: (id: number, reason: string) => srAction(`/service-requests/${id}/cancel`, { reason }),
  convertToWorkOrder: (id: number, reason: string) =>
    srAction(`/service-requests/${id}/convert-to-work-order`, { reason }),

  uploadAttachment: (id: number, file: UploadFile, collection: AttachmentCollection) =>
    uploadAttachment(`/service-requests/${id}/attachments`, file, collection),
};

// ---- Generic approvals ----

export const approvalApi = {
  pending: () => api<DataEnvelope<PendingApproval[]>>('/approvals/pending').then((r) => r.data ?? []),
  pendingCount: () =>
    api<DataEnvelope<{ count: number }>>('/approvals/pending-count').then((r) => r.data?.count ?? 0),
};

// ---- Preventive Maintenance tasks (API_PM.md §5) ----

export interface PmTaskListParams {
  scope: PmTaskScope;
  status?: string;
  q?: string;
  sort?: 'due_at' | '-due_at';
  page?: number;
  per_page?: number;
}

const pmAction = (path: string, method: 'POST' | 'PUT', body: unknown = {}) =>
  api<DataEnvelope<PmTaskDetail>>(path, { method, body }).then((r) => r.data);

export const pmTaskApi = {
  list: (params: PmTaskListParams) =>
    api<Paginated<PmTaskListItem>>('/pm-tasks', {
      query: {
        scope: params.scope,
        status: params.status,
        q: params.q,
        sort: params.sort ?? 'due_at',
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
      },
    }),

  summary: () => api<DataEnvelope<PmSummary>>('/pm-tasks/summary').then((r) => r.data),

  get: (id: number) => api<DataEnvelope<PmTaskDetail>>(`/pm-tasks/${id}`).then((r) => r.data),

  start: (id: number) => pmAction(`/pm-tasks/${id}/start`, 'POST'),
  saveItems: (id: number, items: PmItemPayload[]) => pmAction(`/pm-tasks/${id}/items`, 'PUT', { items }),
  saveMaterials: (id: number, materials: MaterialInput[]) =>
    pmAction(`/pm-tasks/${id}/materials`, 'PUT', { materials }),
  complete: (id: number, body: PmCompleteBody) => pmAction(`/pm-tasks/${id}/complete`, 'POST', body),
  proposeSkip: (id: number, reason: string) => pmAction(`/pm-tasks/${id}/propose-skip`, 'POST', { reason }),
  skip: (id: number, reason: string) => pmAction(`/pm-tasks/${id}/skip`, 'POST', { reason }),
  reassign: (id: number, picUserId: number) => pmAction(`/pm-tasks/${id}/reassign`, 'POST', { pic_user_id: picUserId }),
  createWorkOrder: (id: number, itemId: number, body: PmFindingWorkOrderBody) =>
    pmAction(`/pm-tasks/${id}/items/${itemId}/work-order`, 'POST', body),

  /** General task photo, or a per-item photo when `itemId` is given. */
  uploadAttachment: (id: number, file: UploadFile, itemId?: number | null) =>
    uploadMultipart(`/pm-tasks/${id}/attachments`, file, { item_id: itemId ?? undefined }),
};

// ---- Equipment (detail + maintenance history; CRUD stays web-only) ----

export const equipmentApi = {
  get: (id: number) => api<DataEnvelope<EquipmentDetail>>(`/equipment/${id}`).then((r) => r.data),
  history: (id: number, page: number) =>
    api<Paginated<HistoryEntry>>(`/equipment/${id}/history`, { query: { page } }),
};

// ---- Notifications ----

export const notificationApi = {
  list: (page: number, unreadOnly = false) =>
    api<Paginated<AppNotification>>('/notifications', { query: { page, unread: unreadOnly ? 1 : undefined } }),
  unreadCount: () => api<DataEnvelope<{ count: number }>>('/notifications/unread-count').then((r) => r.data.count),
  markRead: (id: number | string) => api<void>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => api<void>('/notifications/read-all', { method: 'POST' }),
};
