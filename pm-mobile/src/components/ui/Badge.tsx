import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { priorityTone, statusTone, type Tone } from '@/lib/theme';

function Badge({ label, tone, dot = false }: { label: string; tone: Tone; dot?: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      {dot && <View style={[styles.dot, { backgroundColor: tone.fg }]} />}
      <Text style={[styles.text, { color: tone.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Work order status by default; pass `tone` for other document types (e.g. Form Request). */
export function StatusBadge({ status, label, tone }: { status: string; label: string; tone?: Tone }) {
  return <Badge label={label} tone={tone ?? statusTone(status)} dot />;
}

export function ToneBadge({ label, tone, dot }: { label: string; tone: Tone; dot?: boolean }) {
  return <Badge label={label} tone={tone} dot={dot} />;
}

export function PriorityBadge({ priority, label }: { priority: string; label: string }) {
  return <Badge label={label} tone={priorityTone(priority)} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
});
