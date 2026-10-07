import type {
  ChecklistInputType,
  EquipmentStatus,
  FrequencyType,
  ItemResult,
  PmTaskScope,
  PmTaskStatus,
} from "@/types/pm";

/**
 * Labels for filter controls and forms (before any data is loaded). Rendered data always uses
 * the server-provided `*_label` fields.
 */
export const PM_STATUS_OPTIONS: Array<{ value: PmTaskStatus; label: string }> = [
  { value: "due", label: "JATUH TEMPO" },
  { value: "overdue", label: "TERLAMBAT" },
  { value: "in_progress", label: "DIKERJAKAN" },
  { value: "scheduled", label: "TERJADWAL" },
  { value: "completed", label: "SELESAI" },
  { value: "skipped", label: "DILEWATI" },
];

export const PM_STATUS_LABELS: Record<string, string> = {
  ...Object.fromEntries(PM_STATUS_OPTIONS.map((option) => [option.value, option.label])),
  projected: "PROYEKSI",
};

/** Statuses that need the technician's attention (default view of "Tugas PM"). */
export const PM_ACTIVE_STATUSES: PmTaskStatus[] = ["due", "overdue", "in_progress"];

export const PM_TASKS_DEFAULT_HREF = `/pm/tasks?status=${PM_ACTIVE_STATUSES.join(",")}`;

export const PM_SCOPE_LABELS: Record<PmTaskScope, string> = {
  mine: "Tugas Saya",
  unit: "Unit Saya",
  all: "Semua",
};

/** What each PM tab contains (shown under the tabs). */
export const PM_SCOPE_DESCRIPTIONS: Record<PmTaskScope, string> = {
  mine: "Tugas PM yang Anda menjadi PIC-nya, termasuk yang sudah selesai.",
  unit: "Semua tugas PM unit pelaksana Anda, siapa pun PIC-nya.",
  all: "Seluruh tugas PM di semua unit (khusus admin). Gunakan filter unit pelaksana untuk mempersempit.",
};

export interface FrequencyOption {
  value: FrequencyType;
  label: string;
  /** Unit of the interval ("jam", "minggu", ...); null when the interval is fixed. */
  unit: string | null;
  min: number;
  max: number;
}

/** Interval ranges from the contract. */
export const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { value: "hourly", label: "Per jam", unit: "jam", min: 1, max: 168 },
  { value: "daily", label: "Harian", unit: null, min: 1, max: 1 },
  { value: "weekly", label: "Mingguan", unit: "minggu", min: 1, max: 52 },
  { value: "monthly", label: "Bulanan", unit: "bulan", min: 1, max: 24 },
  { value: "yearly", label: "Tahunan", unit: "tahun", min: 1, max: 10 },
  { value: "every_n_days", label: "Setiap N hari", unit: "hari", min: 2, max: 365 },
];

export function frequencyOption(type: FrequencyType): FrequencyOption {
  return FREQUENCY_OPTIONS.find((option) => option.value === type) ?? FREQUENCY_OPTIONS[1];
}

export const INPUT_TYPE_OPTIONS: Array<{ value: ChecklistInputType; label: string }> = [
  { value: "ok_nok_na", label: "OK / Tidak OK / N/A" },
  { value: "number", label: "Angka (min-max)" },
  { value: "text", label: "Isian teks" },
];

export const INPUT_TYPE_LABELS: Record<ChecklistInputType, string> = {
  ok_nok_na: "OK / Tidak OK / N/A",
  number: "Angka",
  text: "Teks",
};

export const RESULT_LABELS: Record<ItemResult, string> = {
  ok: "OK",
  not_ok: "Tidak OK",
  na: "N/A",
};

export const EQUIPMENT_STATUS_OPTIONS: Array<{ value: EquipmentStatus; label: string }> = [
  { value: "active", label: "Aktif" },
  { value: "under_repair", label: "Dalam perbaikan" },
  { value: "inactive", label: "Tidak aktif" },
  { value: "disposed", label: "Dihapuskan" },
];

/** Upload limits from the contract. */
export const PM_MAX_GENERAL_PHOTOS = 10;
export const PM_MAX_ITEM_PHOTOS = 5;

/** Calendar endpoint accepts at most this many days per request. */
export const PM_CALENDAR_MAX_DAYS = 62;
