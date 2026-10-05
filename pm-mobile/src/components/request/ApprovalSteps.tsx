import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime } from '@/lib/format';
import { colors, radius, stepStatusTone } from '@/lib/theme';
import type { ApprovalStep, Signature } from '@/lib/types';
import { MutedText, ToneBadge } from '../ui';

// Block labels of the paper form INLHO/BSIS-ITC/F-004.
const BLOCK_LABELS: Record<string, string> = {
  submission: 'YANG BERSANGKUTAN',
  superior: 'ATASAN YBS',
  executor_lead: 'MGR/SPV DIVISI',
  executor: 'FOREMAN DIVISI',
};

const ACTED_VERBS: Record<string, string> = {
  submission: 'Diminta oleh',
  superior: 'Disetujui oleh',
  executor_lead: 'Disetujui oleh',
  executor: 'Diselesaikan oleh',
};

function verbFor(step: ApprovalStep): string {
  if (step.status === 'rejected') return 'Ditolak oleh';
  if (step.status === 'revision_requested') return 'Diminta revisi oleh';
  if (step.status === 'cancelled') return 'Dibatalkan oleh';
  return ACTED_VERBS[step.key] ?? 'Diproses oleh';
}

function StepCard({ step, signature }: { step: ApprovalStep; signature?: Signature }) {
  const tone = stepStatusTone(step.status);
  const acted = !!step.acted_at;
  return (
    <View style={[styles.step, step.status === 'pending' && styles.stepPending]}>
      <View style={styles.stepHeader}>
        <Text style={styles.blockLabel}>{BLOCK_LABELS[step.key] ?? step.label.toUpperCase()}</Text>
        <ToneBadge label={step.status_label} tone={tone} dot />
      </View>
      {acted ? (
        <Text style={styles.actedLine}>
          {verbFor(step)} <Text style={styles.bold}>{step.acted_by?.name ?? step.assignee_label ?? '-'}</Text> pada{' '}
          {formatDateTime(step.acted_at)}
        </Text>
      ) : step.status === 'pending' ? (
        <Text style={styles.waitingLine}>
          Menunggu tindakan: <Text style={styles.bold}>{step.assignee_label ?? step.assignee_user?.name ?? '-'}</Text>
          {step.activated_at ? ` (sejak ${formatDateTime(step.activated_at)})` : ''}
        </Text>
      ) : step.status === 'skipped' ? (
        <Text style={styles.muted}>Langkah dilewati.</Text>
      ) : (
        <Text style={styles.muted}>
          {step.assignee_label ? `Belum giliran — ${step.assignee_label}` : 'Belum giliran.'}
        </Text>
      )}
      {!!step.actor_phone && (
        <Pressable onPress={() => void Linking.openURL(`tel:${step.actor_phone}`)} style={styles.phone} accessibilityRole="link">
          <Text style={styles.phoneLabel}>NO. HP</Text>
          <Text style={styles.phoneValue}>{step.actor_phone}</Text>
          <Ionicons name="call-outline" size={16} color={colors.primary} />
        </Pressable>
      )}
      {!!step.notes && (
        <View style={styles.notes}>
          <Text style={styles.notesText}>Catatan: {step.notes}</Text>
        </View>
      )}
      {!!signature?.verify_url && (
        <Pressable
          onPress={() => void Linking.openURL(signature.verify_url as string)}
          style={styles.verify}
          accessibilityRole="link"
        >
          <Ionicons name="qr-code-outline" size={16} color={colors.primary} />
          <Text style={styles.verifyText}>Verifikasi tanda tangan</Text>
        </Pressable>
      )}
    </View>
  );
}

const roundTitle = (round: number) => (round === 0 ? 'Pengajuan awal' : `Revisi ke-${round}`);

/** PENGESAHAN block: current round expanded, earlier rounds collapsed. */
export function ApprovalSteps({
  steps,
  history,
  signatures,
}: {
  steps: ApprovalStep[];
  history: ApprovalStep[];
  signatures: Signature[];
}) {
  const [showHistory, setShowHistory] = useState(false);
  const current = useMemo(() => [...steps].sort((a, b) => a.order - b.order), [steps]);
  const currentRound = current[0]?.round;

  const earlierRounds = useMemo(() => {
    const byRound = new Map<number, ApprovalStep[]>();
    for (const s of history ?? []) {
      if (currentRound !== undefined && s.round === currentRound) continue;
      byRound.set(s.round, [...(byRound.get(s.round) ?? []), s]);
    }
    return [...byRound.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([round, list]) => ({ round, steps: list.sort((a, b) => a.order - b.order) }));
  }, [history, currentRound]);

  const sigFor = (key: string) => signatures?.find((s) => s.role_key === key);

  return (
    <View style={{ gap: 10 }}>
      {current.length ? (
        current.map((s) => <StepCard key={s.id} step={s} signature={sigFor(s.key)} />)
      ) : (
        <MutedText>Belum diajukan.</MutedText>
      )}

      {earlierRounds.length > 0 && (
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => setShowHistory((v) => !v)}
            style={styles.historyToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: showHistory }}
          >
            <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
            <Text style={styles.historyToggleText}>
              {showHistory ? 'Sembunyikan' : 'Tampilkan'} putaran sebelumnya ({earlierRounds.length})
            </Text>
          </Pressable>
          {showHistory &&
            earlierRounds.map((r) => (
              <View key={r.round} style={styles.round}>
                <Text style={styles.roundTitle}>{roundTitle(r.round)}</Text>
                {r.steps.map((s) => (
                  <StepCard key={s.id} step={s} />
                ))}
              </View>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  step: {
    gap: 6,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
  },
  stepPending: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  blockLabel: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.text, letterSpacing: 0.4 },
  actedLine: { fontSize: 15, color: colors.text, lineHeight: 21 },
  waitingLine: { fontSize: 15, color: '#92400E', lineHeight: 21 },
  bold: { fontWeight: '700' },
  muted: { fontSize: 14, color: colors.textSubtle },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  phoneLabel: { fontSize: 12, fontWeight: '700', color: colors.textSubtle },
  phoneValue: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  notes: { padding: 8, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  notesText: { fontSize: 14, color: colors.textMuted },
  verify: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  verifyText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  historyToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  historyToggleText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  round: { gap: 8, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: colors.border },
  roundTitle: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
});
