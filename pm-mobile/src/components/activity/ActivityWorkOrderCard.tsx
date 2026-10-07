import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, STATUS_LABELS } from '@/lib/theme';
import type { DailyActivityWorkOrderLink } from '@/lib/types';
import { StatusBadge } from '../ui';
import { WO_TONE } from './ActivityCard';

/**
 * "Dari Work Order" on the activity detail: the report was generated automatically when the
 * technician completed the WO. `onPress` opens the WO detail (omit it to render a plain card).
 */
export function ActivityWorkOrderCard({
  workOrder,
  onPress,
}: {
  workOrder: DailyActivityWorkOrderLink;
  onPress?: () => void;
}) {
  // The nested WO carries no `status_label`; fall back to the raw status for unknown values.
  const statusLabel = (STATUS_LABELS as Record<string, string>)[workOrder.status] ?? workOrder.status;
  const number = workOrder.wo_number; // already starts with "WO/"

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'link' : 'summary'}
      accessibilityLabel={onPress ? `Buka work order ${workOrder.wo_number}` : number}
      style={({ pressed }) => [styles.card, pressed && !!onPress && styles.pressed]}
    >
      <View style={styles.header}>
        <Ionicons name="construct-outline" size={26} color={WO_TONE.fg} />
        <View style={styles.headerText}>
          <Text style={styles.label}>Dari Work Order</Text>
          <Text style={styles.number}>{number}</Text>
        </View>
        <StatusBadge status={workOrder.status} label={statusLabel} />
        {!!onPress && <Ionicons name="chevron-forward" size={20} color={WO_TONE.fg} />}
      </View>
      {!!workOrder.request_description && (
        <Text style={styles.description} numberOfLines={3}>
          {workOrder.request_description}
        </Text>
      )}
      <Text style={styles.note}>
        Laporan ini dibuat otomatis saat WO diselesaikan.{onPress ? ' Ketuk untuk membuka WO.' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: WO_TONE.bg,
    borderWidth: 1,
    borderColor: WO_TONE.border,
  },
  pressed: { backgroundColor: '#DDD6FE' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  headerText: { flex: 1, gap: 2 },
  label: { fontSize: 12, fontWeight: '700', color: WO_TONE.fg, textTransform: 'uppercase' },
  number: { fontSize: 16, fontWeight: '700', color: colors.text },
  description: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  note: { fontSize: 13, color: WO_TONE.fg },
});
