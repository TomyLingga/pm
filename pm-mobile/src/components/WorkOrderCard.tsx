import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime } from '@/lib/format';
import { colors, radius, statusTone } from '@/lib/theme';
import type { Assignee, WorkOrderListItem } from '@/lib/types';
import { PriorityBadge, StatusBadge } from './ui';

export function assigneeNames(assignees: Assignee[]): string {
  if (!assignees?.length) return '';
  return [...assignees]
    .sort((a, b) => Number(b.is_lead) - Number(a.is_lead))
    .map((a) => (a.is_lead ? `${a.name} (ketua)` : a.name))
    .join(', ');
}

export function equipmentText(wo: Pick<WorkOrderListItem, 'equipment_code' | 'equipment_name'>): string {
  return [wo.equipment_code, wo.equipment_name].filter(Boolean).join(' — ');
}

function Line({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={17} color={colors.textSubtle} style={styles.lineIcon} />
      <Text style={styles.lineText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

function WorkOrderCardBase({ item, onPress }: { item: WorkOrderListItem; onPress: (id: number) => void }) {
  const tone = statusTone(item.status);
  const equipment = equipmentText(item);
  const assignees = assigneeNames(item.assignees);
  const requester = [item.requester?.name, item.requester_sub_bagian_name].filter(Boolean).join(' · ');
  const category = [item.executor_unit?.code, item.service_category?.name].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Work order ${item.wo_number}, ${item.status_label}`}
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.card, { borderLeftColor: tone.border }, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <Text style={styles.number} numberOfLines={1}>
          {item.wo_number}
        </Text>
        <StatusBadge status={item.status} label={item.status_label} />
      </View>
      <View style={styles.meta}>
        <PriorityBadge priority={item.priority} label={item.priority_label} />
        {!!category && (
          <Text style={styles.category} numberOfLines={1}>
            {category}
          </Text>
        )}
      </View>
      <Text style={styles.description} numberOfLines={3}>
        {item.request_description}
      </Text>
      <View style={styles.lines}>
        {!!equipment && <Line icon="construct-outline" text={equipment} />}
        {!!item.location_name && <Line icon="location-outline" text={item.location_name} />}
        {!!requester && <Line icon="person-outline" text={requester} />}
        {!!assignees && <Line icon="people-outline" text={assignees} />}
        <Line icon="time-outline" text={formatDateTime(item.issued_at)} />
      </View>
    </Pressable>
  );
}

export const WorkOrderCard = memo(WorkOrderCardBase);

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
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  category: { flex: 1, fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  description: { fontSize: 16, color: colors.text, lineHeight: 22 },
  lines: { gap: 4 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineIcon: { marginTop: 2 },
  lineText: { flex: 1, fontSize: 14, color: colors.textMuted },
});
