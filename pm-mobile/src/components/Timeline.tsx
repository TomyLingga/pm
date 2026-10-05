import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatDateTime } from '@/lib/format';
import { colors, type Tone } from '@/lib/theme';
import type { WorkOrderLog } from '@/lib/types';
import { MutedText } from './ui';

/** Status/audit log timeline, newest first. */
export function Timeline({ logs, toneFor }: { logs: WorkOrderLog[]; toneFor: (status: string | null) => Tone }) {
  const sorted = [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!sorted.length) return <MutedText>Belum ada riwayat.</MutedText>;
  return (
    <View>
      {sorted.map((log, i) => (
        <View key={log.id} style={styles.row}>
          <View style={styles.rail}>
            <View style={[styles.dot, { backgroundColor: toneFor(log.to_status).fg }]} />
            {i < sorted.length - 1 && <View style={styles.line} />}
          </View>
          <View style={styles.body}>
            <Text style={styles.action}>{log.action_label}</Text>
            <Text style={styles.meta}>
              {[log.user?.name, formatDateTime(log.created_at)].filter(Boolean).join(' · ')}
            </Text>
            {!!log.notes && <Text style={styles.notes}>{log.notes}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, paddingBottom: 16, gap: 2 },
  action: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textSubtle },
  notes: { fontSize: 15, color: colors.textMuted, marginTop: 2 },
});
