import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useStaff } from '@/hooks/useWorkOrder';
import { errorMessage } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { FieldLabel } from '../ui';

function Row({
  id,
  title,
  subtitle,
  value,
  onChange,
}: {
  id: number | null;
  title: string;
  subtitle?: string;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const selected = value === id;
  return (
    <Pressable
      onPress={() => onChange(id)}
      style={[styles.row, selected && styles.rowSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={24}
        color={selected ? colors.primary : colors.textSubtle}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </Pressable>
  );
}

/** Optional "Tunjuk pelaksana" single-select used when the executor lead approves a Form Request. */
export function ExecutorPicker({
  executorUnitId,
  value,
  onChange,
  enabled,
}: {
  executorUnitId: number;
  value: number | null;
  onChange: (id: number | null) => void;
  enabled: boolean;
}) {
  const staff = useStaff(executorUnitId, enabled);

  return (
    <View style={{ gap: 8 }}>
      <FieldLabel>Tunjuk pelaksana (opsional)</FieldLabel>
      <Row id={null} title="Tidak menunjuk" subtitle="Semua staf unit pelaksana dapat menyelesaikan" value={value} onChange={onChange} />
      {staff.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
      ) : staff.isError ? (
        <Text style={styles.error}>{errorMessage(staff.error)}</Text>
      ) : (
        (staff.data ?? []).map((s) => (
          <Row
            key={s.id}
            id={s.id}
            title={s.name}
            subtitle={[s.nrk, s.position].filter(Boolean).join(' · ')}
            value={value}
            onChange={onChange}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: '#F5F7FF' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 14 },
});
