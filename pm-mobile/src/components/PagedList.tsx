import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useDebounced } from '@/hooks/useDebounced';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import type { Paginated, PaginationMeta, Priority } from '@/lib/types';
import { Chip, ChipBar, EmptyState, ErrorView, Fab, LoadingView } from './ui';

export interface ListFilter {
  key: string;
  label: string;
  /** Comma separated statuses (the API accepts `status=a,b`). */
  status?: string;
  priority?: Priority;
}

interface PagedListProps<T extends { id: number }, M extends PaginationMeta = PaginationMeta> {
  /** Base query key; filter + search are appended. */
  queryKey: readonly unknown[];
  fetchPage: (args: { page: number; status?: string; priority?: Priority; q?: string }) => Promise<Paginated<T, M>>;
  renderItem: (item: T) => React.ReactElement;
  filters: ListFilter[];
  defaultFilterKey?: string;
  /**
   * Multi-select chips: several status filters can be active at once (their statuses are
   * combined); the filter without a `status` ("Semua") clears the selection.
   */
  multiple?: boolean;
  /** Initially active chips in `multiple` mode. */
  defaultFilterKeys?: string[];
  searchPlaceholder: string;
  emptyTitle: string;
  emptyMessage?: string;
  totalLabel: string;
  fab?: { label: string; onPress: () => void };
  /** Rendered above the search box (e.g. a segmented switch). */
  header?: React.ReactNode;
  /** Rendered inside the list, above the first item (scrolls with the content). */
  listHeader?: React.ReactNode;
  /** Called with the first page's `meta` whenever it changes (summary counters, scopes, ...). */
  onMeta?: (meta: M) => void;
}

/** Search box + filter chips + infinite FlatList with pull-to-refresh (Laravel pagination). */
export function PagedList<T extends { id: number }, M extends PaginationMeta = PaginationMeta>({
  queryKey,
  fetchPage,
  renderItem,
  filters,
  defaultFilterKey,
  multiple = false,
  defaultFilterKeys,
  searchPlaceholder,
  emptyTitle,
  emptyMessage,
  totalLabel,
  fab,
  header,
  listHeader,
  onMeta,
}: PagedListProps<T, M>) {
  const [filterKey, setFilterKey] = useState(defaultFilterKey ?? filters[0]?.key ?? 'all');
  const [selectedKeys, setSelectedKeys] = useState<string[]>(defaultFilterKeys ?? []);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 400);
  const [refreshing, setRefreshing] = useState(false);

  const filter = filters.find((f) => f.key === filterKey) ?? filters[0];
  // In multi-select mode the status filter is the union of the active chips.
  const status = multiple
    ? filters
        .filter((f) => f.status && selectedKeys.includes(f.key))
        .map((f) => f.status)
        .join(',') || undefined
    : filter?.status;
  const priority = multiple ? undefined : filter?.priority;

  const toggleKey = (key: string) => {
    const target = filters.find((f) => f.key === key);
    if (!target?.status) {
      setSelectedKeys([]);
      return;
    }
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const query = useInfiniteQuery({
    queryKey: [...queryKey, { status, priority, q }],
    queryFn: ({ pageParam }) => fetchPage({ page: pageParam, status, priority, q }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta && last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined,
  });

  const items = useMemo<T[]>(() => {
    const seen = new Set<number>();
    const out: T[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const item of page.data) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          out.push(item);
        }
      }
    }
    return out;
  }, [query.data]);

  const firstMeta = query.data?.pages[0]?.meta;
  const total = firstMeta?.total;

  useEffect(() => {
    if (firstMeta && onMeta) onMeta(firstMeta);
  }, [firstMeta, onMeta]);

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

  const onEndReached = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isError) void query.fetchNextPage();
  }, [query]);

  return (
    <View style={styles.container}>
      {header}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={22} color={colors.textSubtle} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={searchPlaceholder}
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={12} accessibilityLabel="Hapus pencarian">
            <Ionicons name="close-circle" size={24} color={colors.textSubtle} />
          </Pressable>
        )}
      </View>
      {filters.length > 1 && !multiple && (
        <View>
          <ChipBar
            options={filters.map((f) => ({ value: f.key, label: f.label }))}
            value={filterKey}
            onChange={setFilterKey}
          />
        </View>
      )}
      {filters.length > 1 && multiple && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipBar}>
            {filters.map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                selected={f.status ? selectedKeys.includes(f.key) : selectedKeys.length === 0}
                onPress={() => toggleKey(f.key)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {query.isLoading ? (
        <LoadingView />
      ) : query.isError && items.length === 0 ? (
        <ErrorView message={errorMessage(query.error)} onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => renderItem(item)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            listHeader || (typeof total === 'number' && items.length > 0) ? (
              <View>
                {listHeader}
                {typeof total === 'number' && items.length > 0 && (
                  <Text style={styles.total}>
                    {total} {totalLabel}
                  </Text>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={<EmptyState title={emptyTitle} message={emptyMessage} />}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator style={styles.footer} color={colors.primary} />
            ) : query.isError && items.length > 0 ? (
              <Pressable onPress={() => void query.fetchNextPage()} style={styles.footer}>
                <Text style={styles.retry}>Gagal memuat. Ketuk untuk coba lagi.</Text>
              </Pressable>
            ) : (
              <View style={{ height: 90 }} />
            )
          }
        />
      )}

      {fab && <Fab label={fab.label} onPress={fab.onPress} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: 8 },
  chipBar: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  list: { padding: 16, paddingTop: 4, flexGrow: 1 },
  total: { fontSize: 14, color: colors.textSubtle, marginBottom: 8, fontWeight: '600' },
  footer: { paddingVertical: 24, alignItems: 'center', marginBottom: 70 },
  retry: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});
