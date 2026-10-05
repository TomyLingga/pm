import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CLEARANCE_OPTIONS, clearanceItems, clearanceLabel } from '@/lib/clearance';
import { parseDecimal } from '@/lib/format';
import { colors, radius } from '@/lib/theme';
import type { AcceptBody, ClearanceResult, WorkOrderDetail } from '@/lib/types';
import { Button, FieldError, FieldLabel, ModalSheet, Segmented, TextField } from '../ui';

interface AcceptModalProps {
  visible: boolean;
  workOrder: WorkOrderDetail;
  loading: boolean;
  onClose: () => void;
  onSubmit: (body: AcceptBody) => void;
}

type Answer = 'yes' | 'no';

/** "Konfirmasi Penerimaan" by the requester: Yes (clearance + breakdown) or No (reason). */
export function AcceptModal({ visible, workOrder, loading, onClose, onSubmit }: AcceptModalProps) {
  const items = clearanceItems(workOrder.clearances);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [results, setResults] = useState<Record<number, ClearanceResult | undefined>>({});
  const [breakdown, setBreakdown] = useState('');
  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    setAnswer(null);
    setResults({});
    setBreakdown(workOrder.total_breakdown_hours != null ? String(workOrder.total_breakdown_hours) : '');
    setRemarks('');
    setReason('');
    setErrors({});
  }, [visible, workOrder.total_breakdown_hours]);

  const submit = () => {
    const e: Record<string, string> = {};
    if (!answer) e.answer = 'Pilih Ya atau Tidak.';
    if (answer === 'no' && !reason.trim()) e.reason = 'Alasan wajib diisi bila pekerjaan tidak diterima.';
    if (answer === 'yes') {
      for (const it of items) if (!results[it.item_no]) e[`c${it.item_no}`] = 'Pilih OK atau TDK.';
      if (breakdown.trim() && parseDecimal(breakdown) === null) e.breakdown = 'Isi angka jam, mis. 1,5.';
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    if (answer === 'no') {
      onSubmit({ acceptance: 'no', reason: reason.trim() });
    } else {
      onSubmit({
        acceptance: 'yes',
        clearance: items.map((it) => ({ item_no: it.item_no, result: results[it.item_no] as ClearanceResult })),
        total_breakdown_hours: parseDecimal(breakdown),
        remarks: remarks.trim() || null,
      });
    }
  };

  return (
    <ModalSheet
      visible={visible}
      title="Konfirmasi Penerimaan Pekerjaan"
      onClose={onClose}
      footer={
        <>
          <Button title="Batal" variant="secondary" onPress={onClose} style={{ flex: 1 }} disabled={loading} />
          <Button
            title="Kirim"
            icon="send"
            variant={answer === 'no' ? 'danger' : 'primary'}
            onPress={submit}
            loading={loading}
            style={{ flex: 1.4 }}
          />
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <FieldLabel required>Apakah pekerjaan diterima?</FieldLabel>
        <Segmented
          options={[
            { value: 'yes', label: 'Ya, diterima', color: colors.success },
            { value: 'no', label: 'Tidak', color: colors.danger },
          ]}
          value={answer}
          onChange={setAnswer}
        />
        <FieldError message={errors.answer} />
      </View>

      {answer === 'yes' && (
        <>
          <Text style={styles.sectionTitle}>Clearance Checklist (User)</Text>
          {items.map((it) => {
            const mtc = workOrder.clearances?.find((c) => c.item_no === it.item_no)?.mtc_result;
            return (
              <View key={it.item_no} style={styles.clearance}>
                <Text style={styles.clearanceLabel}>
                  {it.item_no}. {it.item_label}
                </Text>
                <Text style={styles.mtc}>Hasil teknisi: {clearanceLabel(mtc)}</Text>
                <Segmented
                  options={CLEARANCE_OPTIONS}
                  value={results[it.item_no] ?? null}
                  onChange={(v) => setResults((prev) => ({ ...prev, [it.item_no]: v }))}
                />
                <FieldError message={errors[`c${it.item_no}`]} />
              </View>
            );
          })}
          <TextField
            label="Total Breakdown (jam)"
            value={breakdown}
            onChangeText={setBreakdown}
            keyboardType="decimal-pad"
            placeholder="mis. 1,5"
            error={errors.breakdown}
          />
          <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline numberOfLines={3} />
        </>
      )}

      {answer === 'no' && (
        <TextField
          label="Alasan pekerjaan tidak diterima"
          required
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={4}
          hint="WO akan dikembalikan ke teknisi untuk dikerjakan ulang."
          error={errors.reason}
        />
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  clearance: {
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearanceLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  mtc: { fontSize: 14, color: colors.textMuted },
});
