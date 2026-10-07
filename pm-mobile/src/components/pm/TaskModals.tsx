import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { digitsOnly, formatDuration } from '@/lib/format';
import { colors } from '@/lib/theme';
import { StaffRadioList } from '../StaffRadioList';
import { Button, ModalSheet, TextField } from '../ui';

interface CompleteTaskModalProps {
  visible: boolean;
  /** Minutes since the task was started (prefill). */
  elapsedMinutes: number | null;
  estimatedMinutes: number | null;
  initialNotes: string;
  loading: boolean;
  /** Server validation messages for `duration_minutes` / `notes`. */
  errors: { duration_minutes?: string; notes?: string };
  onClose: () => void;
  onSubmit: (durationMinutes: number | null, notes: string) => void;
}

/** "Selesaikan": working duration (minutes) and closing notes. */
export function CompleteTaskModal({
  visible,
  elapsedMinutes,
  estimatedMinutes,
  initialNotes,
  loading,
  errors,
  onClose,
  onSubmit,
}: CompleteTaskModalProps) {
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | undefined>();

  useEffect(() => {
    if (!visible) return;
    setDuration(elapsedMinutes !== null ? String(elapsedMinutes) : '');
    setNotes(initialNotes);
    setLocalError(undefined);
    // Only reset when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = () => {
    const digits = digitsOnly(duration);
    const minutes = digits ? Number(digits) : null;
    if (minutes !== null && minutes <= 0) {
      setLocalError('Durasi harus lebih dari 0 menit.');
      return;
    }
    setLocalError(undefined);
    onSubmit(minutes, notes.trim());
  };

  const minutes = digitsOnly(duration) ? Number(digitsOnly(duration)) : null;

  return (
    <ModalSheet
      visible={visible}
      title="Selesaikan Tugas PM"
      onClose={onClose}
      footer={
        <>
          <Button title="Kembali" variant="secondary" onPress={onClose} style={{ flex: 1 }} disabled={loading} />
          <Button
            title="Selesai"
            icon="checkmark-done"
            variant="success"
            onPress={submit}
            loading={loading}
            style={{ flex: 1.4 }}
          />
        </>
      }
    >
      <Text style={{ fontSize: 15, color: colors.textMuted }}>
        Pastikan semua butir checklist sudah benar. Setelah selesai, hasil tidak dapat diubah.
      </Text>
      <TextField
        label="Durasi pengerjaan (menit)"
        value={duration}
        onChangeText={(t) => setDuration(digitsOnly(t))}
        keyboardType="number-pad"
        placeholder="mis. 45"
        hint={[
          minutes ? `= ${formatDuration(minutes)}` : null,
          elapsedMinutes !== null ? `sejak mulai: ${formatDuration(elapsedMinutes)}` : null,
          estimatedMinutes ? `estimasi: ${formatDuration(estimatedMinutes)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        error={localError ?? errors.duration_minutes}
      />
      <TextField
        label="Catatan"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        placeholder="Catatan hasil PM (opsional)"
        error={errors.notes}
      />
    </ModalSheet>
  );
}

interface PicModalProps {
  visible: boolean;
  executorUnitId: number;
  currentPicId: number | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (picUserId: number) => void;
}

/** "Ganti PIC" (unit lead): pick another staff member of the executor unit. */
export function PicModal({ visible, executorUnitId, currentPicId, loading, onClose, onSubmit }: PicModalProps) {
  const [picId, setPicId] = useState<number | null>(currentPicId);

  useEffect(() => {
    if (visible) setPicId(currentPicId);
  }, [visible, currentPicId]);

  const canSubmit = picId !== null && picId !== currentPicId;

  return (
    <ModalSheet
      visible={visible}
      title="Ganti PIC Tugas"
      onClose={onClose}
      footer={
        <>
          <Button title="Batal" variant="secondary" onPress={onClose} style={{ flex: 1 }} disabled={loading} />
          <Button
            title="Simpan"
            icon="checkmark"
            onPress={() => picId !== null && onSubmit(picId)}
            disabled={!canSubmit}
            loading={loading}
            style={{ flex: 1.4 }}
          />
        </>
      }
    >
      <StaffRadioList
        executorUnitId={executorUnitId}
        value={picId}
        onChange={setPicId}
        enabled={visible}
        label="Pilih PIC baru"
      />
    </ModalSheet>
  );
}
