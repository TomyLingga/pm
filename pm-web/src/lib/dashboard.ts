import { addDays, format, parseISO, startOfMonth, subDays, subMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { ApiEnvelope } from "@/types/api";
import type { Dashboard, DashboardParams, DashboardScope, LiveBoard } from "@/types/dashboard";
import { api, unwrap } from "./api";
import { APP_TIME_ZONE } from "./format";

export function getLiveBoard(scope: DashboardScope | undefined, signal?: AbortSignal): Promise<LiveBoard> {
  return unwrap(api.get<ApiEnvelope<LiveBoard>>("/dashboard/live", scope ? { scope } : undefined, { signal }));
}

export function getDashboard(params: DashboardParams, signal?: AbortSignal): Promise<Dashboard> {
  return unwrap(api.get<ApiEnvelope<Dashboard>>("/dashboard", params, { signal }));
}

/* ---------- Period presets ---------- */

export type PeriodPreset = "7d" | "30d" | "month" | "3m" | "custom";

export const PERIOD_PRESETS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
  { value: "month", label: "Bulan ini" },
  { value: "3m", label: "3 bulan" },
  { value: "custom", label: "Kustom" },
];

export const DEFAULT_PRESET: PeriodPreset = "30d";

/** The API accepts at most 366 days. */
export const MAX_PERIOD_DAYS = 366;

const DAY = "yyyy-MM-dd";

export function isPeriodPreset(value: string | null | undefined): value is PeriodPreset {
  return PERIOD_PRESETS.some((preset) => preset.value === value);
}

export function isDayString(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISO(value).getTime());
}

/**
 * `from` / `to` (YYYY-MM-DD, Asia/Jakarta) for a preset. Custom presets return the given dates,
 * falling back to the last 30 days when they are missing or invalid.
 */
export function presetRange(preset: PeriodPreset, custom?: { from?: string; to?: string }): { from: string; to: string } {
  const todayKey = formatInTimeZone(new Date(), APP_TIME_ZONE, DAY);
  const today = parseISO(todayKey);
  switch (preset) {
    case "7d":
      return { from: format(subDays(today, 6), DAY), to: todayKey };
    case "month":
      return { from: format(startOfMonth(today), DAY), to: todayKey };
    case "3m":
      return { from: format(addDays(subMonths(today, 3), 1), DAY), to: todayKey };
    case "custom": {
      if (isDayString(custom?.from) && isDayString(custom?.to) && custom.from <= custom.to) {
        return { from: custom.from, to: custom.to };
      }
      return { from: format(subDays(today, 29), DAY), to: todayKey };
    }
    case "30d":
    default:
      return { from: format(subDays(today, 29), DAY), to: todayKey };
  }
}

/** Number of calendar days in an inclusive range. */
export function rangeDays(from: string, to: string): number {
  const start = parseISO(from).getTime();
  const end = parseISO(to).getTime();
  return Math.round((end - start) / 86400000) + 1;
}

/** 95 -> "1 j 35 m" (compact, for KPI tiles). */
export function formatMinutesShort(minutes: number | null | undefined, fallback = "-"): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return fallback;
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} mnt`;
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    return restHours ? `${days} hr ${restHours} j` : `${days} hr`;
  }
  return mins ? `${hours} j ${mins} mnt` : `${hours} jam`;
}

/** 12.5 -> "12,5 jam" */
export function formatHours(hours: number | null | undefined, fallback = "-"): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return fallback;
  return `${hours.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`;
}

/** 87.5 -> "87,5%" */
export function formatPercent(value: number | null | undefined, fallback = "-"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}
