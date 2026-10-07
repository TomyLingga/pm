import type {
  ApprovalStepStatus,
  DailyActivityStatus,
  PmItemResult,
  PmTaskStatus,
  Priority,
  ProgramActivityStatus,
  ServiceRequestStatus,
  WorkOrderStatus,
  WorkProgramStatus,
} from './types';

export const colors = {
  primary: '#1E3A8A',
  primaryPressed: '#172F70',
  primarySoft: '#E0E7FF',
  bg: '#F1F5F9',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#64748B',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  white: '#FFFFFF',
  overlay: 'rgba(15, 23, 42, 0.55)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Minimum touch target (gloved / field use). */
export const TOUCH = 52;

export interface Tone {
  fg: string;
  bg: string;
  border: string;
}

// submitted=slate, received=blue, in_progress=amber, completed=violet, closed=green, cancelled=red
export const statusTones: Record<WorkOrderStatus, Tone> = {
  submitted: { fg: '#334155', bg: '#F1F5F9', border: '#94A3B8' },
  received: { fg: '#1D4ED8', bg: '#DBEAFE', border: '#60A5FA' },
  in_progress: { fg: '#B45309', bg: '#FEF3C7', border: '#F59E0B' },
  completed: { fg: '#6D28D9', bg: '#EDE9FE', border: '#A78BFA' },
  closed: { fg: '#15803D', bg: '#DCFCE7', border: '#4ADE80' },
  cancelled: { fg: '#B91C1C', bg: '#FEE2E2', border: '#F87171' },
  converted: { fg: '#0F766E', bg: '#CCFBF1', border: '#2DD4BF' },
};

// Form Request statuses: draft=slate, waiting=blue/indigo, in_progress=amber, completed=green,
// rejected/cancelled=red, converted=teal.
export const requestStatusTones: Record<ServiceRequestStatus, Tone> = {
  draft: { fg: '#334155', bg: '#F1F5F9', border: '#94A3B8' },
  waiting_superior: { fg: '#1D4ED8', bg: '#DBEAFE', border: '#60A5FA' },
  waiting_executor: { fg: '#4338CA', bg: '#E0E7FF', border: '#818CF8' },
  in_progress: { fg: '#B45309', bg: '#FEF3C7', border: '#F59E0B' },
  completed: { fg: '#15803D', bg: '#DCFCE7', border: '#4ADE80' },
  rejected: { fg: '#B91C1C', bg: '#FEE2E2', border: '#F87171' },
  cancelled: { fg: '#B91C1C', bg: '#FEE2E2', border: '#F87171' },
  converted: { fg: '#0F766E', bg: '#CCFBF1', border: '#2DD4BF' },
};

export const stepStatusTones: Record<ApprovalStepStatus, Tone> = {
  waiting: { fg: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
  pending: { fg: '#B45309', bg: '#FEF3C7', border: '#F59E0B' },
  approved: { fg: '#15803D', bg: '#DCFCE7', border: '#4ADE80' },
  completed: { fg: '#15803D', bg: '#DCFCE7', border: '#4ADE80' },
  rejected: { fg: '#B91C1C', bg: '#FEE2E2', border: '#F87171' },
  revision_requested: { fg: '#C2410C', bg: '#FFEDD5', border: '#FB923C' },
  skipped: { fg: '#64748B', bg: '#F8FAFC', border: '#CBD5E1' },
  cancelled: { fg: '#64748B', bg: '#F8FAFC', border: '#CBD5E1' },
};

// PM task: scheduled=slate, due=amber, in_progress=blue, completed=green, overdue=red, skipped=gray
export const pmStatusTones: Record<PmTaskStatus, Tone> = {
  scheduled: { fg: '#334155', bg: '#F1F5F9', border: '#94A3B8' },
  due: { fg: '#B45309', bg: '#FEF3C7', border: '#F59E0B' },
  in_progress: { fg: '#1D4ED8', bg: '#DBEAFE', border: '#60A5FA' },
  completed: { fg: '#15803D', bg: '#DCFCE7', border: '#4ADE80' },
  overdue: { fg: '#B91C1C', bg: '#FEE2E2', border: '#F87171' },
  skipped: { fg: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
};

// Checklist result: ok=green, not_ok=red, na=gray
export const resultTones: Record<PmItemResult, Tone> = {
  ok: { fg: '#15803D', bg: '#DCFCE7', border: '#4ADE80' },
  not_ok: { fg: '#B91C1C', bg: '#FEE2E2', border: '#F87171' },
  na: { fg: '#475569', bg: '#F1F5F9', border: '#94A3B8' },
};

// Programme activity / daily activity: open=blue, on_progress=amber, closed=green, cancelled=gray
export const activityStatusTones: Record<ProgramActivityStatus, Tone> = {
  open: { fg: '#1D4ED8', bg: '#DBEAFE', border: '#60A5FA' },
  on_progress: { fg: '#B45309', bg: '#FEF3C7', border: '#F59E0B' },
  closed: { fg: '#15803D', bg: '#DCFCE7', border: '#4ADE80' },
  cancelled: { fg: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
};

// Programme: active=green, closed=gray
export const programStatusTones: Record<WorkProgramStatus, Tone> = {
  active: { fg: '#15803D', bg: '#DCFCE7', border: '#4ADE80' },
  closed: { fg: '#475569', bg: '#F1F5F9', border: '#94A3B8' },
};

// high=red, medium=amber, low=gray
export const priorityTones: Record<Priority, Tone> = {
  high: { fg: '#B91C1C', bg: '#FEE2E2', border: '#F87171' },
  medium: { fg: '#B45309', bg: '#FEF3C7', border: '#F59E0B' },
  low: { fg: '#475569', bg: '#F1F5F9', border: '#94A3B8' },
};

const fallbackTone: Tone = { fg: '#334155', bg: '#F1F5F9', border: '#94A3B8' };

export function statusTone(status: string): Tone {
  return (statusTones as Record<string, Tone>)[status] ?? fallbackTone;
}

export function requestStatusTone(status: string): Tone {
  return (requestStatusTones as Record<string, Tone>)[status] ?? fallbackTone;
}

export function stepStatusTone(status: string): Tone {
  return (stepStatusTones as Record<string, Tone>)[status] ?? fallbackTone;
}

export function pmStatusTone(status: string): Tone {
  return (pmStatusTones as Record<string, Tone>)[status] ?? fallbackTone;
}

export function priorityTone(priority: string): Tone {
  return (priorityTones as Record<string, Tone>)[priority] ?? fallbackTone;
}

export function activityStatusTone(status: string | null | undefined): Tone {
  return (activityStatusTones as Record<string, Tone>)[status ?? ''] ?? fallbackTone;
}

export function programStatusTone(status: string | null | undefined): Tone {
  return (programStatusTones as Record<string, Tone>)[status ?? ''] ?? fallbackTone;
}

// Labels used only for client-side controls (filters, pickers). Display of
// existing records always uses the server-provided `*_label`.
export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  submitted: 'Diajukan',
  received: 'Diterima',
  in_progress: 'Dikerjakan',
  completed: 'Selesai',
  closed: 'Closed',
  cancelled: 'Dibatalkan',
  converted: 'Dialihkan',
};

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'high', label: 'Tinggi' },
  { value: 'medium', label: 'Menengah' },
  { value: 'low', label: 'Rendah' },
];

/** Form Request uses "Sedang" for medium (API_SERVICE_REQUEST.md §1). */
export const REQUEST_PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'high', label: 'Tinggi' },
  { value: 'medium', label: 'Sedang' },
  { value: 'low', label: 'Rendah' },
];

/** Daily activity statuses (API_PROGRAM_ACTIVITY.md §1); labels follow the server's `status_label`. */
export const DAILY_ACTIVITY_STATUS_OPTIONS: { value: DailyActivityStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'on_progress', label: 'On Progress' },
  { value: 'closed', label: 'Closed' },
];

/** Programme activity statuses (API_PROGRAM_ACTIVITY.md §1). */
export const PROGRAM_ACTIVITY_STATUS_OPTIONS: { value: ProgramActivityStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'on_progress', label: 'On Progress' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Dibatalkan' },
];
