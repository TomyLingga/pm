import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { activityStatusTones, DAILY_ACTIVITY_STATUS_OPTIONS } from '@/lib/theme';
import type { DailyActivityStatus } from '@/lib/types';
import { Chip } from '../ui';

/** Default selection of the "Aktivitas" tab: running reports only (same as the web). */
export const DEFAULT_ACTIVITY_STATUSES: DailyActivityStatus[] = ['open', 'on_progress'];

/** Shown under the chips while the month navigator is hidden (period only narrows closed reports). */
export const ACTIVITY_PERIOD_HINT =
  'Laporan open dan on progress selalu ditampilkan; bulan hanya membatasi laporan closed.';

/** Filter chip captions (uppercase like the web); records keep the server's `status_label`. */
const CHIP_LABELS: Record<DailyActivityStatus, string> = {
  open: 'OPEN',
  on_progress: 'ON PROGRESS',
  closed: 'CLOSED',
};

/** `status=a,b` for `GET /daily-activities` in canonical order; `undefined` = all ("Semua"). */
export function activityStatusParam(selected: DailyActivityStatus[]): string | undefined {
  const ordered = DAILY_ACTIVITY_STATUS_OPTIONS.filter((o) => selected.includes(o.value)).map((o) => o.value);
  return ordered.length ? ordered.join(',') : undefined;
}

/**
 * The period (month + year) only narrows `closed` reports, open / on progress ones are always
 * listed; so the month navigator only matters when closed reports are part of the selection.
 */
export function activityPeriodApplies(selected: DailyActivityStatus[]): boolean {
  return selected.length === 0 || selected.includes('closed');
}

/**
 * Multi-select status chips: "Semua" (empty selection = no `status` param) or any combination of
 * OPEN / ON PROGRESS / CLOSED. Horizontally scrollable, 44 px tall (`Chip`).
 */
export function ActivityStatusChips({
  value,
  onChange,
}: {
  value: DailyActivityStatus[];
  onChange: (next: DailyActivityStatus[]) => void;
}) {
  const toggle = (status: DailyActivityStatus) =>
    onChange(value.includes(status) ? value.filter((s) => s !== status) : [...value, status]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bar}>
      <Chip label="Semua" selected={value.length === 0} onPress={() => onChange([])} />
      {DAILY_ACTIVITY_STATUS_OPTIONS.map((o) => (
        <Chip
          key={o.value}
          label={CHIP_LABELS[o.value]}
          selected={value.includes(o.value)}
          onPress={() => toggle(o.value)}
          color={activityStatusTones[o.value].fg}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
});
