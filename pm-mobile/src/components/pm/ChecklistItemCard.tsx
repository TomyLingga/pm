import { Ionicons } from '@expo/vector-icons';
import React, { memo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { parseDecimal } from '@/lib/format';
import { effectiveResult, hasInvalidNumber, numberVerdict, rangeLabel, type ItemDraft } from '@/lib/pm';
import { colors, radius, resultTones } from '@/lib/theme';
import type { Attachment, PmItemResult, PmTaskItem } from '@/lib/types';
import { Button } from '../ui';
import { AttachmentGrid } from '../workorder/Attachments';

export const MAX_ITEM_PHOTOS = 5;

export type PhotoSource = 'camera' | 'gallery';

interface ChecklistItemCardProps {
  no: number;
  item: PmTaskItem;
  draft: ItemDraft;
  /** Validation / server message for this item. */
  error?: string;
  token: string | null;
  uploading: boolean;
  canCreateWorkOrder: boolean;
  onChange: (itemId: number, patch: Partial<ItemDraft>) => void;
  onAddPhoto: (item: PmTaskItem, source: PhotoSource) => void;
  onDeletePhoto: (attachment: Attachment) => void;
  canDeletePhoto: (attachment: Attachment) => boolean;
  onCreateWorkOrder: (item: PmTaskItem) => void;
  onOpenWorkOrder: (workOrderId: number) => void;
  /** Reports the card's y offset inside the scroll content (used to scroll to invalid items). */
  onLayoutY: (itemId: number, y: number) => void;
}

const RESULT_OPTIONS: { value: PmItemResult; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'ok', label: 'OK', icon: 'checkmark-circle' },
  { value: 'not_ok', label: 'Tidak OK', icon: 'close-circle' },
  { value: 'na', label: 'N/A', icon: 'remove-circle' },
];

/** Three large buttons: OK / Tidak OK / N/A. */
function ResultButtons({ value, onSelect }: { value: PmItemResult | null; onSelect: (v: PmItemResult) => void }) {
  return (
    <View style={styles.resultRow} accessibilityRole="radiogroup">
      {RESULT_OPTIONS.map((o) => {
        const selected = value === o.value;
        const tone = resultTones[o.value];
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [
              styles.resultBtn,
              selected && { backgroundColor: tone.fg, borderColor: tone.fg },
              pressed && !selected && { backgroundColor: tone.bg },
            ]}
          >
            <Ionicons name={o.icon} size={26} color={selected ? colors.white : tone.fg} />
            <Text style={[styles.resultLabel, { color: selected ? colors.white : colors.text }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small N/A toggle for number / text items. */
function NaToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel="Tidak berlaku (N/A)"
      style={[styles.naToggle, active && styles.naToggleActive]}
    >
      <Text style={[styles.naText, active && { color: colors.white }]}>N/A</Text>
    </Pressable>
  );
}

function ChecklistItemCardBase({
  no,
  item,
  draft,
  error,
  token,
  uploading,
  canCreateWorkOrder,
  onChange,
  onAddPhoto,
  onDeletePhoto,
  canDeletePhoto,
  onCreateWorkOrder,
  onOpenWorkOrder,
  onLayoutY,
}: ChecklistItemCardProps) {
  const result = effectiveResult(item, draft);
  const isNa = draft.result === 'na';
  const [notesOpen, setNotesOpen] = useState(false);
  // The notes field shows itself as soon as the item is "Tidak OK".
  const showNotes = notesOpen || result === 'not_ok' || draft.notes.length > 0;
  const photos = item.attachments ?? [];
  const photoMissing = item.photo_required && photos.length === 0;
  const invalidNumber = hasInvalidNumber(item, draft);
  const message = error ?? (invalidNumber ? 'Angka tidak valid.' : undefined);

  const onLayout = (e: LayoutChangeEvent) => onLayoutY(item.id, e.nativeEvent.layout.y);

  const toggleNa = () => onChange(item.id, { result: isNa ? null : 'na' });

  const renderNumber = () => {
    const value = isNa ? null : parseDecimal(draft.number);
    const verdict = numberVerdict(item, value);
    const range = rangeLabel(item);
    const borderColor = invalidNumber
      ? colors.danger
      : verdict === 'ok'
        ? colors.success
        : verdict === 'not_ok'
          ? colors.danger
          : colors.borderStrong;
    return (
      <View style={{ gap: 6 }}>
        <View style={styles.inputRow}>
          <TextInput
            value={isNa ? '' : draft.number}
            onChangeText={(t) => onChange(item.id, { number: t })}
            editable={!isNa}
            keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
            placeholder={isNa ? 'N/A' : '0'}
            placeholderTextColor="#94A3B8"
            selectTextOnFocus
            style={[styles.numberInput, { borderColor }, isNa && styles.inputDisabled]}
            accessibilityLabel={`Nilai ${item.description}`}
          />
          {!!item.unit && <Text style={styles.unit}>{item.unit}</Text>}
          <NaToggle active={isNa} onToggle={toggleNa} />
        </View>
        <View style={styles.hintRow}>
          {!!range && <Text style={styles.rangeHint}>Batas {range}</Text>}
          {verdict === 'ok' && (
            <View style={styles.verdict}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.verdictText, { color: colors.success }]}>{range ? 'Dalam batas' : 'Terisi'}</Text>
            </View>
          )}
          {verdict === 'not_ok' && (
            <View style={styles.verdict}>
              <Ionicons name="warning" size={18} color={colors.danger} />
              <Text style={[styles.verdictText, { color: colors.danger }]}>Di luar batas</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderText = () => (
    <View style={styles.inputRowTop}>
      <TextInput
        value={isNa ? '' : draft.text}
        onChangeText={(t) => onChange(item.id, { text: t })}
        editable={!isNa}
        multiline
        textAlignVertical="top"
        placeholder={isNa ? 'N/A' : 'Tulis hasil pemeriksaan'}
        placeholderTextColor="#94A3B8"
        style={[styles.textInput, isNa && styles.inputDisabled]}
        accessibilityLabel={`Isian ${item.description}`}
      />
      <NaToggle active={isNa} onToggle={toggleNa} />
    </View>
  );

  return (
    <View
      onLayout={onLayout}
      style={[styles.card, result === 'not_ok' && styles.cardFinding, !!message && styles.cardError]}
    >
      <View style={styles.header}>
        <Text style={styles.description}>
          <Text style={styles.no}>{no}. </Text>
          {item.description}
          {item.is_required && <Text style={styles.required}> *</Text>}
        </Text>
        {result !== null && (
          <Ionicons
            name={result === 'ok' ? 'checkmark-circle' : result === 'not_ok' ? 'alert-circle' : 'remove-circle'}
            size={24}
            color={resultTones[result].fg}
          />
        )}
      </View>

      {item.input_type === 'ok_nok_na' && (
        <ResultButtons value={draft.result} onSelect={(v) => onChange(item.id, { result: v })} />
      )}
      {item.input_type === 'number' && renderNumber()}
      {item.input_type === 'text' && renderText()}

      {showNotes ? (
        <TextInput
          value={draft.notes}
          onChangeText={(t) => onChange(item.id, { notes: t })}
          multiline
          textAlignVertical="top"
          placeholder={result === 'not_ok' ? 'Catatan temuan (jelaskan kondisi)' : 'Catatan'}
          placeholderTextColor="#94A3B8"
          style={[styles.notesInput, result === 'not_ok' && { borderColor: resultTones.not_ok.border }]}
          accessibilityLabel={`Catatan ${item.description}`}
        />
      ) : (
        <Pressable onPress={() => setNotesOpen(true)} style={styles.addNotes} accessibilityRole="button">
          <Ionicons name="create-outline" size={18} color={colors.primary} />
          <Text style={styles.addNotesText}>Tambah catatan</Text>
        </Pressable>
      )}

      {/* Photos */}
      <View style={styles.photoHeader}>
        <Text style={styles.photoTitle}>
          Foto {photos.length}/{MAX_ITEM_PHOTOS}
        </Text>
        {item.photo_required && (
          <View style={[styles.photoBadge, photoMissing ? styles.photoBadgeMissing : styles.photoBadgeOk]}>
            <Ionicons
              name={photoMissing ? 'camera' : 'checkmark'}
              size={14}
              color={photoMissing ? '#B91C1C' : '#15803D'}
            />
            <Text style={[styles.photoBadgeText, { color: photoMissing ? '#B91C1C' : '#15803D' }]}>Foto wajib</Text>
          </View>
        )}
      </View>
      <AttachmentGrid attachments={photos} token={token} size={84} canDelete={canDeletePhoto} onDelete={onDeletePhoto} />
      {photos.length < MAX_ITEM_PHOTOS && (
        <View style={styles.photoButtons}>
          <Pressable
            onPress={() => onAddPhoto(item, 'camera')}
            disabled={uploading}
            style={({ pressed }) => [styles.cameraBtn, pressed && { backgroundColor: colors.primarySoft }]}
            accessibilityRole="button"
            accessibilityLabel="Ambil foto dengan kamera"
          >
            {uploading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="camera" size={24} color={colors.primary} />
            )}
            <Text style={styles.cameraText}>{uploading ? 'Mengunggah…' : 'Ambil Foto'}</Text>
          </Pressable>
          <Pressable
            onPress={() => onAddPhoto(item, 'gallery')}
            disabled={uploading}
            style={({ pressed }) => [styles.galleryBtn, pressed && { backgroundColor: '#E2E8F0' }]}
            accessibilityRole="button"
            accessibilityLabel="Pilih foto dari galeri"
          >
            <Ionicons name="images-outline" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {/* Finding → work order */}
      {item.work_order ? (
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
      ) : (
        result === 'not_ok' &&
        canCreateWorkOrder && (
          <Button
            title="Buat WO dari temuan"
            icon="construct-outline"
            variant="dangerOutline"
            onPress={() => onCreateWorkOrder(item)}
          />
        )
      )}

      {!!message && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{message}</Text>
        </View>
      )}
    </View>
  );
}

/** Server-side fields that affect the card (the draft carries the editable ones). */
function itemSignature(item: PmTaskItem): string {
  const photos = (item.attachments ?? []).map((a) => a.id).join(',');
  return `${item.id}|${photos}|${item.work_order?.id ?? ''}|${item.work_order?.status ?? ''}|${item.description}`;
}

export const ChecklistItemCard = memo(
  ChecklistItemCardBase,
  (prev, next) =>
    prev.draft === next.draft &&
    prev.error === next.error &&
    prev.uploading === next.uploading &&
    prev.no === next.no &&
    prev.token === next.token &&
    prev.canCreateWorkOrder === next.canCreateWorkOrder &&
    prev.onChange === next.onChange &&
    prev.onAddPhoto === next.onAddPhoto &&
    prev.onDeletePhoto === next.onDeletePhoto &&
    prev.canDeletePhoto === next.canDeletePhoto &&
    prev.onCreateWorkOrder === next.onCreateWorkOrder &&
    prev.onOpenWorkOrder === next.onOpenWorkOrder &&
    itemSignature(prev.item) === itemSignature(next.item),
);

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardFinding: { borderColor: resultTones.not_ok.border, backgroundColor: '#FFFBFB' },
  cardError: { borderColor: colors.danger, borderWidth: 2 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  description: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 24 },
  no: { color: colors.textSubtle },
  required: { color: colors.danger },
  resultRow: { flexDirection: 'row', gap: 8 },
  resultBtn: {
    flex: 1,
    minHeight: 68,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  resultLabel: { fontSize: 16, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputRowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  numberInput: {
    flex: 1,
    minHeight: 60,
    borderWidth: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  textInput: {
    flex: 1,
    minHeight: 96,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 17,
    color: colors.text,
  },
  inputDisabled: { backgroundColor: '#F1F5F9', borderColor: colors.border },
  unit: { fontSize: 18, fontWeight: '700', color: colors.textMuted, minWidth: 24 },
  naToggle: {
    minWidth: 60,
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  naToggleActive: { backgroundColor: resultTones.na.fg, borderColor: resultTones.na.fg },
  naText: { fontSize: 15, fontWeight: '800', color: colors.textMuted },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  rangeHint: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verdictText: { fontSize: 14, fontWeight: '800' },
  notesInput: {
    minHeight: 64,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  addNotes: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  addNotesText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  photoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoTitle: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoBadgeMissing: { backgroundColor: colors.dangerSoft },
  photoBadgeOk: { backgroundColor: colors.successSoft },
  photoBadgeText: { fontSize: 13, fontWeight: '800' },
  photoButtons: { flexDirection: 'row', gap: 10 },
  cameraBtn: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  cameraText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  galleryBtn: {
    width: 60,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  woLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  woNumber: { fontSize: 15, fontWeight: '800', color: colors.primary },
  woStatus: { fontSize: 13, color: colors.textMuted },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { flex: 1, color: colors.danger, fontSize: 15, fontWeight: '700' },
});
