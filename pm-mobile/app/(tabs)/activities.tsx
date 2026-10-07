import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActivityCard } from '@/components/activity/ActivityCard';
import {
  ACTIVITY_PERIOD_HINT,
  activityPeriodApplies,
  ActivityStatusChips,
  activityStatusParam,
  DEFAULT_ACTIVITY_STATUSES,
} from '@/components/activity/ActivityStatusChips';
import { ActivitySummary } from '@/components/activity/ActivitySummary';
import { currentYearMonth, MonthNavigator, type YearMonth } from '@/components/activity/MonthNavigator';
import { PagedList, type ListFilter } from '@/components/PagedList';
import { ChipBar, Segmented } from '@/components/ui';
import type { ActivityMeta } from '@/hooks/useDailyActivity';
import { activityApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import { colors } from '@/lib/theme';
import type {
  DailyActivity,
  DailyActivityListMeta,
  DailyActivityScope,
  DailyActivityStatus,
  DailyActivitySummary,
} from '@/lib/types';

const SCOPE_LABELS: Record<DailyActivityScope, string> = { mine: 'Saya', team: 'Tim', all: 'Semua' };
const SCOPE_ORDER: DailyActivityScope[] = ['mine', 'team', 'all'];

// The status chips live in this screen's header (they also decide whether a period is sent),
// so PagedList renders no filter chips of its own.
const NO_LIST_FILTERS: ListFilter[] = [];

type WeekKey = 'all' | '1' | '2' | '3' | '4' | '5';
const WEEK_OPTIONS: { value: WeekKey; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: '1', label: 'M1' },
  { value: '2', label: 'M2' },
  { value: '3', label: 'M3' },
  { value: '4', label: 'M4' },
  { value: '5', label: 'M5' },
];

/**
 * "Aktivitas" tab: daily activity reports (mine / team / all). Status chips are multi-select and
 * default to OPEN + ON PROGRESS. The month only narrows closed reports (open / on progress ones are
 * always listed), so the month navigator and the `year` / `month` params only exist while closed
 * reports are part of the selection ("Semua" or CLOSED). Week chips (M1 .. M5) apply in both cases.
 */
export default function ActivitiesScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [scope, setScope] = useState<DailyActivityScope>('mine');
  const [scopes, setScopes] = useState<DailyActivityScope[]>(['mine']);
  const [statuses, setStatuses] = useState<DailyActivityStatus[]>(DEFAULT_ACTIVITY_STATUSES);
  const [ym, setYm] = useState<YearMonth>(currentYearMonth);
  const [week, setWeek] = useState<WeekKey>('all');
  const [summary, setSummary] = useState<DailyActivitySummary | null>(null);

  const weekNumber = week === 'all' ? null : Number(week);
  const statusParam = activityStatusParam(statuses);
  const usePeriod = activityPeriodApplies(statuses);
  // Effective period sent to the API (none while only running reports are listed).
  const period = usePeriod ? ym : null;

  // `meta` of the first page: counters for the current filter, the scopes I may use and
  // whether I may report on behalf of others (seeded into the cache for the form screen).
  const onMeta = useCallback(
    (meta: DailyActivityListMeta) => {
      setSummary(meta.summary ?? null);
      const available = meta.available_scopes?.length ? meta.available_scopes : ['mine' as const];
      setScopes(SCOPE_ORDER.filter((s) => available.includes(s)));
      qc.setQueryData<ActivityMeta>(queryKeys.activityMeta, {
        availableScopes: available,
        canReportForOthers: !!meta.can_report_for_others,
      });
    },
    [qc],
  );

  const openDetail = useCallback((id: number) => router.push(`/activities/${id}`), [router]);

  const header = (
    <View>
      {scopes.length > 1 && (
        <View style={styles.top}>
          <Segmented<DailyActivityScope>
            options={scopes.map((s) => ({ value: s, label: SCOPE_LABELS[s] }))}
            value={scope}
            onChange={setScope}
          />
        </View>
      )}
      <ActivityStatusChips value={statuses} onChange={setStatuses} />
      {period ? (
        <View style={styles.period}>
          <MonthNavigator value={ym} onChange={setYm} />
        </View>
      ) : (
        <Text style={styles.hint} numberOfLines={2}>
          {ACTIVITY_PERIOD_HINT}
        </Text>
      )}
      <ChipBar<WeekKey> options={WEEK_OPTIONS} value={week} onChange={setWeek} />
    </View>
  );

  const emptyMessage = period
    ? scope === 'mine'
      ? 'Belum ada laporan kegiatan pada bulan / minggu ini. Ketuk "Tambah Aktivitas" untuk mencatat.'
      : 'Belum ada laporan kegiatan tim pada bulan / minggu ini.'
    : scope === 'mine'
      ? 'Belum ada laporan kegiatan dengan status tersebut. Ketuk "Tambah Aktivitas" untuk mencatat.'
      : 'Belum ada laporan kegiatan tim dengan status tersebut.';

  return (
    <PagedList<DailyActivity, DailyActivityListMeta>
      // Cache key: effective period (0 = none) + status selection; PagedList appends the search text.
      queryKey={[
        ...queryKeys.activityList(scope, period?.year ?? 0, period?.month ?? 0, weekNumber),
        statusParam ?? 'all',
      ]}
      fetchPage={({ page, q }) =>
        activityApi.list({
          scope,
          year: period?.year,
          month: period?.month,
          week: weekNumber ?? undefined,
          status: statusParam,
          q,
          page,
        })
      }
      renderItem={(item) => <ActivityCard item={item} showPic={scope !== 'mine'} onPress={openDetail} />}
      filters={NO_LIST_FILTERS}
      searchPlaceholder="Cari judul / uraian kegiatan…"
      emptyTitle="Belum ada aktivitas"
      emptyMessage={emptyMessage}
      totalLabel="aktivitas"
      fab={{ label: 'Tambah Aktivitas', onPress: () => router.push('/activities/new') }}
      header={header}
      listHeader={<ActivitySummary summary={summary} />}
      onMeta={onMeta}
    />
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg },
  period: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 4 },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 4,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSubtle,
  },
});
