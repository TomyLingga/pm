import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

export function progressColor(pct: number): string {
  if (pct >= 100) return colors.success;
  if (pct > 0) return colors.warning;
  return colors.borderStrong;
}

/** Horizontal progress bar with the percentage; `null` = no activity yet. */
export function ProgressBar({ value, compact = false }: { value: number | null | undefined; compact?: boolean }) {
  const pct = value === null || value === undefined ? null : Math.max(0, Math.min(100, Math.round(value)));
  const color = pct === null ? colors.borderStrong : progressColor(pct);
  return (
    <View style={styles.row} accessibilityLabel={pct === null ? 'Belum ada kegiatan' : `Progress ${pct} persen`}>
      <View style={[styles.track, compact && styles.trackCompact]}>
        <View style={[styles.fill, { width: `${pct ?? 0}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.label, compact && styles.labelCompact, pct !== null && { color }]}>
        {pct === null ? '-' : `${pct}%`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  trackCompact: { height: 6, borderRadius: 3 },
  fill: { height: '100%', borderRadius: 5 },
  label: { minWidth: 44, textAlign: 'right', fontSize: 15, fontWeight: '800', color: colors.textSubtle },
  labelCompact: { fontSize: 13, minWidth: 38 },
});
