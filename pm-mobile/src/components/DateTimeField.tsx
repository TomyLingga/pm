import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime, formatYmd, toYmd } from '@/lib/format';
import { colors, radius } from '@/lib/theme';
import { Button, FieldError, ModalSheet } from './ui';

interface DateTimeFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  error?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  /** `date` = calendar day only (no time dialog); the value is shown as "03 Okt 2026". */
  mode?: 'datetime' | 'date';
  required?: boolean;
  placeholder?: string;
}

/** Date + time picker. Android: native date dialog followed by a 24h time dialog (date mode: date only). */
export function DateTimeField({
  label,
  value,
  onChange,
  error,
  maximumDate,
  minimumDate,
  mode = 'datetime',
  required,
  placeholder,
}: DateTimeFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosValue, setIosValue] = useState<Date>(value ?? new Date());
  const dateOnly = mode === 'date';
  const display = value ? (dateOnly ? formatYmd(toYmd(value)) : formatDateTime(value)) : null;
  const hint = placeholder ?? (dateOnly ? 'Pilih tanggal' : 'Pilih waktu');

  const open = () => {
    const initial = value ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        maximumDate,
        minimumDate,
        onChange: (event, date) => {
          if (event.type !== 'set' || !date) return;
          if (dateOnly) {
            const picked = new Date(date);
            picked.setHours(12, 0, 0, 0);
            onChange(picked);
            return;
          }
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onChange: (ev, time) => {
              if (ev.type !== 'set' || !time) return;
              const picked = new Date(time);
              picked.setSeconds(0, 0);
              onChange(picked);
            },
          });
        },
      });
    } else {
      setIosValue(initial);
      setIosOpen(true);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display ?? 'belum diisi'}`}
        style={({ pressed }) => [styles.field, !!error && { borderColor: colors.danger }, pressed && { backgroundColor: '#F8FAFC' }]}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.textSubtle} />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {display ?? hint}
        </Text>
      </Pressable>
      <FieldError message={error} />

      {Platform.OS !== 'android' && (
        <ModalSheet
          visible={iosOpen}
          title={label}
          onClose={() => setIosOpen(false)}
          footer={
            <Button
              title="Pilih"
              style={{ flex: 1 }}
              onPress={() => {
                onChange(iosValue);
                setIosOpen(false);
              }}
            />
          }
        >
          <DateTimePicker
            value={iosValue}
            mode={dateOnly ? 'date' : 'datetime'}
            display="inline"
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            onChange={(_, d) => d && setIosValue(d)}
          />
        </ModalSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, gap: 4 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  required: { color: colors.danger },
  field: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
  },
  value: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  placeholder: { color: '#94A3B8', fontWeight: '400' },
});
