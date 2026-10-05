import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, TOUCH } from '@/lib/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'dangerOutline';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const variantStyles: Record<ButtonVariant, { bg: string; bgPressed: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, bgPressed: colors.primaryPressed, fg: colors.white, border: colors.primary },
  secondary: { bg: colors.surface, bgPressed: '#EEF2FF', fg: colors.primary, border: colors.primary },
  danger: { bg: colors.danger, bgPressed: '#B91C1C', fg: colors.white, border: colors.danger },
  dangerOutline: { bg: colors.surface, bgPressed: colors.dangerSoft, fg: colors.danger, border: colors.danger },
  success: { bg: colors.success, bgPressed: '#15803D', fg: colors.white, border: colors.success },
  ghost: { bg: 'transparent', bgPressed: '#E2E8F0', fg: colors.primary, border: 'transparent' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: pressed ? v.bgPressed : v.bg, borderColor: v.border },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          icon && <Ionicons name={icon} size={compact ? 18 : 22} color={v.fg} />
        )}
        <Text style={[styles.label, compact && styles.labelCompact, { color: v.fg }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  compact: { minHeight: 44, paddingHorizontal: 12 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 17, fontWeight: '700' },
  labelCompact: { fontSize: 15 },
  disabled: { opacity: 0.5 },
});
