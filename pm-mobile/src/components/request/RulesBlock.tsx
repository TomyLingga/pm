import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/lib/theme';

/** "PETUNJUK DAN ATURAN" block (per executor unit, snapshotted on submit) + contact footer. */
export function RulesBlock({ rules, contactFooter }: { rules: string | null; contactFooter: string | null }) {
  if (!rules && !contactFooter) return null;
  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Ionicons name="information-circle" size={20} color="#92400E" />
        <Text style={styles.title}>PETUNJUK DAN ATURAN</Text>
      </View>
      {!!rules && <Text style={styles.rules}>{rules}</Text>}
      {!!contactFooter && <Text style={styles.footer}>{contactFooter}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 8,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '800', color: '#92400E', letterSpacing: 0.4 },
  rules: { fontSize: 14, color: colors.text, lineHeight: 21 },
  footer: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
});
