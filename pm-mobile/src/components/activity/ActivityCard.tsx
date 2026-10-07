import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime, formatYmd } from '@/lib/format';
import { activityStatusTone, colors, radius } from '@/lib/theme';
import type { DailyActivity } from '@/lib/types';
import { StatusBadge, ToneBadge } from '../ui';

export const WEEK_TONE = { fg: '#1E3A8A', bg: '#E0E7FF', border: '#A5B4FC' };
/** Tag of reports generated from a completed work order (violet, like a completed WO). */
export const WO_TONE = { fg: '#6D28D9', bg: '#EDE9FE', border: '#A78BFA' };

function ActivityCardBase({
  item,
  showPic,
  onPress,
}: {
  item: DailyActivity;
  /** Show the owner's name (scope team / all). */
  showPic: boolean;
  onPress: (id: number) => void;
}) {
  const tone = activityStatusTone(item.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Aktivitas ${formatYmd(item.activity_date)}, ${item.title}, ${item.status_label}`}
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.card, { borderLeftColor: tone.border }, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-number-outline" size={18} color={colors.textSubtle} />
          <Text style={styles.date}>{formatYmd(item.activity_date)}</Text>
          <ToneBadge label={`M${item.week_of_month}`} tone={WEEK_TONE} />
        </View>
        <StatusBadge status={item.status} label={item.status_label} tone={tone} />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>

      {showPic && (
        <View style={styles.line}>
          <Ionicons name="person-outline" size={16} color={colors.textSubtle} />
          <Text style={styles.lineText} numberOfLines={1}>
            {item.user?.name ?? '-'}
            {item.org_unit?.name ? ` · ${item.org_unit.name}` : ''}
          </Text>
        </View>
      )}

      {!!item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      {!!item.program_activity && (
        <View style={styles.line}>
          <Ionicons name="list-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.lineText, { color: colors.primary }]} numberOfLines={1}>
            {item.program_activity.program_code}.{item.program_activity.item_code} · {item.program_activity.title}
          </Text>
        </View>
      )}

      {!!item.work_order && (
        <View style={styles.line}>
          <Ionicons name="construct-outline" size={16} color={WO_TONE.fg} />
          <ToneBadge label={item.work_order.wo_number} tone={WO_TONE} />
          <Text style={styles.lineText} numberOfLines={1}>
            Otomatis dari WO
          </Text>
        </View>
      )}

      <Text style={styles.uploaded}>Diunggah {formatDateTime(item.created_at)}</Text>
    </Pressable>
  );
}

export const ActivityCard = memo(ActivityCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
    padding: 16,
    gap: 8,
  },
  pressed: { backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  date: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, lineHeight: 23 },
  description: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineText: { flex: 1, fontSize: 14, color: colors.textMuted },
  uploaded: { fontSize: 12, color: colors.textSubtle },
});
