import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useDebounced } from '@/hooks/useDebounced';
import { errorMessage } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { ModalSheet } from './ui';

interface SearchPickerModalProps<T> {
  visible: boolean;
  title: string;
  placeholder?: string;
  /** Base query key; the search text is appended. */
  queryKey: readonly unknown[];
  fetcher: (q: string) => Promise<T[]>;
  keyExtractor: (item: T) => string;
  itemTitle: (item: T) => string;
  itemSubtitle?: (item: T) => string | null | undefined;
  onSelect: (item: T) => void;
  onClose: () => void;
  /** Enables a "use typed text" row for entries that are not in the master data. */
  onFreeText?: (text: string) => void;
  freeTextLabel?: (text: string) => string;
}

export function SearchPickerModal<T>({
  visible,
  title,
  placeholder = 'Cari…',
  queryKey,
  fetcher,
  keyExtractor,
  itemTitle,
  itemSubtitle,
  onSelect,
  onClose,
  onFreeText,
  freeTextLabel = (t) => `Gunakan "${t}"`,
}: SearchPickerModalProps<T>) {
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 350);

  useEffect(() => {
    if (!visible) setText('');
  }, [visible]);

  const query = useQuery({
    queryKey: [...queryKey, q],
    queryFn: () => fetcher(q),
    enabled: visible,
    staleTime: 60_000,
  });

  const typed = text.trim();

  return (
    <ModalSheet visible={visible} title={title} onClose={onClose} scroll={false} fullHeight>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={22} color={colors.textSubtle} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.isFetching && <ActivityIndicator color={colors.primary} />}
      </View>
      <FlatList
        data={query.data ?? []}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          onFreeText && typed.length > 0 ? (
            <Pressable
              onPress={() => onFreeText(typed)}
              style={({ pressed }) => [styles.item, styles.freeText, pressed && styles.itemPressed]}
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
              <Text style={styles.freeTextLabel}>{freeTextLabel(typed)}</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          query.isLoading ? null : query.isError ? (
            <Text style={styles.empty}>{errorMessage(query.error)}</Text>
          ) : (
            <Text style={styles.empty}>Tidak ada data ditemukan.</Text>
          )
        }
        renderItem={({ item }) => {
          const subtitle = itemSubtitle?.(item);
          return (
            <Pressable
              onPress={() => onSelect(item)}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{itemTitle(item)}</Text>
                {!!subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
            </Pressable>
          );
        }}
      />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  item: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemPressed: { backgroundColor: colors.primarySoft },
  itemTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  itemSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  freeText: { borderStyle: 'dashed', borderColor: colors.primary, marginBottom: 8 },
  freeTextLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.primary },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 15, paddingVertical: 24 },
});
