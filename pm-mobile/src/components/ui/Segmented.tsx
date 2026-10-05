import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, TOUCH } from '@/lib/theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Active color for this segment (defaults to primary). */
  color?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        const activeColor = o.color ?? colors.primary;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: activeColor, borderColor: activeColor }]}
          >
            <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  text: { fontSize: 16, fontWeight: '700', color: colors.text },
  textSelected: { color: colors.white },
});
