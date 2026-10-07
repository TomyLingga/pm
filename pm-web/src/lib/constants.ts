import type { ServiceRequestPriority, ServiceRequestScope, ServiceRequestStatus } from "@/types/service-request";
import type {
  AttachmentCollection,
  ClearanceResult,
  WorkOrderPriority,
  WorkOrderScope,
  WorkOrderStatus,
} from "@/types/work-order";

/**
 * Labels for filter controls (before any data is loaded). Rendered data always uses the
 * server-provided `*_label` fields.
 */
export const STATUS_OPTIONS: Array<{ value: WorkOrderStatus; label: string }> = [
  { value: "submitted", label: "DIAJUKAN" },
  { value: "received", label: "DITERIMA" },
  { value: "in_progress", label: "DIKERJAKAN" },
  { value: "completed", label: "SELESAI" },
  { value: "closed", label: "CLOSED" },
  { value: "cancelled", label: "DIBATALKAN" },
  { value: "converted", label: "DIALIHKAN KE FORM REQUEST" },
];

export const WO_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((option) => [option.value, option.label]),
);

export const PRIORITY_OPTIONS: Array<{ value: WorkOrderPriority; label: string; description: string }> = [
  { value: "high", label: "Tinggi", description: "Mengganggu operasional, perlu segera ditangani" },
  { value: "medium", label: "Menengah", description: "Perlu ditangani dalam waktu dekat" },
  { value: "low", label: "Rendah", description: "Bisa dijadwalkan, tidak mendesak" },
];

export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  high: "Tinggi",
  medium: "Menengah",
  low: "Rendah",
};

export const CLEARANCE_OPTIONS: Array<{ value: ClearanceResult; label: string }> = [
  { value: "ok", label: "OK" },
  { value: "not_ok", label: "TDK" },
];

export const CLEARANCE_LABELS: Record<ClearanceResult, string> = { ok: "OK", not_ok: "TDK" };

/** Fallback labels from form FM-BOPS-10/05 when the detail has no clearance rows yet. */
export const DEFAULT_CLEARANCE_ITEMS = [
  { item_no: 1, item_label: "Area bersih" },
  { item_no: 2, item_label: "Tidak ada tools/material tertinggal" },
];

export const SCOPE_LABELS: Record<WorkOrderScope, string> = {
  mine: "WO Saya",
  unit: "Unit Saya",
  pool: "Pool",
  assigned: "Ditugaskan ke Saya",
  executor: "Unit Pelaksana",
  all: "Semua",
};

/** What each WO tab contains (shown under the tabs). */
export const SCOPE_DESCRIPTIONS: Record<WorkOrderScope, string> = {
  mine: "Work Order yang Anda ajukan sendiri, ke unit pelaksana mana pun.",
  unit: "Work Order yang diajukan rekan satu unit organisasi Anda (hanya lihat).",
  pool: "WO baru ke unit pelaksana Anda yang belum diambil teknisi atau ditugaskan pimpinan.",
  assigned: "WO yang ditugaskan kepada Anda atau Anda ambil sendiri, dari diterima sampai closed.",
  executor: "Semua WO yang masuk ke unit pelaksana Anda, apa pun status dan teknisinya.",
  all: "Seluruh WO di semua unit (khusus admin). Gunakan filter unit pelaksana untuk mempersempit.",
};

export const ATTACHMENT_COLLECTION_LABELS: Record<AttachmentCollection, string> = {
  photo_before: "Foto Sebelum",
  photo_after: "Foto Sesudah",
  document: "Dokumen",
};

export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ATTACHMENT_MIME_TYPES = [...PHOTO_MIME_TYPES, "application/pdf"];

/* ---------- Form Request (Modul B) ---------- */

export const SR_STATUS_OPTIONS: Array<{ value: ServiceRequestStatus; label: string }> = [
  { value: "draft", label: "DRAFT" },
  { value: "waiting_superior", label: "MENUNGGU ATASAN" },
  { value: "waiting_executor", label: "MENUNGGU_DIVISI" },
  { value: "in_progress", label: "DIPROSES" },
  { value: "completed", label: "SELESAI" },
  { value: "rejected", label: "DITOLAK" },
  { value: "cancelled", label: "DIBATALKAN" },
  { value: "converted", label: "DIALIHKAN KE WO" },
];

export const SR_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  SR_STATUS_OPTIONS.map((option) => [option.value, option.label]),
);

/** Form Request uses "Sedang" for `medium`. */
export const SR_PRIORITY_OPTIONS: Array<{ value: ServiceRequestPriority; label: string; description: string }> = [
  { value: "high", label: "Tinggi", description: "Mendesak, mengganggu pekerjaan" },
  { value: "medium", label: "Sedang", description: "Dibutuhkan dalam waktu dekat" },
  { value: "low", label: "Rendah", description: "Tidak mendesak" },
];

export const SR_SCOPE_LABELS: Record<ServiceRequestScope, string> = {
  mine: "Request Saya",
  unit: "Unit Saya",
  executor: "Unit Pelaksana",
  all: "Semua",
};

/** What each Form Request tab contains (shown under the tabs). */
export const SR_SCOPE_DESCRIPTIONS: Record<ServiceRequestScope, string> = {
  mine: "Form Request yang Anda buat, termasuk draft yang belum diajukan.",
  unit: "Form Request yang diajukan rekan satu unit organisasi Anda (hanya lihat).",
  executor: "Form Request yang ditujukan ke unit pelaksana Anda dan sudah diajukan pemohon.",
  all: "Seluruh Form Request di semua unit (khusus admin). Gunakan filter unit pelaksana untuk mempersempit.",
};

/** Row labels of the PENGESAHAN block (form INLHO/BSIS-ITC/F-004). */
export const APPROVAL_ROLE_LABELS: Record<string, string> = {
  submission: "YANG BERSANGKUTAN",
  superior: "ATASAN YBS",
  executor_lead: "MGR/SPV DIVISI",
  executor: "FOREMAN DIVISI",
};

export const SR_ATTACHMENT_COLLECTION_LABELS: Partial<Record<AttachmentCollection, string>> = {
  document: "Dokumen",
  photo_before: "Foto",
};
