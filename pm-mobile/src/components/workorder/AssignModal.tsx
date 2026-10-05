import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useStaff } from '@/hooks/useWorkOrder';
import { errorMessage } from '@/lib/api';
import { colors, PRIORITY_OPTIONS, priorityTones, radius } from '@/lib/theme';
import type { Priority, WorkOrderDetail } from '@/lib/types';
import { Button, FieldLabel, ModalSheet, Segmented } from '../ui';

export interface AssignResult {
  assignee_ids: number[];
  lead_id: number;
  priority?: Priority;
}

interface AssignModalProps {
  visible: boolean;
  mode: 'receive' | 'reassign';
  workOrder: WorkOrderDetail;
  loading: boolean;
  onClose: () => void;
  onSubmit: (result: AssignResult) => void;
}

/** Staff multi-select with a lead, used for "Terima & Tugaskan" and "Ubah Teknisi". */
export function AssignModal({ visible, mode, workOrder, loading, onClose, onSubmit }: AssignModalProps) {
  const staff = useStaff(workOrder.executor_unit.id, visible);
  const [selected, setSelected] = useState<number[]>([]);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [priority, setPriority] = useState<Priority>(workOrder.priority);

  // Prefill with the current assignees each time the modal opens.
  useEffect(() => {
    if (!visible) return;
    const current = workOrder.assignees ?? [];
    setSelected(current.map((a) => a.id));
    setLeadId(current.find((a) => a.is_lead)?.id ?? current[0]?.id ?? null);
    setPriority(workOrder.priority);
  }, [visible, workOrder.assignees, workOrder.priority]);

  const toggle = (id: number) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    if (leadId === null || !next.includes(leadId)) setLeadId(next[0] ?? null);
  };

  const canSubmit = selected.length > 0 && leadId !== null && selected.includes(leadId);

  const submit = () => {
    if (!canSubmit || leadId === null) return;
    const result: AssignResult = { assignee_ids: selected, lead_id: leadId };
    if (mode === 'receive' && priority !== workOrder.priority) result.priority = priority;
    onSubmit(result);
  };

  return (
    <ModalSheet
      visible={visible}
      title={mode === 'receive' ? 'Terima & Tugaskan Teknisi' : 'Ubah Teknisi'}
      onClose={onClose}
      footer={
        <>
          <Button title="Batal" variant="secondary" onPress={onClose} style={{ flex: 1 }} disabled={loading} />
          <Button
            title={mode === 'receive' ? 'Terima' : 'Simpan'}
            icon="checkmark"
            onPress={submit}
            disabled={!canSubmit}
            loading={loading}
            style={{ flex: 1.4 }}
          />
        </>
      }
    >
      {mode === 'receive' && (
        <View style={{ gap: 8 }}>
          <FieldLabel>Prioritas</FieldLabel>
          <Segmented
            options={PRIORITY_OPTIONS.map((p) => ({ ...p, color: priorityTones[p.value].fg }))}
            value={priority}
            onChange={setPriority}
          />
        </View>
      )}

      <View style={{ gap: 4 }}>
        <FieldLabel required>Pilih teknisi</FieldLabel>
        <Text style={styles.hint}>Ketuk nama untuk memilih, lalu tentukan satu ketua.</Text>
      </View>

      {staff.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
      ) : staff.isError ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.error}>{errorMessage(staff.error)}</Text>
          <Button title="Coba Lagi" variant="secondary" onPress={() => void staff.refetch()} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {(staff.data ?? []).map((s) => {
            const isSelected = selected.includes(s.id);
            const isLead = leadId === s.id;
            return (
              <View key={s.id} style={[styles.row, isSelected && styles.rowSelected]}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => toggle(s.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={28}
                    color={isSelected ? colors.primary : colors.textSubtle}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{s.name}</Text>
                    <Text style={styles.sub}>
                      {[s.nrk, s.position, s.is_lead ? 'Pimpinan' : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </Pressable>
                {isSelected && (
                  <Pressable
                    onPress={() => setLeadId(s.id)}
                    style={[styles.leadBtn, isLead && styles.leadBtnActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isLead }}
                    accessibilityLabel={`Jadikan ${s.name} ketua`}
                  >
                    <Ionicons name={isLead ? 'star' : 'star-outline'} size={18} color={isLead ? colors.white : colors.primary} />
                    <Text style={[styles.leadText, isLead && { color: colors.white }]}>Ketua</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          {staff.data?.length === 0 && <Text style={styles.hint}>Tidak ada staf di unit ini.</Text>}
        </View>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 14, color: colors.textSubtle },
  error: { color: colors.danger, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingRight: 8,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: '#F5F7FF' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 60 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  leadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  leadBtnActive: { backgroundColor: colors.primary },
  leadText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
