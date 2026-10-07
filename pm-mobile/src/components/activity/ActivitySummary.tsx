import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { activityStatusTones, colors, radius } from '@/lib/theme';
import type { DailyActivitySummary } from '@/lib/types';

const TILES: { key: keyof DailyActivitySummary; label: string; color: string }[] = [
  { key: 'total', label: 'Total', color: colors.primary },
  { key: 'open', label: 'Open', color: activityStatusTones.open.fg },
  { key: 'on_progress', label: 'On Progress', color: activityStatusTones.on_progress.fg },
  { key: 'closed', label: 'Closed', color: activityStatusTones.closed.fg },
];

/** Four counters of the current month / filter (`meta.summary`). */
export function ActivitySummary({ summary }: { summary: DailyActivitySummary | null | undefined }) {
  return (
    <View style={styles.row} accessibilityRole="summary">
      {TILES.map((t) => (
        <View key={t.key} style={styles.tile}>
          <Text style={[styles.value, { color: t.color }]}>{summary ? summary[t.key] : '-'}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {t.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tile: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', color: colors.textSubtle, textTransform: 'uppercase' },
});
