import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMonthYear, todayWib } from '@/lib/format';
import { colors, radius } from '@/lib/theme';

export interface YearMonth {
  year: number;
  month: number;
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function currentYearMonth(): YearMonth {
  const t = todayWib();
  return { year: t.year, month: t.month };
}

/** "<  Oktober 2026  >" with a shortcut back to the current month. */
export function MonthNavigator({ value, onChange }: { value: YearMonth; onChange: (next: YearMonth) => void }) {
  const now = currentYearMonth();
  const isCurrent = now.year === value.year && now.month === value.month;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bulan sebelumnya"
        onPress={() => onChange(shiftMonth(value, -1))}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isCurrent ? formatMonthYear(value.year, value.month) : 'Kembali ke bulan ini'}
        onPress={() => !isCurrent && onChange(now)}
        disabled={isCurrent}
        style={styles.center}
      >
        <Text style={styles.label}>{formatMonthYear(value.year, value.month)}</Text>
        {!isCurrent && <Text style={styles.today}>Bulan ini</Text>}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bulan berikutnya"
        onPress={() => onChange(shiftMonth(value, 1))}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-forward" size={24} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.primarySoft },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  label: { fontSize: 17, fontWeight: '800', color: colors.text },
  today: { fontSize: 12, fontWeight: '600', color: colors.primary },
});
