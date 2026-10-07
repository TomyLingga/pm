import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatYmd } from '@/lib/format';
import { activityStatusTone, colors, radius } from '@/lib/theme';
import type { ProgramActivity, ProgramActivityPic } from '@/lib/types';
import { StatusBadge } from '../ui';
import { ProgressBar } from './ProgressBar';

const PIC_MAIN = { bg: colors.primarySoft, fg: colors.primary, border: '#A5B4FC' };
const PIC_SUPPORT = { bg: '#F1F5F9', fg: colors.textMuted, border: colors.borderStrong };

/** PIC chips: "utama" first (filled), "pendukung" after (muted). */
export function PicChips({ pics, highlightId }: { pics: ProgramActivityPic[]; highlightId?: number | null }) {
  if (!pics?.length) return <Text style={styles.noPic}>Belum ada PIC</Text>;
  const sorted = [...pics].sort((a, b) => (a.role === b.role ? 0 : a.role === 'utama' ? -1 : 1));
  return (
    <View style={styles.pics}>
      {sorted.map((p) => {
        const main = p.role === 'utama';
        const tone = main ? PIC_MAIN : PIC_SUPPORT;
        const me = highlightId != null && p.id === highlightId;
        return (
          <View
            key={`${p.id}-${p.role}`}
            style={[styles.pic, { backgroundColor: tone.bg, borderColor: me ? colors.primary : tone.border }]}
          >
            <Ionicons name={main ? 'person' : 'person-outline'} size={13} color={tone.fg} />
            <Text style={[styles.picText, { color: tone.fg }]} numberOfLines={1}>
              {p.name}
              {me ? ' (Anda)' : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ProgramActivityRowBase({
  activity,
  itemCode,
  myId,
  onPress,
}: {
  activity: ProgramActivity;
  itemCode: string;
  myId: number | null;
  onPress: (activity: ProgramActivity) => void;
}) {
  const tone = activityStatusTone(activity.status);
  const editable = !!activity.permissions?.can_update_progress || !!activity.permissions?.can_change_status;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Kegiatan ${itemCode}.${activity.sequence} ${activity.title}, ${activity.status_label}, progress ${activity.progress_pct} persen`}
      onPress={() => onPress(activity)}
      style={({ pressed }) => [styles.row, { borderLeftColor: tone.border }, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <Text style={styles.seq}>
          {itemCode}.{activity.sequence}
        </Text>
        <StatusBadge status={activity.status} label={activity.status_label} tone={tone} />
      </View>
      <Text style={styles.title} numberOfLines={3}>
        {activity.title}
      </Text>
      <PicChips pics={activity.pics} highlightId={myId} />
      <View style={styles.meta}>
        <Ionicons name="flag-outline" size={15} color={colors.textSubtle} />
        <Text style={styles.metaText}>Target {activity.target_date ? formatYmd(activity.target_date) : '-'}</Text>
        {!!activity.closed_date && <Text style={styles.metaText}>· Closed {formatYmd(activity.closed_date)}</Text>}
      </View>
      <ProgressBar value={activity.progress_pct} compact />
      {!!activity.remarks && (
        <Text style={styles.remarks} numberOfLines={2}>
          {activity.remarks}
        </Text>
      )}
      {editable && (
        <View style={styles.editHint}>
          <Ionicons name="create-outline" size={15} color={colors.primary} />
          <Text style={styles.editHintText}>Ketuk untuk update progress / status</Text>
        </View>
      )}
    </Pressable>
  );
}

export const ProgramActivityRow = memo(ProgramActivityRowBase);

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    padding: 14,
    gap: 8,
  },
  pressed: { backgroundColor: '#F8FAFC' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  seq: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 22 },
  pics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  picText: { fontSize: 13, fontWeight: '600' },
  noPic: { fontSize: 13, color: colors.textSubtle, fontStyle: 'italic' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: colors.textMuted },
  remarks: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  editHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editHintText: { fontSize: 12, fontWeight: '600', color: colors.primary },
});
