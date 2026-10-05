import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime, formatRelative } from '@/lib/format';
import { colors, radius, requestStatusTone } from '@/lib/theme';
import type { ServiceRequestListItem } from '@/lib/types';
import { PriorityBadge, StatusBadge } from './ui';

function Line({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={17} color={colors.textSubtle} style={{ marginTop: 2 }} />
      <Text style={styles.lineText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

function RequestCardBase({ item, onPress }: { item: ServiceRequestListItem; onPress: (id: number) => void }) {
  const tone = requestStatusTone(item.status);
  const category = [item.executor_unit?.code, item.service_category?.name].filter(Boolean).join(' · ');
  const step = item.current_step;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Form Request ${item.request_number ?? 'draft'}, ${item.status_label}`}
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.card, { borderLeftColor: tone.border }, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <Text style={[styles.number, !item.request_number && styles.draftNumber]} numberOfLines={1}>
          {item.request_number ?? 'Draft (belum diajukan)'}
        </Text>
        <StatusBadge status={item.status} label={item.status_label} tone={tone} />
      </View>
      <View style={styles.meta}>
        <PriorityBadge priority={item.priority} label={item.priority_label} />
        {!!category && (
          <Text style={styles.category} numberOfLines={1}>
            {category}
          </Text>
        )}
      </View>
      <Text style={styles.purpose} numberOfLines={3}>
        {item.purpose}
      </Text>
      <View style={styles.lines}>
        {!!item.office && <Line icon="business-outline" text={item.office.name} />}
        {!!item.requester && (
          <Line
            icon="person-outline"
            text={[item.requester.name, item.requester_sub_bagian_name].filter(Boolean).join(' · ')}
          />
        )}
        {!!step && (
          <Line
            icon="hourglass-outline"
            text={`${step.label}${step.assignee_label ? `: ${step.assignee_label}` : ''}${
              step.waiting_since ? ` · ${formatRelative(step.waiting_since)}` : ''
            }`}
          />
        )}
        {item.revision_no > 0 && <Line icon="refresh" text={`Revisi ke-${item.revision_no}`} />}
        <Line icon="time-outline" text={`Dibuat ${formatDateTime(item.created_at)}`} />
      </View>
    </Pressable>
  );
}

export const RequestCard = memo(RequestCardBase);

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
  number: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  draftNumber: { color: colors.textMuted, fontStyle: 'italic' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  category: { flex: 1, fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  purpose: { fontSize: 16, color: colors.text, lineHeight: 22 },
  lines: { gap: 4 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineText: { flex: 1, fontSize: 14, color: colors.textMuted },
});
