import { colors } from './theme';
import type { Clearance, ClearanceResult } from './types';

// Fallback labels (PRD §4) used only if the server does not send clearance rows.
const DEFAULT_ITEMS: { item_no: 1 | 2; item_label: string }[] = [
  { item_no: 1, item_label: 'Area bersih' },
  { item_no: 2, item_label: 'Tidak ada tools/material tertinggal' },
];

export function clearanceItems(clearances: Clearance[] | undefined): { item_no: 1 | 2; item_label: string }[] {
  return DEFAULT_ITEMS.map((d) => {
    const fromServer = clearances?.find((c) => c.item_no === d.item_no);
    return { item_no: d.item_no, item_label: fromServer?.item_label || d.item_label };
  });
}

export const CLEARANCE_OPTIONS: { value: ClearanceResult; label: string; color: string }[] = [
  { value: 'ok', label: 'OK', color: colors.success },
  { value: 'not_ok', label: 'TDK', color: colors.danger },
];

export function clearanceLabel(result: ClearanceResult | null | undefined): string {
  if (result === 'ok') return 'OK';
  if (result === 'not_ok') return 'TDK';
  return '-';
}
