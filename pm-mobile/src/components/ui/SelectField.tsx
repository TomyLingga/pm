import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/lib/theme';
import { FieldError, FieldLabel } from './TextField';

interface SelectFieldProps {
  label?: string;
  required?: boolean;
  value?: string | null;
  subtitle?: string | null;
  placeholder: string;
  onPress: () => void;
  onClear?: () => void;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

/** Tappable field that opens a picker (modal) — large target for field use. */
export function SelectField({
  label,
  required,
  value,
  subtitle,
  placeholder,
  onPress,
  onClear,
  error,
  icon = 'search',
  disabled,
}: SelectFieldProps) {
  return (
    <View style={styles.wrapper}>
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.field,
          !!error && { borderColor: colors.danger },
          pressed && { backgroundColor: '#F8FAFC' },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Ionicons name={icon} size={22} color={colors.textSubtle} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={2}>
            {value || placeholder}
          </Text>
          {!!value && !!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {value && onClear ? (
          <Pressable onPress={onClear} hitSlop={12} accessibilityLabel="Hapus pilihan" style={styles.clear}>
            <Ionicons name="close-circle" size={24} color={colors.textSubtle} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={22} color={colors.textSubtle} />
        )}
      </Pressable>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  field: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  value: { fontSize: 17, color: colors.text, fontWeight: '600' },
  placeholder: { color: '#94A3B8', fontWeight: '400' },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  clear: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
