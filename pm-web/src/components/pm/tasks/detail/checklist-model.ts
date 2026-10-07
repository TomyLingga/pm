import { formatNumber } from "@/lib/utils";
import type { ChecklistItemDef, ItemResult, PmTaskItem, PmTaskItemInput } from "@/types/pm";

/** Local (editable) answer of one checklist item. Inputs are kept as raw strings. */
export interface ItemAnswer {
  /**
   * `ok_nok_na`: the chosen result. `number` / `text`: only "na" (marked not applicable) or
   * null, because the server derives ok / not_ok from the value.
   */
  result: ItemResult | null;
  valueNumber: string;
  valueText: string;
  notes: string;
}

type ItemLimits = Pick<ChecklistItemDef, "min_value" | "max_value" | "unit">;

function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function answerFromItem(item: PmTaskItem): ItemAnswer {
  const number = toNumberOrNull(item.value_number);
  return {
    result: item.input_type === "ok_nok_na" ? item.result : item.result === "na" ? "na" : null,
    valueNumber: number === null ? "" : String(number),
    valueText: item.value_text ?? "",
    notes: item.notes ?? "",
  };
}

/**
 * Parses a typed number ("385,5" or "385.5"). Returns null for an empty input and
 * undefined when the text is not a valid number.
 */
export function parseNumberInput(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

/** "in" / "out" of the min-max range, or null when there is no (valid) value. */
export function rangeState(item: ItemLimits, value: number | null | undefined): "in" | "out" | null {
  if (value === null || value === undefined) return null;
  const min = toNumberOrNull(item.min_value);
  const max = toNumberOrNull(item.max_value);
  if (min !== null && value < min) return "out";
  if (max !== null && value > max) return "out";
  return "in";
}

/** "Rentang 370 - 400 V", "Min. 370 V", "Maks. 400 V" or null when there are no limits. */
export function rangeHint(item: ItemLimits): string | null {
  const min = toNumberOrNull(item.min_value);
  const max = toNumberOrNull(item.max_value);
  const unit = item.unit ? ` ${item.unit}` : "";
  if (min !== null && max !== null) return `Rentang ${formatNumber(min, 4)} – ${formatNumber(max, 4)}${unit}`;
  if (min !== null) return `Min. ${formatNumber(min, 4)}${unit}`;
  if (max !== null) return `Maks. ${formatNumber(max, 4)}${unit}`;
  return null;
}

/**
 * Result as the UI presents it right now. For `number` / `text` this is a local estimate
 * that mirrors the server rule (the server has the final say when the answer is saved).
 */
export function effectiveResult(item: PmTaskItem, answer: ItemAnswer): ItemResult | null {
  if (answer.result === "na") return "na";
  switch (item.input_type) {
    case "ok_nok_na":
      return answer.result;
    case "number": {
      const state = rangeState(item, parseNumberInput(answer.valueNumber));
      return state === "in" ? "ok" : state === "out" ? "not_ok" : null;
    }
    case "text":
      return answer.valueText.trim() ? "ok" : null;
    default:
      return null;
  }
}

export function isAnswered(item: PmTaskItem, answer: ItemAnswer): boolean {
  return effectiveResult(item, answer) !== null;
}

/** True when a number item holds text that cannot be parsed (and is not marked N/A). */
export function hasInvalidNumber(item: PmTaskItem, answer: ItemAnswer): boolean {
  return item.input_type === "number" && answer.result !== "na" && parseNumberInput(answer.valueNumber) === undefined;
}

/**
 * Payload entry for `PUT /pm-tasks/{id}/items`. Returns null when the answer cannot be sent yet
 * (invalid number). `result` is only sent when the client decides it (ok_nok_na, or N/A).
 */
export function toItemInput(item: PmTaskItem, answer: ItemAnswer): PmTaskItemInput | null {
  const notes = answer.notes.trim() || null;
  if (answer.result === "na") {
    return { id: item.id, result: "na", value_number: null, value_text: null, notes };
  }
  switch (item.input_type) {
    case "number": {
      const value = parseNumberInput(answer.valueNumber);
      if (value === undefined) return null;
      return { id: item.id, value_number: value, notes };
    }
    case "text":
      return { id: item.id, value_text: answer.valueText.trim() || null, notes };
    case "ok_nok_na":
    default:
      return answer.result ? { id: item.id, result: answer.result, notes } : { id: item.id, notes };
  }
}

/** Human-readable saved value of an item ("385,5 V", free text, or "-"). */
export function itemValueText(item: PmTaskItem): string {
  if (item.input_type === "number") {
    const number = toNumberOrNull(item.value_number);
    return number === null ? "-" : `${formatNumber(number, 4)}${item.unit ? ` ${item.unit}` : ""}`;
  }
  if (item.input_type === "text") return item.value_text || "-";
  return "";
}

export interface ItemGroup<T> {
  section: string | null;
  items: T[];
}

/** Groups items by `section`, keeping the checklist order (sections in order of first appearance). */
export function groupBySection<T extends { section: string | null; sort_order: number }>(items: T[]): Array<ItemGroup<T>> {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const groups: Array<ItemGroup<T>> = [];
  const index = new Map<string, ItemGroup<T>>();
  for (const item of sorted) {
    const key = item.section?.trim() || "";
    let group = index.get(key);
    if (!group) {
      group = { section: key || null, items: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
