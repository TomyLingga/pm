// Preventive-maintenance helpers: checklist drafts, evaluation rules and due-date hints.
import { formatNumber, formatSpan, parseDecimal } from './format';
import type {
  ChecklistItemDef,
  PmItemPayload,
  PmItemResult,
  PmTaskItem,
  PmTaskListItem,
} from './types';

/** Local, editable state of one checklist item (source of truth while the screen is open). */
export interface ItemDraft {
  /** ok_nok_na: the chosen result. number/text: only `na` (or null) is meaningful. */
  result: PmItemResult | null;
  /** Raw text of the number input (may use a decimal comma). */
  number: string;
  text: string;
  notes: string;
}

export function draftFromItem(item: PmTaskItem): ItemDraft {
  return {
    result: item.input_type === 'ok_nok_na' ? item.result : item.result === 'na' ? 'na' : null,
    number: formatNumber(item.value_number),
    text: item.value_text ?? '',
    notes: item.notes ?? '',
  };
}

export function sameDraft(a: ItemDraft, b: ItemDraft): boolean {
  return a.result === b.result && a.number === b.number && a.text === b.text && a.notes === b.notes;
}

const toNumber = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** "370–400 V", "≥ 370 V", "≤ 400 V" or null when the item has no limits. */
export function rangeLabel(def: Pick<ChecklistItemDef, 'min_value' | 'max_value' | 'unit'>): string | null {
  const min = toNumber(def.min_value);
  const max = toNumber(def.max_value);
  const unit = def.unit ? ` ${def.unit}` : '';
  if (min !== null && max !== null) return `${formatNumber(min)}–${formatNumber(max)}${unit}`;
  if (min !== null) return `≥ ${formatNumber(min)}${unit}`;
  if (max !== null) return `≤ ${formatNumber(max)}${unit}`;
  return null;
}

/** Same rule as the server: ok when inside min/max (or no limits), otherwise not_ok. */
export function numberVerdict(
  def: Pick<ChecklistItemDef, 'min_value' | 'max_value'>,
  value: number | null,
): 'ok' | 'not_ok' | null {
  if (value === null) return null;
  const min = toNumber(def.min_value);
  const max = toNumber(def.max_value);
  if (min !== null && value < min) return 'not_ok';
  if (max !== null && value > max) return 'not_ok';
  return 'ok';
}

/** True when the number input holds text that cannot be parsed as a number. */
export function hasInvalidNumber(item: PmTaskItem, d: ItemDraft): boolean {
  return item.input_type === 'number' && d.result !== 'na' && d.number.trim() !== '' && parseDecimal(d.number) === null;
}

/** Result as the server will evaluate it, computed locally from the draft. */
export function effectiveResult(item: PmTaskItem, d: ItemDraft): PmItemResult | null {
  if (d.result === 'na') return 'na';
  if (item.input_type === 'ok_nok_na') return d.result;
  if (item.input_type === 'number') return numberVerdict(item, parseDecimal(d.number));
  return d.text.trim() ? 'ok' : null;
}

export function isItemFilled(item: PmTaskItem, d: ItemDraft): boolean {
  return effectiveResult(item, d) !== null;
}

/**
 * Body of one item for `PUT /pm-tasks/{id}/items`. `result` is only sent when the client owns it
 * (ok_nok_na choice, or N/A); for number/text the server computes it from the value.
 */
export function buildItemPayload(item: PmTaskItem, d: ItemDraft): PmItemPayload {
  const notes = d.notes.trim() || null;
  if (item.input_type === 'ok_nok_na') {
    return d.result ? { id: item.id, result: d.result, notes } : { id: item.id, notes };
  }
  if (item.input_type === 'number') {
    if (d.result === 'na') return { id: item.id, result: 'na', value_number: null, notes };
    const raw = d.number.trim();
    if (raw === '') return { id: item.id, value_number: null, notes };
    const value = parseDecimal(raw);
    // Unparseable input: keep the server value, only save the notes.
    return value === null ? { id: item.id, notes } : { id: item.id, value_number: value, notes };
  }
  if (d.result === 'na') return { id: item.id, result: 'na', value_text: null, notes };
  return { id: item.id, value_text: d.text.trim() || null, notes };
}

/** Client-side completeness check; never stricter than the server rules in API_PM.md §5. */
export function itemProblem(item: PmTaskItem, d: ItemDraft): string | null {
  if (hasInvalidNumber(item, d)) return 'Angka tidak valid.';
  const result = effectiveResult(item, d);
  if (item.is_required && result === null) return 'Butir wajib belum diisi.';
  if (item.photo_required && result !== null && result !== 'na' && (item.attachments?.length ?? 0) === 0) {
    return 'Foto wajib belum ada.';
  }
  return null;
}

export interface ItemSection<T> {
  title: string | null;
  items: { item: T; no: number }[];
}

/** Sorts by sort_order and groups consecutive items by section, numbering them 1..n. */
export function groupBySection<T extends { sort_order: number; section: string | null; id: number }>(
  items: T[],
): ItemSection<T>[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const sections: ItemSection<T>[] = [];
  sorted.forEach((item, index) => {
    const title = item.section?.trim() || null;
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.items.push({ item, no: index + 1 });
    else sections.push({ title, items: [{ item, no: index + 1 }] });
  });
  return sections;
}

export function inputTypeHint(def: ChecklistItemDef): string {
  if (def.input_type === 'ok_nok_na') return 'Pilih OK / Tidak OK / N/A';
  if (def.input_type === 'number') {
    const range = rangeLabel(def);
    return `Angka${def.unit ? ` (${def.unit})` : ''}${range ? ` · batas ${range}` : ''}`;
  }
  return 'Isian teks';
}

export type HintTone = 'muted' | 'warning' | 'danger' | 'ok';

/** Relative hint next to the due date: "2 jam lagi", "lewat 3 jam", "terlambat 1 hari". */
export function dueHint(
  task: Pick<PmTaskListItem, 'status' | 'due_at' | 'overdue_at' | 'is_late'>,
  now: number = Date.now(),
): { text: string; tone: HintTone } | null {
  if (task.status === 'skipped') return null;
  if (task.status === 'completed') {
    return task.is_late ? { text: 'selesai terlambat', tone: 'danger' } : { text: 'selesai tepat waktu', tone: 'ok' };
  }
  const due = Date.parse(task.due_at);
  if (Number.isNaN(due)) return null;
  const diff = due - now;
  if (diff > 0) return { text: `${formatSpan(diff)} lagi`, tone: diff <= 24 * 3600_000 ? 'warning' : 'muted' };
  const overdueAt = task.overdue_at ? Date.parse(task.overdue_at) : NaN;
  const pastTolerance = task.status === 'overdue' || (!Number.isNaN(overdueAt) && now >= overdueAt);
  // Past due but still inside the tolerance window → "lewat"; past tolerance → "terlambat".
  return pastTolerance
    ? { text: `terlambat ${formatSpan(-diff)}`, tone: 'danger' }
    : { text: `lewat ${formatSpan(-diff)}`, tone: 'warning' };
}

/** Minutes elapsed since the task was started (at least 1), used to prefill the duration. */
export function elapsedMinutes(startedAt: string | null, now: number = Date.now()): number | null {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return null;
  return Math.max(1, Math.round((now - start) / 60000));
}

/** Default description of a work order raised from a not-OK checklist item. */
export function findingDescription(taskNumber: string, item: PmTaskItem, d: ItemDraft | undefined): string {
  const notes = d?.notes.trim() || item.notes?.trim() || '';
  let detail = notes;
  if (!detail && item.input_type === 'number') {
    const value = d ? parseDecimal(d.number) : toNumber(item.value_number);
    const range = rangeLabel(item);
    if (value !== null) {
      detail = `terukur ${formatNumber(value)}${item.unit ? ` ${item.unit}` : ''}${range ? ` (batas ${range})` : ''}`;
    }
  }
  return `Temuan PM ${taskNumber}: ${item.description}${detail ? ` — ${detail}` : ''}`;
}
