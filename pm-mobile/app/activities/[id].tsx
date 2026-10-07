import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionBar, type BarAction } from '@/components/ActionBar';
import { WEEK_TONE } from '@/components/activity/ActivityCard';
import { ActivityStatusModal } from '@/components/activity/ActivityStatusModal';
import { ActivityWorkOrderCard } from '@/components/activity/ActivityWorkOrderCard';
import { Timeline } from '@/components/Timeline';
import { Card, ErrorView, InfoRow, LoadingView, Section, StatusBadge, ToneBadge } from '@/components/ui';
import { applyActivityResult, useDailyActivity } from '@/hooks/useDailyActivity';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { ApiError, errorMessage } from '@/lib/api';
import { activityApi } from '@/lib/endpoints';
import { formatDateTime, formatYmd } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { activityStatusTone, colors, radius } from '@/lib/theme';
import { toast } from '@/lib/toast';
import type { DailyActivityStatus, UserBrief } from '@/lib/types';

const who = (u: UserBrief | null | undefined, at?: string | null) =>
  [u?.name, at ? formatDateTime(at) : null].filter(Boolean).join(' · ') || null;

export default function ActivityDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const qc = useQueryClient();

  const query = useDailyActivity(id);
  const activity = query.data;
  const { refetch } = query;
  useRefreshOnFocus(refetch);

  const [refreshing, setRefreshing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusErrors, setStatusErrors] = useState<{ status?: string; notes?: string }>({});

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const changeStatus = useMutation({
    mutationFn: ({ status, notes }: { status: DailyActivityStatus; notes: string }) =>
      activityApi.changeStatus(id, status, notes),
    onSuccess: (detail) => {
      applyActivityResult(qc, detail, id);
      setStatusOpen(false);
      setStatusErrors({});
      toast('Status diperbarui');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) {
        setStatusErrors({ status: e.fieldError('status'), notes: e.fieldError('notes') });
      }
      Alert.alert('Gagal mengubah status', errorMessage(e));
    },
  });

  const remove = useMutation({
    mutationFn: () => activityApi.remove(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: queryKeys.activity(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.activities });
      void qc.invalidateQueries({ queryKey: queryKeys.programs });
      toast('Aktivitas dihapus');
      router.back();
    },
    onError: (e) => Alert.alert('Gagal menghapus', errorMessage(e)),
  });

  const confirmDelete = () =>
    Alert.alert('Hapus aktivitas?', 'Laporan kegiatan ini akan dihapus dan tidak dapat dikembalikan.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => remove.mutate() },
    ]);

  if (!Number.isFinite(id) || id <= 0) return <ErrorView message="ID aktivitas tidak valid." />;
  if (query.isLoading) return <LoadingView message="Memuat aktivitas…" />;
  if (!activity) {
    return (
      <ErrorView
        message={query.error ? errorMessage(query.error) : 'Aktivitas tidak ditemukan.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const p = activity.permissions ?? { can_update: false, can_delete: false };
  const tone = activityStatusTone(activity.status);
  const link = activity.program_activity;
  const wo = activity.work_order;
  const busy = changeStatus.isPending || remove.isPending;

  const primary: BarAction[] = [];
  if (p.can_update)
    primary.push({
      key: 'status',
      title: 'Update Status',
      icon: 'swap-horizontal',
      onPress: () => {
        setStatusErrors({});
        setStatusOpen(true);
      },
    });

  const secondary: BarAction[] = [];
  if (p.can_update)
    secondary.push({
      key: 'edit',
      title: 'Ubah',
      icon: 'create-outline',
      onPress: () => router.push(`/activities/new?id=${id}`),
    });
  if (p.can_delete)
    secondary.push({
      key: 'delete',
      title: 'Hapus',
      icon: 'trash-outline',
      variant: 'dangerOutline',
      onPress: confirmDelete,
      loading: remove.isPending,
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: `Aktivitas ${formatYmd(activity.activity_date)}` }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <Card style={[styles.summary, { borderTopColor: tone.border }]}>
          <View style={styles.badges}>
            <StatusBadge status={activity.status} label={activity.status_label} tone={tone} />
            <ToneBadge label={`Minggu ${activity.week_of_month}`} tone={WEEK_TONE} />
          </View>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-number-outline" size={20} color={colors.textSubtle} />
            <Text style={styles.date}>{formatYmd(activity.activity_date)}</Text>
          </View>
          <Text style={styles.title}>{activity.title}</Text>
          <View style={styles.inline}>
            <Ionicons name="person-outline" size={18} color={colors.textSubtle} />
            <Text style={styles.inlineText}>
              {activity.user?.name ?? '-'}
              {activity.org_unit?.name ? ` · ${activity.org_unit.name}` : ''}
            </Text>
          </View>
          <Text style={styles.uploaded}>Diunggah {formatDateTime(activity.created_at)}</Text>
        </Card>

        {!!wo && <ActivityWorkOrderCard workOrder={wo} onPress={() => router.push(`/work-orders/${wo.id}`)} />}

        {!!link && (
          <Pressable
            onPress={() => router.push(`/programs/${link.program_id}`)}
            accessibilityRole="link"
            accessibilityLabel={`Buka program kerja ${link.program_code} ${link.program_title}`}
            style={({ pressed }) => [styles.linkCard, pressed && { backgroundColor: '#D6DEFF' }]}
          >
            <Ionicons name="list-circle-outline" size={26} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.linkLabel}>Kegiatan program kerja</Text>
              <Text style={styles.linkTitle} numberOfLines={2}>
                {link.title}
              </Text>
              <Text style={styles.linkMeta} numberOfLines={2}>
                {link.program_code} {link.program_title} · {link.item_code} {link.item_title}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </Pressable>
        )}

        <Section title="Laporan Kegiatan" icon="document-text-outline">
          <InfoRow label="Uraian" value={activity.description} />
          <InfoRow label="Tindak Lanjut" value={activity.follow_up} />
          <InfoRow label="Kendala" value={activity.obstacles} />
        </Section>

        <Section title="Informasi" icon="information-circle-outline">
          <InfoRow label="PIC" value={activity.user?.name} />
          <InfoRow label="Unit" value={activity.org_unit?.name} />
          <InfoRow label="Tanggal Kegiatan" value={formatYmd(activity.activity_date)} />
          <InfoRow label="Minggu ke" value={`M${activity.week_of_month}`} />
          {!!activity.closed_at && <InfoRow label="Closed" value={formatDateTime(activity.closed_at)} />}
          <InfoRow label="Dibuat" value={who(activity.created_by, activity.created_at)} />
          <InfoRow label="Diperbarui" value={formatDateTime(activity.updated_at)} />
        </Section>

        <Section title="Riwayat" icon="git-commit-outline">
          <Timeline logs={activity.logs ?? []} toneFor={(st) => activityStatusTone(st ?? activity.status)} />
        </Section>
      </ScrollView>

      <ActionBar primary={primary} secondary={secondary} busy={busy} />

      <ActivityStatusModal
        visible={statusOpen}
        current={activity.status}
        currentLabel={activity.status_label}
        loading={changeStatus.isPending}
        errors={statusErrors}
        onClose={() => setStatusOpen(false)}
        onSubmit={(status, notes) => changeStatus.mutate({ status, notes })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  summary: { gap: 10, borderTopWidth: 5 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  date: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, lineHeight: 27 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineText: { flex: 1, fontSize: 15, color: colors.textMuted },
  uploaded: { fontSize: 13, color: colors.textSubtle },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#A5B4FC',
  },
  linkLabel: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' },
  linkTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  linkMeta: { fontSize: 13, color: colors.textMuted },
});
