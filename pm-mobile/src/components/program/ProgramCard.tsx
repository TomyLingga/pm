import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { activityStatusTones, colors, programStatusTone, radius } from '@/lib/theme';
import type { StatusCounts, WorkProgramListItem } from '@/lib/types';
import { StatusBadge, ToneBadge } from '../ui';
import { ProgressBar } from './ProgressBar';

/** "Open 2 · On Progress 1 · Closed 4" chips; zero counts are hidden. */
export function CountChips({ counts }: { counts: StatusCounts | null | undefined }) {
  if (!counts) return null;
  const entries: { key: keyof StatusCounts; label: string }[] = [
    { key: 'open', label: 'Open' },
    { key: 'on_progress', label: 'On Progress' },
    { key: 'closed', label: 'Closed' },
    { key: 'cancelled', label: 'Batal' },
  ];
  const visible = entries.filter((e) => (counts[e.key] ?? 0) > 0);
  if (!visible.length) return null;
  return (
    <View style={styles.chips}>
      {visible.map((e) => (
        <ToneBadge key={e.key} label={`${e.label} ${counts[e.key]}`} tone={activityStatusTones[e.key]} />
      ))}
    </View>
  );
}

function ProgramCardBase({ item, onPress }: { item: WorkProgramListItem; onPress: (id: number) => void }) {
  const tone = programStatusTone(item.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Program ${item.code} ${item.title}, ${item.status_label}`}
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.card, { borderLeftColor: tone.border }, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.codeWrap}>
          <Text style={styles.code}>{item.code}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <StatusBadge status={item.status} label={item.status_label} tone={tone} />
      </View>

      <View style={styles.line}>
        <Ionicons name="business-outline" size={16} color={colors.textSubtle} />
        <Text style={styles.lineText} numberOfLines={1}>
          {item.org_unit?.name ?? '-'}
        </Text>
      </View>

      <ProgressBar value={item.progress_pct} />

      <View style={styles.footer}>
        <Text style={styles.meta}>
          {item.items_count} sub-item · {item.activities_count} kegiatan
        </Text>
      </View>
      <CountChips counts={item.counts} />
    </Pressable>
  );
}

export const ProgramCard = memo(ProgramCardBase);

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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  codeWrap: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
  },
  code: { fontSize: 15, fontWeight: '800', color: colors.primary },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text, lineHeight: 23 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineText: { flex: 1, fontSize: 14, color: colors.textMuted },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontSize: 13, color: colors.textSubtle },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
