import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime } from '@/lib/format';
import { dueHint, type HintTone } from '@/lib/pm';
import { colors, pmStatusTone, radius } from '@/lib/theme';
import type { PmTaskListItem } from '@/lib/types';
import { StatusBadge, ToneBadge } from '../ui';

export const HINT_COLORS: Record<HintTone, string> = {
  muted: colors.textSubtle,
  warning: '#B45309',
  danger: colors.danger,
  ok: colors.success,
};

const SKIP_TONE = { fg: '#9A3412', bg: '#FFEDD5', border: '#FDBA74' };
const FINDING_TONE = { fg: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5' };
const LATE_TONE = { fg: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5' };

function Line({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={17} color={colors.textSubtle} style={{ marginTop: 2 }} />
      <Text style={styles.lineText} numberOfLines={2}>
        {children}
      </Text>
    </View>
  );
}

function PmTaskCardBase({ item, onPress }: { item: PmTaskListItem; onPress: (id: number) => void }) {
  const tone = pmStatusTone(item.status);
  const hint = dueHint(item);
  const equipment = item.equipment;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tugas PM ${item.number}, ${item.status_label}`}
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.card, { borderLeftColor: tone.border }, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <Text style={styles.number} numberOfLines={1}>
          {item.number}
        </Text>
        <StatusBadge status={item.status} label={item.status_label} tone={tone} />
      </View>

      <Text style={styles.equipment} numberOfLines={2}>
        {equipment ? `${equipment.code} — ${equipment.name}` : 'Alat tidak diketahui'}
      </Text>

      <View style={styles.dueRow}>
        <Ionicons name="alarm-outline" size={20} color={hint ? HINT_COLORS[hint.tone] : colors.textSubtle} />
        <Text style={styles.dueText}>{formatDateTime(item.due_at)}</Text>
        {hint && <Text style={[styles.hint, { color: HINT_COLORS[hint.tone] }]}>· {hint.text}</Text>}
      </View>

      <View style={styles.lines}>
        {!!equipment?.location_name && <Line icon="location-outline">{equipment.location_name}</Line>}
        {!!item.schedule && (
          <Line icon="repeat-outline">
            {item.schedule.name}
            {item.schedule.frequency_label ? ` · ${item.schedule.frequency_label}` : ''}
          </Line>
        )}
        <Line icon="person-outline">PIC: {item.pic?.name ?? '-'}</Line>
      </View>

      {(item.has_skip_proposal || item.findings_count > 0 || (item.is_late && item.status === 'completed')) && (
        <View style={styles.chips}>
          {item.has_skip_proposal && <ToneBadge label="Usulan lewati" tone={SKIP_TONE} />}
          {item.findings_count > 0 && <ToneBadge label={`${item.findings_count} temuan`} tone={FINDING_TONE} />}
          {item.is_late && item.status === 'completed' && <ToneBadge label="Terlambat" tone={LATE_TONE} />}
        </View>
      )}
    </Pressable>
  );
}

export const PmTaskCard = memo(PmTaskCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
    padding: 16,
    gap: 10,
  },
  pressed: { backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  number: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.textMuted },
  equipment: { fontSize: 18, fontWeight: '800', color: colors.text, lineHeight: 24 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dueText: { fontSize: 16, fontWeight: '700', color: colors.text },
  hint: { fontSize: 15, fontWeight: '700' },
  lines: { gap: 4 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineText: { flex: 1, fontSize: 14, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
