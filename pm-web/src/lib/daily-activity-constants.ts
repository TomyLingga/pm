import type { BadgeTone } from "@/components/ui/badge";
import type { DailyActivityScope, DailyActivityStatus } from "@/types/daily-activity";
import { nowDateTimeLocalValue } from "./format";

export const ACTIVITY_SCOPE_LABELS: Record<DailyActivityScope, string> = {
  mine: "Aktivitas Saya",
  team: "Tim Saya",
  all: "Semua",
};

/** What each tab contains (shown under the tabs). */
export const ACTIVITY_SCOPE_DESCRIPTIONS: Record<DailyActivityScope, string> = {
  mine: "Laporan aktivitas yang Anda buat atau yang dicatat atas nama Anda.",
  team: "Laporan seluruh anggota unit di bawah Anda.",
  all: "Seluruh laporan di semua unit (khusus admin).",
};

/** Labels for filter controls; rendered rows use the server's `status_label`. */
export const ACTIVITY_STATUS_OPTIONS: Array<{ value: DailyActivityStatus; label: string; description: string }> = [
  { value: "open", label: "OPEN", description: "Belum mulai" },
  { value: "on_progress", label: "ON PROGRESS", description: "Sedang dikerjakan" },
  { value: "closed", label: "CLOSED", description: "Selesai" },
];

export const ACTIVITY_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ACTIVITY_STATUS_OPTIONS.map((option) => [option.value, option.label]),
);

/** Status -> semantic tone: open = neutral (not started), on_progress = warning (running), closed = success. */
export const ACTIVITY_STATUS_TONES: Record<string, BadgeTone> = {
  open: "neutral",
  on_progress: "warning",
  closed: "success",
};

/**
 * Statuses the list period (`from`/`to`) applies to (see lib/list-period): the API narrows `closed` reports by
 * `activity_date`; `open` and `on_progress` reports are always listed.
 */
export const ACTIVITY_FINAL_STATUSES = ["closed"] as const;

/** Status filter used when the URL carries none: the reports still running. */
export const ACTIVITY_DEFAULT_STATUSES: readonly DailyActivityStatus[] = ["open", "on_progress"];

/** The status a report usually moves to next (pre-selected in the status dialog). */
export const ACTIVITY_NEXT_STATUS: Record<DailyActivityStatus, DailyActivityStatus> = {
  open: "on_progress",
  on_progress: "closed",
  closed: "on_progress",
};

/** `week_of_month`: 1 (1-7) · 2 (8-14) · 3 (15-21) · 4 (22-28) · 5 (29-31). */
export const WEEK_OPTIONS = [
  { value: "1", label: "M1", range: "1-7", start: 1, end: 7 },
  { value: "2", label: "M2", range: "8-14", start: 8, end: 14 },
  { value: "3", label: "M3", range: "15-21", start: 15, end: 21 },
  { value: "4", label: "M4", range: "22-28", start: 22, end: 28 },
  { value: "5", label: "M5", range: "29-31", start: 29, end: 31 },
] as const;

export function weekRangeLabel(week: number): string {
  return WEEK_OPTIONS.find((option) => Number(option.value) === week)?.range ?? "";
}

/** Today's date (Asia/Jakarta) as `Y-m-d`, for defaults. */
export function todayIso(): string {
  return nowDateTimeLocalValue().slice(0, 10);
}
