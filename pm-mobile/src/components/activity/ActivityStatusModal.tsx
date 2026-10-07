import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { activityStatusTones, colors, DAILY_ACTIVITY_STATUS_OPTIONS } from '@/lib/theme';
import type { DailyActivityStatus } from '@/lib/types';
import { Button, FieldError, FieldLabel, ModalSheet, Segmented, TextField } from '../ui';

interface ActivityStatusModalProps {
  visible: boolean;
  current: DailyActivityStatus;
  currentLabel: string;
  loading: boolean;
  /** Server validation messages (`status`, `notes`). */
  errors?: { status?: string; notes?: string };
  onClose: () => void;
  onSubmit: (status: DailyActivityStatus, notes: string) => void;
}

/** "Update Status" of a daily activity: pick a different status + optional notes. */
export function ActivityStatusModal({
  visible,
  current,
  currentLabel,
  loading,
  errors,
  onClose,
  onSubmit,
}: ActivityStatusModalProps) {
  const [status, setStatus] = useState<DailyActivityStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | undefined>();

  useEffect(() => {
    if (!visible) return;
    setStatus(null);
    setNotes('');
    setLocalError(undefined);
  }, [visible]);

  const submit = () => {
    if (!status) {
      setLocalError('Pilih status baru.');
      return;
    }
    if (status === current) {
      setLocalError('Status sama dengan status saat ini.');
      return;
    }
    setLocalError(undefined);
    onSubmit(status, notes.trim());
  };

  return (
    <ModalSheet
      visible={visible}
      title="Update Status Aktivitas"
      onClose={onClose}
      footer={
        <>
          <Button title="Batal" variant="secondary" onPress={onClose} style={{ flex: 1 }} disabled={loading} />
          <Button title="Simpan" icon="checkmark" onPress={submit} loading={loading} style={{ flex: 1.4 }} />
        </>
      }
    >
      <Text style={styles.current}>
        Status saat ini: <Text style={styles.currentValue}>{currentLabel}</Text>
      </Text>
      <View style={{ gap: 6 }}>
        <FieldLabel required>Status baru</FieldLabel>
        <Segmented<DailyActivityStatus>
          options={DAILY_ACTIVITY_STATUS_OPTIONS.filter((o) => o.value !== current).map((o) => ({
            ...o,
            color: activityStatusTones[o.value].fg,
          }))}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setLocalError(undefined);
          }}
        />
        <FieldError message={localError ?? errors?.status} />
      </View>
      <TextField
        label="Catatan"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        placeholder="Catatan perubahan status (opsional)"
        error={errors?.notes}
      />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  current: { fontSize: 15, color: colors.textMuted },
  currentValue: { fontWeight: '800', color: colors.text },
});
