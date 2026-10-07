import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ProgramCard } from '@/components/program/ProgramCard';
import { ChipBar, EmptyState, ErrorView, LoadingView } from '@/components/ui';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useWorkPrograms } from '@/hooks/useWorkProgram';
import { errorMessage } from '@/lib/api';
import { colors } from '@/lib/theme';

/** Program Kerja Tahunan: year selector (`meta.years`) + programmes I may see. */
export default function ProgramsScreen() {
  const router = useRouter();
  // null = server default (latest year that has a programme).
  const [year, setYear] = useState<number | null>(null);
  const query = useWorkPrograms(year);
  const { refetch } = query;
  useRefreshOnFocus(refetch);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const openDetail = useCallback((id: number) => router.push(`/programs/${id}`), [router]);

  if (query.isLoading) return <LoadingView message="Memuat program kerja…" />;
  if (!query.data) {
    return <ErrorView message={query.error ? errorMessage(query.error) : 'Gagal memuat.'} onRetry={() => void refetch()} />;
  }

  const meta = query.data.meta;
  const activeYear = year ?? meta?.year ?? null;
  const years = new Set<number>(meta?.years ?? []);
  if (activeYear) years.add(activeYear);
  const yearOptions = [...years].sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) }));
  const programs = query.data.data ?? [];

  return (
    <View style={styles.container}>
      {yearOptions.length > 0 && (
        <View style={styles.yearBar}>
          <Text style={styles.yearLabel}>Tahun</Text>
          <View style={{ flex: 1 }}>
            <ChipBar<string>
              options={yearOptions}
              value={activeYear ? String(activeYear) : ''}
              onChange={(v) => setYear(Number(v))}
            />
          </View>
        </View>
      )}
      <FlatList
        data={programs}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => <ProgramCard item={item} onPress={openDetail} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          programs.length > 0 ? (
            <Text style={styles.total}>
              {programs.length} program kerja {activeYear ?? ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="list-circle-outline"
            title="Belum ada program kerja"
            message={
              activeYear
                ? `Tidak ada program kerja tahun ${activeYear} yang dapat Anda lihat. Program dibuat dan dikelola pimpinan unit di aplikasi web.`
                : 'Program kerja dibuat dan dikelola pimpinan unit di aplikasi web.'
            }
          />
        }
        ListFooterComponent={<View style={{ height: 24 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  yearBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 4 },
  yearLabel: { paddingLeft: 16, fontSize: 14, fontWeight: '700', color: colors.textMuted },
  list: { padding: 16, paddingTop: 4, flexGrow: 1 },
  total: { fontSize: 14, color: colors.textSubtle, marginBottom: 8, fontWeight: '600' },
});
