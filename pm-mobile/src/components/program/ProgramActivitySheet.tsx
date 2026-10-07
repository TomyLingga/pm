import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { digitsOnly, formatDateTime, formatYmd } from '@/lib/format';
import { activityStatusTone, activityStatusTones, colors, PROGRAM_ACTIVITY_STATUS_OPTIONS, radius } from '@/lib/theme';
import type { ProgramActivity, ProgramActivityStatus } from '@/lib/types';
import { Button, FieldError, FieldLabel, InfoRow, ModalSheet, Segmented, StatusBadge, TextField } from '../ui';
import { PicChips } from './ProgramActivityRow';
import { ProgressBar } from './ProgressBar';

export interface ProgressErrors {
  progress_pct?: string;
  remarks?: string;
}

export interface StatusErrors {
  status?: string;
  notes?: string;
}

interface ProgramActivitySheetProps {
  activity: ProgramActivity | null;
  itemCode: string;
  myId: number | null;
  savingProgress: boolean;
  savingStatus: boolean;
  progressErrors: ProgressErrors;
  statusErrors: StatusErrors;
  onClose: () => void;
  onSaveProgress: (progressPct: number, remarks: string) => void;
  onChangeStatus: (status: ProgramActivityStatus, notes: string) => void;
  /** Opens the daily-activity form linked to this activity (PIC only). */
  onReportActivity?: (activity: ProgramActivity) => void;
}

const STEP = 10;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Bottom sheet of one programme activity: details (read-only), and, when permitted,
 * progress + remarks (`PUT`) and status + notes (`POST .../status`).
 */
export function ProgramActivitySheet({
  activity,
  itemCode,
  myId,
  savingProgress,
  savingStatus,
  progressErrors,
  statusErrors,
  onClose,
  onSaveProgress,
  onChangeStatus,
  onReportActivity,
}: ProgramActivitySheetProps) {
  const [progress, setProgress] = useState('0');
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState<ProgramActivityStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [localStatusError, setLocalStatusError] = useState<string | undefined>();

  const visible = !!activity;
  const activityId = activity?.id;

  // Reset the form each time another activity is opened.
  useEffect(() => {
    if (!activity) return;
    setProgress(String(activity.progress_pct ?? 0));
    setRemarks(activity.remarks ?? '');
    setStatus(null);
    setNotes('');
    setLocalStatusError(undefined);
    // Only when the sheet opens for a (different) activity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  if (!activity) return null;

  const p = activity.permissions ?? { can_update_progress: false, can_change_status: false, can_edit: false, can_delete: false };
  const canProgress = !!p.can_update_progress && activity.status !== 'closed' && activity.status !== 'cancelled';
  const canStatus = !!p.can_change_status;
  const tone = activityStatusTone(activity.status);
  const pct = clamp(Number(digitsOnly(progress) || 0));
  const progressDirty = pct !== (activity.progress_pct ?? 0) || remarks.trim() !== (activity.remarks ?? '').trim();
  const busy = savingProgress || savingStatus;

  const bump = (delta: number) => setProgress(String(clamp(pct + delta)));

  const submitStatus = () => {
    if (!status) {
      setLocalStatusError('Pilih status baru.');
      return;
    }
    setLocalStatusError(undefined);
    onChangeStatus(status, notes.trim());
  };

  return (
    <ModalSheet
      visible={visible}
      title={`Kegiatan ${itemCode}.${activity.sequence}`}
      onClose={onClose}
      footer={<Button title="Tutup" variant="secondary" onPress={onClose} style={{ flex: 1 }} disabled={busy} />}
    >
      <View style={styles.head}>
        <StatusBadge status={activity.status} label={activity.status_label} tone={tone} />
        <Text style={styles.title}>{activity.title}</Text>
        <ProgressBar value={activity.progress_pct} />
      </View>

      <View style={styles.info}>
        {!!activity.action_plan && <InfoRow label="Action to be taken" value={activity.action_plan} />}
        <InfoRow label="PIC" value={<PicChips pics={activity.pics} highlightId={myId} />} />
        <View style={styles.twoCols}>
          <View style={{ flex: 1 }}>
            <InfoRow label="Target" value={activity.target_date ? formatYmd(activity.target_date) : null} />
          </View>
          <View style={{ flex: 1 }}>
            <InfoRow label="Closed" value={activity.closed_date ? formatYmd(activity.closed_date) : null} />
          </View>
        </View>
        {!canProgress && !!activity.remarks && <InfoRow label="Remarks" value={activity.remarks} />}
        <InfoRow
          label="Aktivitas harian terkait"
          value={`${activity.daily_activities_count ?? 0} laporan · diperbarui ${formatDateTime(activity.updated_at)}`}
        />
      </View>

      {canProgress && (
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Ionicons name="speedometer-outline" size={20} color={colors.primary} />
            <Text style={styles.blockTitle}>Update Progress</Text>
          </View>
          <FieldLabel>Progress (%)</FieldLabel>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Kurangi ${STEP} persen`}
              onPress={() => bump(-STEP)}
              disabled={pct <= 0 || busy}
              style={({ pressed }) => [styles.stepBtn, (pct <= 0 || busy) && styles.stepDisabled, pressed && styles.stepPressed]}
            >
              <Ionicons name="remove" size={26} color={colors.primary} />
            </Pressable>
            <TextField
              value={progress}
              onChangeText={(t) => setProgress(digitsOnly(t).slice(0, 3))}
              onBlur={() => setProgress(String(pct))}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.stepInput}
              textAlign="center"
              accessibilityLabel="Persentase progress"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Tambah ${STEP} persen`}
              onPress={() => bump(STEP)}
              disabled={pct >= 100 || busy}
              style={({ pressed }) => [styles.stepBtn, (pct >= 100 || busy) && styles.stepDisabled, pressed && styles.stepPressed]}
            >
              <Ionicons name="add" size={26} color={colors.primary} />
            </Pressable>
          </View>
          <FieldError message={progressErrors.progress_pct} />
          <Text style={styles.hint}>
            Mengisi progress lebih dari 0 pada kegiatan Open otomatis menjadikannya On Progress. Progress 100 tidak
            otomatis menutup kegiatan; gunakan ubah status Closed.
          </Text>
          <TextField
            label="Remarks"
            value={remarks}
            onChangeText={setRemarks}
            multiline
            numberOfLines={3}
            placeholder="Keterangan / catatan progress (opsional)"
            error={progressErrors.remarks}
          />
          <Button
            title="Simpan Progress"
            icon="save-outline"
            onPress={() => onSaveProgress(pct, remarks.trim())}
            loading={savingProgress}
            disabled={!progressDirty || savingStatus}
          />
        </View>
      )}

      {canStatus && (
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Ionicons name="swap-horizontal-outline" size={20} color={colors.primary} />
            <Text style={styles.blockTitle}>Ubah Status</Text>
          </View>
          <Segmented<ProgramActivityStatus>
            options={PROGRAM_ACTIVITY_STATUS_OPTIONS.filter((o) => o.value !== activity.status).map((o) => ({
              ...o,
              color: activityStatusTones[o.value].fg,
            }))}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setLocalStatusError(undefined);
            }}
          />
          <FieldError message={localStatusError ?? statusErrors.status} />
          {status === 'closed' && (
            <Text style={styles.hint}>Closed: progress menjadi 100% dan tanggal closed diisi hari ini.</Text>
          )}
          {status === 'open' && <Text style={styles.hint}>Open: progress dikembalikan ke 0%.</Text>}
          {status === 'cancelled' && (
            <Text style={styles.hint}>Dibatalkan: kegiatan tidak dihitung dalam progress program.</Text>
          )}
          <TextField
            label="Catatan"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Catatan perubahan status (opsional)"
            error={statusErrors.notes}
          />
          <Button
            title="Simpan Status"
            icon="checkmark"
            variant={status === 'closed' ? 'success' : status === 'cancelled' ? 'dangerOutline' : 'primary'}
            onPress={submitStatus}
            loading={savingStatus}
            disabled={savingProgress}
          />
        </View>
      )}

      {canProgress && onReportActivity && (
        <Button
          title="Catat Aktivitas Harian"
          icon="calendar-number-outline"
          variant="secondary"
          onPress={() => onReportActivity(activity)}
          disabled={busy}
        />
      )}

      {!canProgress && !canStatus && (
        <Text style={styles.readonly}>Hanya PIC kegiatan atau pimpinan unit yang dapat mengubah progress dan status.</Text>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  head: { gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, lineHeight: 24 },
  info: { gap: 12 },
  twoCols: { flexDirection: 'row', gap: 12 },
  block: {
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 56,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: { backgroundColor: colors.primarySoft },
  stepDisabled: { opacity: 0.4 },
  stepInput: { fontSize: 22, fontWeight: '800', minWidth: 90 },
  hint: { fontSize: 13, color: colors.textSubtle, lineHeight: 18 },
  readonly: { fontSize: 14, color: colors.textSubtle, textAlign: 'center', paddingVertical: 4 },
});
