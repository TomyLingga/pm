import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime } from '@/lib/format';
import { colors, radius } from '@/lib/theme';
import { Button, FieldError, ModalSheet } from './ui';

interface DateTimeFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  error?: string;
  maximumDate?: Date;
}

/** Date + time picker. Android: native date dialog followed by a 24h time dialog. */
export function DateTimeField({ label, value, onChange, error, maximumDate }: DateTimeFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosValue, setIosValue] = useState<Date>(value ?? new Date());

  const open = () => {
    const initial = value ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        maximumDate,
        onChange: (event, date) => {
          if (event.type !== 'set' || !date) return;
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
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDateTime(value) : 'belum diisi'}`}
        style={({ pressed }) => [styles.field, !!error && { borderColor: colors.danger }, pressed && { backgroundColor: '#F8FAFC' }]}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.textSubtle} />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatDateTime(value) : 'Pilih waktu'}
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
            mode="datetime"
            display="inline"
            maximumDate={maximumDate}
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
