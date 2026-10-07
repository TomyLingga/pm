/**
 * List period (`from`/`to`) shared by the WO, Form Request and PM task lists.
 *
 * The API applies it to finished documents only (by the date they ended); documents still running are always
 * listed. The UI therefore only shows the date inputs when the status filter can contain finished documents.
 */

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Default period: the 1st of this month until today (local dates). */
export function defaultPeriod(now: Date = new Date()): { from: string; to: string } {
  return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
}

/** True when the selected statuses (comma separated, empty = all) include a finished one. */
export function periodApplies(status: string, finalStatuses: readonly string[]): boolean {
  const selected = status.split(",").filter(Boolean);
  return selected.length === 0 || selected.some((value) => finalStatuses.includes(value));
}

/** The period to send: URL values, else the default; nothing when only running statuses are selected. */
export function effectivePeriod(
  filters: { status: string; from: string; to: string },
  finalStatuses: readonly string[],
  fallback: { from: string; to: string },
): { from?: string; to?: string } {
  if (!periodApplies(filters.status, finalStatuses)) return {};
  return { from: filters.from || fallback.from, to: filters.to || fallback.to };
}

export const WO_FINAL_STATUSES = ["closed", "cancelled", "converted"] as const;
export const REQUEST_FINAL_STATUSES = ["completed", "rejected", "cancelled", "converted"] as const;
export const PM_FINAL_STATUSES = ["completed", "skipped"] as const;
