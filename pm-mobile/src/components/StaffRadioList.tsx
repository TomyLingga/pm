import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useStaff } from '@/hooks/useWorkOrder';
import { errorMessage } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { FieldLabel } from './ui';

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

interface StaffRadioListProps {
  executorUnitId: number;
  value: number | null;
  onChange: (id: number | null) => void;
  /** Load the staff list only while the picker is visible. */
  enabled: boolean;
  label: string;
  /** Adds a "none" choice on top (value null). */
  noneOption?: { title: string; subtitle?: string };
}

/** Single-select list of an executor unit's staff (`/executor-units/{id}/staff`). */
export function StaffRadioList({ executorUnitId, value, onChange, enabled, label, noneOption }: StaffRadioListProps) {
  const staff = useStaff(executorUnitId, enabled);

  return (
    <View style={{ gap: 8 }}>
      <FieldLabel>{label}</FieldLabel>
      {noneOption && (
        <Row id={null} title={noneOption.title} subtitle={noneOption.subtitle} value={value} onChange={onChange} />
      )}
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
            subtitle={[s.nrk, s.position, s.is_lead ? 'Pimpinan' : null].filter(Boolean).join(' · ')}
            value={value}
            onChange={onChange}
          />
        ))
      )}
      {staff.data?.length === 0 && <Text style={styles.subtitle}>Tidak ada staf di unit ini.</Text>}
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
