import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/lib/format";
import type { CalendarEvent } from "@/types/pm";

export type CalendarViewMode = "month" | "week";

/** Weeks start on Monday (Indonesian convention). */
const WEEK = { weekStartsOn: 1 as const };

export const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/**
 * Calendar days are handled as plain dates ("yyyy-MM-dd" keys, local-midnight Date objects used
 * only for day arithmetic). Events are mapped to a day by their Asia/Jakarta date.
 */
export const dayKey = (date: Date): string => format(date, "yyyy-MM-dd");

export const parseDayKey = (key: string): Date => parseISO(key);

export function isValidDayKey(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
}

/** Today in Asia/Jakarta. */
export function todayKey(): string {
  return formatInTimeZone(new Date(), APP_TIME_ZONE, "yyyy-MM-dd");
}

export function eventDayKey(event: Pick<CalendarEvent, "due_at">): string {
  return formatInTimeZone(new Date(event.due_at), APP_TIME_ZONE, "yyyy-MM-dd");
}

export function eventTime(event: Pick<CalendarEvent, "due_at">): string {
  return formatInTimeZone(new Date(event.due_at), APP_TIME_ZONE, "HH:mm");
}

export interface VisibleRange {
  /** First and last visible day (keys), sent to the API as `start` / `end`. */
  startKey: string;
  endKey: string;
  days: Date[];
}

/** Month view = whole weeks covering the month (max 42 days); week view = 7 days. */
export function visibleRange(mode: CalendarViewMode, anchorKey: string): VisibleRange {
  const anchor = parseDayKey(anchorKey);
  const start = mode === "week" ? startOfWeek(anchor, WEEK) : startOfWeek(startOfMonth(anchor), WEEK);
  const end = mode === "week" ? endOfWeek(anchor, WEEK) : endOfWeek(endOfMonth(anchor), WEEK);
  return { startKey: dayKey(start), endKey: dayKey(end), days: eachDayOfInterval({ start, end }) };
}

export function shiftAnchor(mode: CalendarViewMode, anchorKey: string, direction: 1 | -1): string {
  const anchor = parseDayKey(anchorKey);
  return dayKey(mode === "week" ? addWeeks(anchor, direction) : addMonths(startOfMonth(anchor), direction));
}

/** "Oktober 2026" or "5 - 11 Okt 2026". */
export function rangeTitle(mode: CalendarViewMode, anchorKey: string): string {
  const anchor = parseDayKey(anchorKey);
  if (mode === "month") return format(anchor, "MMMM yyyy", { locale: localeId });
  const start = startOfWeek(anchor, WEEK);
  const end = endOfWeek(anchor, WEEK);
  const sameMonth = start.getMonth() === end.getMonth();
  return `${format(start, sameMonth ? "d" : "d MMM", { locale: localeId })} – ${format(end, "d MMM yyyy", {
    locale: localeId,
  })}`;
}

/** "Senin, 5 Oktober 2026" */
export function dayTitle(key: string): string {
  return format(parseDayKey(key), "EEEE, d MMMM yyyy", { locale: localeId });
}

/** Events grouped by Jakarta day, each day sorted by time. */
export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  const sorted = [...events].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  for (const event of sorted) {
    const key = eventDayKey(event);
    const list = map.get(key);
    if (list) list.push(event);
    else map.set(key, [event]);
  }
  return map;
}

export function eventHref(event: CalendarEvent): string {
  return event.task_id ? `/pm/tasks/${event.task_id}` : `/pm/schedules/${event.schedule_id}`;
}
