import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatNumber } from '@/lib/format';
import { groupBySection, inputTypeHint, rangeLabel } from '@/lib/pm';
import { colors, radius, resultTones } from '@/lib/theme';
import type { ChecklistItemDef, PmTaskItem } from '@/lib/types';
import { MutedText, ToneBadge } from '../ui';
import { AttachmentGrid } from '../workorder/Attachments';

const PENDING_TONE = { fg: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' };

function Markers({ def }: { def: ChecklistItemDef }) {
  if (!def.is_required && !def.photo_required) return null;
  return (
    <View style={styles.markers}>
      {def.is_required && <Text style={styles.marker}>Wajib</Text>}
      {def.photo_required && (
        <View style={styles.photoMarker}>
          <Ionicons name="camera-outline" size={14} color={colors.textMuted} />
          <Text style={styles.marker}>Foto wajib</Text>
        </View>
      )}
    </View>
  );
}

/** Read-only preview of the template items shown before the task is started. */
export function ChecklistPreview({ items }: { items: ChecklistItemDef[] }) {
  const sections = groupBySection(items);
  if (items.length === 0) return <MutedText>Template checklist tidak memiliki butir.</MutedText>;
  return (
    <View style={{ gap: 12 }}>
      {sections.map((sec, i) => (
        <View key={`${sec.title ?? 'none'}-${i}`} style={{ gap: 8 }}>
          {!!sec.title && <Text style={styles.sectionTitle}>{sec.title}</Text>}
          {sec.items.map(({ item, no }) => (
            <View key={item.id} style={styles.previewItem}>
              <Text style={styles.description}>
                <Text style={styles.no}>{no}. </Text>
                {item.description}
              </Text>
              <Text style={styles.hint}>{inputTypeHint(item)}</Text>
              <Markers def={item} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function valueText(item: PmTaskItem): string | null {
  if (item.result === 'na') return null;
  if (item.input_type === 'number') {
    const v = formatNumber(item.value_number);
    if (!v) return null;
    const range = rangeLabel(item);
    return `${v}${item.unit ? ` ${item.unit}` : ''}${range ? `  (batas ${range})` : ''}`;
  }
  if (item.input_type === 'text') return item.value_text?.trim() || null;
  return null;
}

function ResultItem({
  item,
  no,
  token,
  onOpenWorkOrder,
}: {
  item: PmTaskItem;
  no: number;
  token: string | null;
  onOpenWorkOrder: (workOrderId: number) => void;
}) {
  const finding = item.result === 'not_ok';
  const value = valueText(item);
  const label =
    item.result_label ?? (item.result === 'ok' ? 'OK' : item.result === 'not_ok' ? 'Tidak OK' : item.result === 'na' ? 'N/A' : 'Belum diisi');
  return (
    <View style={[styles.resultItem, finding && styles.finding]}>
      <View style={styles.resultHeader}>
        <Text style={styles.description}>
          <Text style={styles.no}>{no}. </Text>
          {item.description}
        </Text>
        <ToneBadge label={label} tone={item.result ? resultTones[item.result] : PENDING_TONE} />
      </View>
      {!!value && <Text style={styles.value}>{value}</Text>}
      {!!item.notes && <Text style={styles.notes}>Catatan: {item.notes}</Text>}
      <AttachmentGrid attachments={item.attachments ?? []} token={token} size={84} />
      {!!item.work_order && (
        <Pressable
          onPress={() => item.work_order && onOpenWorkOrder(item.work_order.id)}
          style={styles.woLink}
          accessibilityRole="link"
        >
          <Ionicons name="construct" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.woNumber}>{item.work_order.wo_number}</Text>
            <Text style={styles.woStatus}>WO dari temuan · {item.work_order.status_label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

/** Read-only checklist results (completed tasks, or viewers who cannot work on the task). */
export function ChecklistResults({
  items,
  token,
  onOpenWorkOrder,
}: {
  items: PmTaskItem[];
  token: string | null;
  onOpenWorkOrder: (workOrderId: number) => void;
}) {
  const sections = groupBySection(items);
  const count = (r: string) => items.filter((i) => i.result === r).length;
  const empty = items.filter((i) => i.result === null).length;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.summary}>
        <ToneBadge label={`${count('ok')} OK`} tone={resultTones.ok} />
        <ToneBadge label={`${count('not_ok')} Tidak OK`} tone={resultTones.not_ok} />
        <ToneBadge label={`${count('na')} N/A`} tone={resultTones.na} />
        {empty > 0 && <ToneBadge label={`${empty} belum diisi`} tone={PENDING_TONE} />}
      </View>
      {sections.map((sec, i) => (
        <View key={`${sec.title ?? 'none'}-${i}`} style={{ gap: 8 }}>
          {!!sec.title && <Text style={styles.sectionTitle}>{sec.title}</Text>}
          {sec.items.map(({ item, no }) => (
            <ResultItem key={item.id} item={item} no={no} token={token} onOpenWorkOrder={onOpenWorkOrder} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  previewItem: {
    gap: 4,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
  },
  description: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 22 },
  no: { color: colors.textSubtle },
  hint: { fontSize: 14, color: colors.textMuted },
  markers: { flexDirection: 'row', gap: 12, marginTop: 2 },
  marker: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  photoMarker: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resultItem: {
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
  },
  finding: { borderColor: resultTones.not_ok.border, borderLeftWidth: 5, backgroundColor: '#FEF2F2' },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  value: { fontSize: 17, fontWeight: '700', color: colors.text },
  notes: { fontSize: 15, color: colors.textMuted },
  woLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  woNumber: { fontSize: 15, fontWeight: '800', color: colors.primary },
  woStatus: { fontSize: 13, color: colors.textMuted },
});
