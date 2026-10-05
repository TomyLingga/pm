import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/lib/theme';
import { Button, type ButtonVariant } from './ui';

export interface BarAction {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Sticky bottom action bar: compact secondary actions on top, large primary actions below.
 * Renders nothing when there are no actions (actions are derived from server `permissions`).
 */
export function ActionBar({
  primary,
  secondary,
  busy = false,
}: {
  primary: BarAction[];
  secondary: BarAction[];
  /** Disable everything except the action currently loading. */
  busy?: boolean;
}) {
  const insets = useSafeAreaInsets();
  if (primary.length + secondary.length === 0) return null;
  return (
    <View style={[styles.bar, { paddingBottom: 12 + insets.bottom }]}>
      {secondary.length > 0 && (
        <View style={styles.row}>
          {secondary.map((a) => (
            <Button
              key={a.key}
              compact
              title={a.title}
              icon={a.icon}
              variant={a.variant ?? 'secondary'}
              onPress={a.onPress}
              loading={a.loading}
              disabled={a.disabled || (busy && !a.loading)}
              style={styles.btn}
            />
          ))}
        </View>
      )}
      {primary.length > 0 && (
        <View style={styles.row}>
          {primary.map((a) => (
            <Button
              key={a.key}
              title={a.title}
              icon={a.icon}
              variant={a.variant ?? 'primary'}
              onPress={a.onPress}
              loading={a.loading}
              disabled={a.disabled || (busy && !a.loading)}
              style={styles.btn}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  btn: { flexGrow: 1, flexBasis: '40%' },
});
