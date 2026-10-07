import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, ErrorView, InfoRow, LoadingView, StatusBadge, ToneBadge } from '@/components/ui';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/lib/api';
import { equipmentApi } from '@/lib/endpoints';
import { formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { colors, pmStatusTone, radius, statusTone } from '@/lib/theme';
import type { EquipmentDetail, HistoryEntry } from '@/lib/types';

const FINDING_TONE = { fg: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5' };
const PM_TONE = { fg: '#0F766E', bg: '#CCFBF1', border: '#5EEAD4' };
const WO_TONE = { fg: '#1E3A8A', bg: '#E0E7FF', border: '#A5B4FC' };

const EQUIPMENT_STATUS_TONES: Record<string, { fg: string; bg: string; border: string }> = {
  active: { fg: '#15803D', bg: '#DCFCE7', border: '#4ADE80' },
  under_repair: { fg: '#B45309', bg: '#FEF3C7', border: '#F59E0B' },
  inactive: { fg: '#475569', bg: '#F1F5F9', border: '#94A3B8' },
  disposed: { fg: '#B91C1C', bg: '#FEE2E2', border: '#F87171' },
};

function EquipmentHeader({ equipment }: { equipment: EquipmentDetail }) {
  const stats = equipment.stats;
  const specs = [equipment.brand, equipment.model].filter(Boolean).join(' ');
  return (
    <Card style={styles.header}>
      <View style={styles.headerTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.code}>{equipment.code}</Text>
          <Text style={styles.name}>{equipment.name}</Text>
        </View>
        {!!equipment.status_label && (
          <ToneBadge
            label={equipment.status_label}
            tone={EQUIPMENT_STATUS_TONES[equipment.status ?? ''] ?? EQUIPMENT_STATUS_TONES.inactive}
            dot
          />
        )}
      </View>
      <View style={styles.infoGrid}>
        <InfoRow label="Lokasi" value={equipment.location?.name} />
        <InfoRow label="Unit Penanggung Jawab" value={equipment.executor_unit?.display_name} />
        {!!specs && <InfoRow label="Merek / Model" value={specs} />}
        {!!equipment.serial_number && <InfoRow label="No. Seri" value={equipment.serial_number} />}
      </View>
      {!!stats && (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.open_work_orders ?? 0}</Text>
            <Text style={styles.statLabel}>WO terbuka</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.active_schedules ?? 0}</Text>
            <Text style={styles.statLabel}>Jadwal PM aktif</Text>
          </View>
          <View style={[styles.stat, { flex: 1.6 }]}>
            <Text style={styles.statDate}>{stats.next_pm_due_at ? formatDateTime(stats.next_pm_due_at) : '-'}</Text>
            <Text style={styles.statLabel}>PM berikutnya</Text>
          </View>
        </View>
      )}
      {!!stats?.last_pm_completed_at && (
        <Text style={styles.lastPm}>PM terakhir selesai {formatDateTime(stats.last_pm_completed_at)}</Text>
      )}
    </Card>
  );
}

function HistoryRow({ entry, onPress }: { entry: HistoryEntry; onPress: (entry: HistoryEntry) => void }) {
  const isPm = entry.type === 'pm_task';
  const tone = isPm ? pmStatusTone(entry.status) : statusTone(entry.status);
  return (
    <Pressable
      onPress={() => onPress(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${isPm ? 'Tugas PM' : 'Work Order'} ${entry.number}, ${entry.status_label}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F8FAFC' }]}
    >
      <View style={[styles.typeIcon, { backgroundColor: (isPm ? PM_TONE : WO_TONE).bg }]}>
        <Ionicons name={isPm ? 'calendar' : 'construct'} size={22} color={(isPm ? PM_TONE : WO_TONE).fg} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.rowTop}>
          <Text style={styles.number} numberOfLines={1}>
            {entry.number}
          </Text>
          <StatusBadge status={entry.status} label={entry.status_label} tone={tone} />
        </View>
        {!!entry.title && (
          <Text style={styles.title} numberOfLines={2}>
            {entry.title}
          </Text>
        )}
        <Text style={styles.meta}>
          {[isPm ? 'PM' : 'WO', formatDateTime(entry.date), entry.actor_name].filter(Boolean).join(' · ')}
        </Text>
        {((entry.findings_count ?? 0) > 0 || entry.is_late) && (
          <View style={styles.chips}>
            {(entry.findings_count ?? 0) > 0 && <ToneBadge label={`${entry.findings_count} temuan`} tone={FINDING_TONE} />}
            {entry.is_late && <ToneBadge label="Terlambat" tone={FINDING_TONE} />}
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
    </Pressable>
  );
}

/** Maintenance history of one equipment: PM tasks and work orders, newest first. */
export default function EquipmentHistoryScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const valid = Number.isFinite(id) && id > 0;
  const [refreshing, setRefreshing] = useState(false);

  const equipment = useQuery({
    queryKey: queryKeys.equipmentDetail(id),
    queryFn: () => equipmentApi.get(id),
    enabled: valid,
  });

  const history = useInfiniteQuery({
    queryKey: queryKeys.equipmentHistory(id),
    queryFn: ({ pageParam }) => equipmentApi.history(id, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta && last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined,
    enabled: valid,
  });

  const entries = useMemo<HistoryEntry[]>(() => {
    const seen = new Set<string>();
    const out: HistoryEntry[] = [];
    for (const page of history.data?.pages ?? []) {
      for (const entry of page.data) {
        const key = `${entry.type}-${entry.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(entry);
        }
      }
    }
    return out;
  }, [history.data]);

  const refetchEquipment = equipment.refetch;
  const refetchHistory = history.refetch;
  useRefreshOnFocus(refetchHistory);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEquipment(), refetchHistory()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchEquipment, refetchHistory]);

  const open = useCallback(
    (entry: HistoryEntry) =>
      router.push(entry.type === 'pm_task' ? `/pm-tasks/${entry.id}` : `/work-orders/${entry.id}`),
    [router],
  );

  if (!valid) return <ErrorView message="ID alat tidak valid." />;
  if (equipment.isLoading && history.isLoading) return <LoadingView message="Memuat riwayat alat…" />;
  if (history.isError && entries.length === 0 && !equipment.data) {
    return <ErrorView message={errorMessage(history.error)} onRetry={() => void onRefresh()} />;
  }

  const total = history.data?.pages[0]?.meta?.total;

  return (
    <>
      <Stack.Screen options={{ title: equipment.data ? `Riwayat ${equipment.data.code}` : 'Riwayat Alat' }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        data={entries}
        keyExtractor={(e) => `${e.type}-${e.id}`}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage && !history.isError) void history.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            {equipment.data ? (
              <EquipmentHeader equipment={equipment.data} />
            ) : equipment.isError ? (
              <Text style={styles.error}>{errorMessage(equipment.error)}</Text>
            ) : null}
            <Text style={styles.listTitle}>
              Riwayat Maintenance{typeof total === 'number' ? ` (${total})` : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          history.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          ) : history.isError ? (
            <Text style={styles.error}>{errorMessage(history.error)}</Text>
          ) : (
            <EmptyState icon="time-outline" title="Belum ada riwayat" message="Belum ada PM atau Work Order untuk alat ini." />
          )
        }
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={colors.primary} />
          ) : history.isError && entries.length > 0 ? (
            <Pressable onPress={() => void history.fetchNextPage()} style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={styles.retry}>Gagal memuat. Ketuk untuk coba lagi.</Text>
            </Pressable>
          ) : (
            <View style={{ height: 24 }} />
          )
        }
        renderItem={({ item }) => <HistoryRow entry={item} onPress={open} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, flexGrow: 1 },
  header: { gap: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  code: { fontSize: 15, fontWeight: '800', color: colors.textMuted },
  name: { fontSize: 21, fontWeight: '800', color: colors.text, lineHeight: 28 },
  infoGrid: { gap: 10 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statDate: { fontSize: 15, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, fontWeight: '700', color: colors.textSubtle },
  lastPm: { fontSize: 14, color: colors.textMuted },
  listTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  number: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  title: { fontSize: 15, color: colors.text, lineHeight: 21 },
  meta: { fontSize: 13, color: colors.textSubtle },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { textAlign: 'center', color: colors.danger, fontSize: 15, marginVertical: 12 },
  retry: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});
