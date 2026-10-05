import { formatDistanceToNowStrict } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

export const APP_TIME_ZONE = "Asia/Jakarta";
/** Asia/Jakarta has no DST, so the offset is constant. */
const JAKARTA_OFFSET = "+07:00";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatJakarta(value: string | Date | null | undefined, pattern: string, fallback = "-"): string {
  const date = toDate(value);
  if (!date) return fallback;
  return formatInTimeZone(date, APP_TIME_ZONE, pattern, { locale: localeId });
}

/** "5 Okt 2026 08:15" */
export function formatDateTime(value: string | Date | null | undefined, fallback = "-"): string {
  return formatJakarta(value, "d MMM yyyy HH:mm", fallback);
}

/** "5 Okt 2026" */
export function formatDate(value: string | Date | null | undefined, fallback = "-"): string {
  return formatJakarta(value, "d MMM yyyy", fallback);
}

/** "26 Agustus 2026 08:15" (PENGESAHAN block, like the paper form) */
export function formatDateTimeMedium(value: string | Date | null | undefined, fallback = "-"): string {
  return formatJakarta(value, "d MMMM yyyy HH:mm", fallback);
}

/** "Senin, 5 Oktober 2026 08:15 WIB" */
export function formatDateTimeLong(value: string | Date | null | undefined, fallback = "-"): string {
  const formatted = formatJakarta(value, "EEEE, d MMMM yyyy HH:mm", "");
  return formatted ? `${formatted} WIB` : fallback;
}

/** "5 menit yang lalu" */
export function formatRelative(value: string | Date | null | undefined, fallback = "-"): string {
  const date = toDate(value);
  if (!date) return fallback;
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: localeId });
}

/** 95 -> "1 jam 35 menit"; 1500 -> "1 hari 1 jam" */
export function formatMinutes(minutes: number | null | undefined, fallback = "-"): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return fallback;
  const total = Math.max(0, Math.round(minutes));
  if (total === 0) return "0 menit";
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} hari`);
  if (hours) parts.push(`${hours} jam`);
  if (mins && !days) parts.push(`${mins} menit`);
  return parts.join(" ") || "0 menit";
}

/** ISO string -> value for `<input type="datetime-local">`, expressed in Asia/Jakarta. */
export function toDateTimeLocalValue(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  return formatInTimeZone(date, APP_TIME_ZONE, "yyyy-MM-dd'T'HH:mm");
}

/** `datetime-local` value (interpreted as Asia/Jakarta) -> ISO-8601 with +07:00. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  return `${value.slice(0, 16)}:00${JAKARTA_OFFSET}`;
}

/** Minutes between two `datetime-local` values, or null when incomplete. */
export function minutesBetweenLocal(start: string, finish: string): number | null {
  const s = fromDateTimeLocalValue(start);
  const f = fromDateTimeLocalValue(finish);
  if (!s || !f) return null;
  return Math.round((new Date(f).getTime() - new Date(s).getTime()) / 60000);
}

/** Current Asia/Jakarta time as a `datetime-local` value. */
export function nowDateTimeLocalValue(): string {
  return formatInTimeZone(new Date(), APP_TIME_ZONE, "yyyy-MM-dd'T'HH:mm");
}
