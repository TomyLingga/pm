import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorView, LoadingView, PriorityBadge, ToneBadge } from '@/components/ui';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/lib/api';
import { documentPath, documentRefFrom } from '@/lib/documents';
import { approvalApi } from '@/lib/endpoints';
import { formatDateTime, formatRelative } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { colors, radius } from '@/lib/theme';
import type { PendingApproval } from '@/lib/types';

const OVERDUE_TONE = { fg: '#FFFFFF', bg: '#DC2626', border: '#DC2626' };
const TYPE_TONE = { fg: '#1E3A8A', bg: '#E0E7FF', border: '#A5B4FC' };

function ApprovalCard({ item, onPress }: { item: PendingApproval; onPress: (item: PendingApproval) => void }) {
  const actionText = item.action === 'complete' ? 'Perlu diselesaikan' : 'Perlu persetujuan';
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.document_type_label} ${item.document_number ?? ''}, ${item.step_label}`}
      style={({ pressed }) => [
        styles.card,
        item.overdue && styles.cardOverdue,
        pressed && { backgroundColor: '#F8FAFC' },
      ]}
    >
      <View style={styles.row}>
        <Text style={styles.number} numberOfLines={1}>
          {item.document_number ?? '(tanpa nomor)'}
        </Text>
        <ToneBadge label={item.document_type_label} tone={TYPE_TONE} />
      </View>
      <View style={styles.badges}>
        <PriorityBadge priority={item.priority} label={item.priority_label} />
        {item.overdue && <ToneBadge label="Lewat 24 jam" tone={OVERDUE_TONE} />}
      </View>
      <Text style={styles.title} numberOfLines={3}>
        {item.title}
      </Text>
      <View style={styles.lines}>
        {!!item.requester && (
          <View style={styles.line}>
            <Ionicons name="person-outline" size={17} color={colors.textSubtle} />
            <Text style={styles.lineText} numberOfLines={1}>
              {item.requester.name}
              {item.executor_unit ? ` → ${item.executor_unit.display_name}` : ''}
            </Text>
          </View>
        )}
        <View style={styles.line}>
          <Ionicons name="git-pull-request-outline" size={17} color={colors.primary} />
          <Text style={[styles.lineText, styles.step]} numberOfLines={1}>
            {item.step_label} · {actionText}
          </Text>
        </View>
        {!!item.waiting_since && (
          <View style={styles.line}>
            <Ionicons
              name="time-outline"
              size={17}
              color={item.overdue ? colors.danger : colors.textSubtle}
            />
            <Text style={[styles.lineText, item.overdue && { color: colors.danger, fontWeight: '700' }]}>
              Menunggu sejak {formatDateTime(item.waiting_since)} ({formatRelative(item.waiting_since)})
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function ApprovalsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const query = useQuery({ queryKey: queryKeys.pendingApprovals, queryFn: approvalApi.pending });
  const { refetch } = query;
  useRefreshOnFocus(refetch);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const open = useCallback(
    (item: PendingApproval) => {
      const ref = documentRefFrom({ document_type: item.document_type, document_id: item.document_id });
      if (ref) router.push(documentPath(ref));
    },
    [router],
  );

  if (query.isLoading) return <LoadingView message="Memuat daftar persetujuan…" />;
  if (query.isError && !query.data) return <ErrorView message={errorMessage(query.error)} onRetry={() => void refetch()} />;

  const items = query.data ?? [];
  const overdue = items.filter((i) => i.overdue).length;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={items}
      keyExtractor={(i) => `${i.document_type}-${i.step_id}`}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      ListHeaderComponent={
        items.length > 0 ? (
          <Text style={styles.summary}>
            {items.length} dokumen menunggu tindakan Anda
            {overdue > 0 ? ` · ${overdue} lewat 24 jam` : ''}
          </Text>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon="checkmark-done-circle-outline"
          title="Tidak ada yang menunggu persetujuan"
          message="Dokumen yang perlu Anda setujui atau selesaikan akan muncul di sini."
        />
      }
      renderItem={({ item }) => <ApprovalCard item={item} onPress={open} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, flexGrow: 1 },
  summary: { fontSize: 14, color: colors.textSubtle, fontWeight: '600', marginBottom: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
    borderLeftColor: '#F59E0B',
    padding: 16,
    gap: 10,
  },
  cardOverdue: { borderLeftColor: colors.danger, borderColor: '#FCA5A5' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  number: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 16, color: colors.text, lineHeight: 22 },
  lines: { gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { flex: 1, fontSize: 14, color: colors.textMuted },
  step: { color: colors.primary, fontWeight: '700' },
});
