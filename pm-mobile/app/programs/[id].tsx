import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { CountChips } from '@/components/program/ProgramCard';
import { ProgramActivityRow } from '@/components/program/ProgramActivityRow';
import { ProgramActivitySheet, type ProgressErrors, type StatusErrors } from '@/components/program/ProgramActivitySheet';
import { ProgressBar } from '@/components/program/ProgressBar';
import { Timeline } from '@/components/Timeline';
import { Card, ChipBar, EmptyState, ErrorView, LoadingView, MutedText, Section, StatusBadge } from '@/components/ui';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { applyProgramActivityResult, useWorkProgram } from '@/hooks/useWorkProgram';
import { ApiError, errorMessage } from '@/lib/api';
import { programApi } from '@/lib/endpoints';
import { colors, programStatusTone, radius } from '@/lib/theme';
import { toast } from '@/lib/toast';
import type { ProgramActivity, ProgramActivityStatus, WorkProgramItem } from '@/lib/types';

const ALL = 'all';

function ItemHeader({ item, showTitle }: { item: WorkProgramItem; showTitle: boolean }) {
  return (
    <View style={styles.itemHeader}>
      <View style={styles.itemTop}>
        <View style={styles.itemCodeWrap}>
          <Text style={styles.itemCode}>{item.code}</Text>
        </View>
        {showTitle && (
          <Text style={styles.itemTitle} numberOfLines={3}>
            {item.title}
          </Text>
        )}
        <Text style={styles.itemCount}>{item.activities_count} kegiatan</Text>
      </View>
      {!!item.description && showTitle && <Text style={styles.itemDescription}>{item.description}</Text>}
      <ProgressBar value={item.progress_pct} compact />
    </View>
  );
}

/** Programme detail: sub-item chips, activities with PIC / target / status / progress, own progress update. */
export default function ProgramDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const qc = useQueryClient();
  const { me } = useAuth();

  const query = useWorkProgram(id);
  const program = query.data;
  const { refetch } = query;
  useRefreshOnFocus(refetch);

  const [refreshing, setRefreshing] = useState(false);
  const [itemKey, setItemKey] = useState<string>(ALL);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [progressErrors, setProgressErrors] = useState<ProgressErrors>({});
  const [statusErrors, setStatusErrors] = useState<StatusErrors>({});

  const items = program?.items ?? [];
  const visibleItems = useMemo(
    () => (itemKey === ALL ? items : items.filter((i) => String(i.id) === itemKey)),
    [items, itemKey],
  );
  // The sheet reads the activity from the cached programme so it refreshes after each save.
  const selected = useMemo<{ activity: ProgramActivity; itemCode: string } | null>(() => {
    if (selectedId === null) return null;
    for (const item of items) {
      const activity = item.activities?.find((a) => a.id === selectedId);
      if (activity) return { activity, itemCode: item.code };
    }
    return null;
  }, [items, selectedId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const openActivity = useCallback((activity: ProgramActivity) => {
    setProgressErrors({});
    setStatusErrors({});
    setSelectedId(activity.id);
  }, []);

  const closeSheet = () => setSelectedId(null);

  const saveProgress = useMutation({
    mutationFn: ({ activityId, progressPct, remarks }: { activityId: number; progressPct: number; remarks: string }) =>
      programApi.updateActivity(activityId, { progress_pct: progressPct, remarks: remarks || null }),
    onSuccess: (detail) => {
      applyProgramActivityResult(qc, id, detail);
      setProgressErrors({});
      toast('Progress tersimpan');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) {
        setProgressErrors({ progress_pct: e.fieldError('progress_pct'), remarks: e.fieldError('remarks') });
      }
      if (e instanceof ApiError && e.status === 409) void refetch();
      Alert.alert('Gagal menyimpan progress', errorMessage(e));
    },
  });

  const changeStatus = useMutation({
    mutationFn: ({ activityId, status, notes }: { activityId: number; status: ProgramActivityStatus; notes: string }) =>
      programApi.changeActivityStatus(activityId, { status, notes }),
    onSuccess: (detail) => {
      applyProgramActivityResult(qc, id, detail);
      setStatusErrors({});
      setSelectedId(null);
      toast(`Status kegiatan: ${detail.status_label}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) {
        setStatusErrors({
          status: e.fieldError('status'),
          notes: e.fieldError('notes') ?? e.fieldError('closed_date'),
        });
      }
      if (e instanceof ApiError && e.status === 409) void refetch();
      Alert.alert('Gagal mengubah status', errorMessage(e));
    },
  });

  if (!Number.isFinite(id) || id <= 0) return <ErrorView message="ID program tidak valid." />;
  if (query.isLoading) return <LoadingView message="Memuat program kerja…" />;
  if (!program) {
    return (
      <ErrorView
        message={query.error ? errorMessage(query.error) : 'Program kerja tidak ditemukan.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const tone = programStatusTone(program.status);
  const itemOptions = [{ value: ALL, label: 'Semua' }, ...items.map((i) => ({ value: String(i.id), label: i.code }))];
  const myId = me?.id ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: `Program ${program.code} ${program.year}` }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <Card style={[styles.summary, { borderTopColor: tone.border }]}>
          <View style={styles.badges}>
            <View style={styles.codeWrap}>
              <Text style={styles.code}>
                {program.code} · {program.year}
              </Text>
            </View>
            <StatusBadge status={program.status} label={program.status_label} tone={tone} />
          </View>
          <Text style={styles.title}>{program.title}</Text>
          <View style={styles.inline}>
            <Ionicons name="business-outline" size={18} color={colors.textSubtle} />
            <Text style={styles.inlineText}>{program.org_unit?.name ?? '-'}</Text>
          </View>
          {!!program.description && <Text style={styles.description}>{program.description}</Text>}
          <ProgressBar value={program.progress_pct} />
          <Text style={styles.meta}>
            {program.items_count} sub-item · {program.activities_count} kegiatan
            {program.created_by ? ` · dibuat ${program.created_by.name}` : ''}
          </Text>
          <CountChips counts={program.counts} />
        </Card>

        {items.length === 0 ? (
          <EmptyState
            icon="list-outline"
            title="Belum ada sub-item"
            message="Sub-item dan kegiatan ditambahkan oleh pimpinan unit di aplikasi web."
          />
        ) : (
          <>
            {items.length > 1 && (
              <View style={styles.chipWrap}>
                <ChipBar<string> options={itemOptions} value={itemKey} onChange={setItemKey} />
              </View>
            )}
            {visibleItems.map((item) => (
              <View key={item.id} style={styles.itemBlock}>
                <ItemHeader item={item} showTitle />
                {item.activities?.length ? (
                  item.activities.map((activity) => (
                    <ProgramActivityRow
                      key={activity.id}
                      activity={activity}
                      itemCode={item.code}
                      myId={myId}
                      onPress={openActivity}
                    />
                  ))
                ) : (
                  <MutedText>Belum ada kegiatan pada sub-item ini.</MutedText>
                )}
              </View>
            ))}
          </>
        )}

        <Section title="Riwayat" icon="git-commit-outline">
          <Timeline logs={program.logs ?? []} toneFor={(st) => programStatusTone(st ?? program.status)} />
        </Section>
      </ScrollView>

      <ProgramActivitySheet
        activity={selected?.activity ?? null}
        itemCode={selected?.itemCode ?? ''}
        myId={myId}
        savingProgress={saveProgress.isPending}
        savingStatus={changeStatus.isPending}
        progressErrors={progressErrors}
        statusErrors={statusErrors}
        onClose={closeSheet}
        onSaveProgress={(progressPct, remarks) =>
          selected && saveProgress.mutate({ activityId: selected.activity.id, progressPct, remarks })
        }
        onChangeStatus={(status, notes) =>
          selected && changeStatus.mutate({ activityId: selected.activity.id, status, notes })
        }
        onReportActivity={(activity) => {
          setSelectedId(null);
          router.push(`/activities/new?program_activity_id=${activity.id}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  summary: { gap: 10, borderTopWidth: 5 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  codeWrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  code: { fontSize: 15, fontWeight: '800', color: colors.primary },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, lineHeight: 27 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineText: { flex: 1, fontSize: 15, color: colors.textMuted },
  description: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  meta: { fontSize: 13, color: colors.textSubtle },
  chipWrap: { marginHorizontal: -16 },
  itemBlock: { gap: 10 },
  itemHeader: { gap: 6 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemCodeWrap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  itemCode: { fontSize: 14, fontWeight: '800', color: colors.white },
  itemTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  itemCount: { fontSize: 12, color: colors.textSubtle, fontWeight: '600' },
  itemDescription: { fontSize: 14, color: colors.textMuted },
});
