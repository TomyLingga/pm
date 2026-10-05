import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { Button, Card, EmptyState, InfoRow } from '@/components/ui';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/lib/api';
import { documentPath, documentRefFrom } from '@/lib/documents';
import { notificationApi } from '@/lib/endpoints';
import { formatRelative } from '@/lib/format';
import { registerForPush } from '@/lib/push';
import { queryKeys } from '@/lib/queryClient';
import { storage } from '@/lib/storage';
import { colors, radius } from '@/lib/theme';
import type { AppNotification } from '@/lib/types';

export default function AccountScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, signOut, refreshMe } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    void storage.getPushToken().then(setPushToken);
  }, []);

  const notifications = useInfiniteQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ pageParam }) => notificationApi.list(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta && last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined,
  });

  const items = useMemo<AppNotification[]>(
    () => notifications.data?.pages.flatMap((p) => p.data) ?? [],
    [notifications.data],
  );
  const hasUnread = items.some((n) => !n.read_at);

  const { refetch } = notifications;
  useRefreshOnFocus(refetch);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications });

  const markRead = useMutation({
    mutationFn: (id: number | string) => notificationApi.markRead(id),
    onSettled: invalidate,
  });

  const markAll = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Gagal', errorMessage(e)),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshMe(), refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshMe, refetch]);

  const openNotification = (n: AppNotification) => {
    if (!n.read_at) markRead.mutate(n.id);
    const ref = documentRefFrom(n as unknown as Record<string, unknown>);
    if (ref) router.push(documentPath(ref));
  };

  const confirmSignOut = () => {
    Alert.alert('Keluar', 'Keluar dari PM-App di perangkat ini? Notifikasi tidak akan diterima lagi.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const reRegisterPush = async () => {
    setRegistering(true);
    try {
      const token = await registerForPush();
      setPushToken(token);
      Alert.alert(
        token ? 'Notifikasi aktif' : 'Notifikasi belum aktif',
        token
          ? 'Perangkat ini terdaftar untuk menerima notifikasi & alarm WO.'
          : 'Pastikan izin notifikasi diberikan dan aplikasi adalah build resmi (bukan emulator).',
      );
    } finally {
      setRegistering(false);
    }
  };

  const openDndSettings = async () => {
    try {
      await Linking.sendIntent('android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS');
    } catch {
      await Linking.openSettings();
    }
  };

  const unitName = me?.org_unit?.name ?? me?.sub_bagian ?? me?.bagian ?? '-';

  const header = (
    <View style={styles.headerWrap}>
      <Card style={styles.profile}>
        <View style={styles.profileTop}>
          {me?.photo_url ? (
            <Image source={{ uri: me.photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{(me?.name ?? '?').slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{me?.name ?? 'Profil belum dimuat'}</Text>
            <Text style={styles.sub}>{me?.position ?? '-'}</Text>
          </View>
        </View>
        <View style={styles.infoGrid}>
          <InfoRow label="NRK" value={me?.nrk} />
          <InfoRow label="Unit" value={unitName} />
          {!!me?.bagian && me.bagian !== unitName && <InfoRow label="Bagian" value={me.bagian} />}
          {!!me?.email && <InfoRow label="Email" value={me.email} />}
          <InfoRow
            label="Unit Pelaksana"
            value={
              me?.executor_units?.length ? (
                <View style={styles.unitList}>
                  {me.executor_units.map((u) => (
                    <View key={u.id} style={styles.unitPill}>
                      <Text style={styles.unitPillText}>
                        {u.display_name}
                        {u.is_lead ? ' · Pimpinan' : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                'Bukan anggota unit pelaksana'
              )
            }
          />
        </View>
      </Card>

      {Platform.OS === 'android' && (
        <Card style={styles.pushCard}>
          <View style={styles.pushRow}>
            <Ionicons
              name={pushToken ? 'notifications' : 'notifications-off-outline'}
              size={24}
              color={pushToken ? colors.success : colors.warning}
            />
            <Text style={styles.pushText}>
              {pushToken ? 'Notifikasi push aktif di perangkat ini' : 'Notifikasi push belum aktif'}
            </Text>
          </View>
          <View style={styles.pushButtons}>
            <Button
              compact
              variant="secondary"
              icon="refresh"
              title="Daftar Ulang"
              onPress={reRegisterPush}
              loading={registering}
              style={{ flex: 1 }}
            />
            <Button
              compact
              variant="secondary"
              icon="settings-outline"
              title="Pengaturan"
              onPress={() => void Linking.openSettings()}
              style={{ flex: 1 }}
            />
          </View>
          <Pressable onPress={openDndSettings} style={styles.dndLink}>
            <Text style={styles.dndText}>Izinkan alarm berbunyi saat mode Jangan Ganggu</Text>
            <Ionicons name="open-outline" size={18} color={colors.primary} />
          </Pressable>
        </Card>
      )}

      <View style={styles.notifHeader}>
        <Text style={styles.notifTitle}>Notifikasi</Text>
        {hasUnread && (
          <Pressable
            onPress={() => markAll.mutate()}
            disabled={markAll.isPending}
            style={styles.markAll}
            accessibilityRole="button"
          >
            {markAll.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.markAllText}>Tandai semua dibaca</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {notifications.hasNextPage && (
        <Button
          variant="ghost"
          title="Muat notifikasi lainnya"
          onPress={() => void notifications.fetchNextPage()}
          loading={notifications.isFetchingNextPage}
        />
      )}
      <Button title="Keluar" icon="log-out-outline" variant="dangerOutline" onPress={confirmSignOut} loading={signingOut} />
      <Text style={styles.version}>PM-App INL v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={items}
      keyExtractor={(n) => String(n.id)}
      contentContainerStyle={styles.content}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      ListEmptyComponent={
        notifications.isLoading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
        ) : notifications.isError ? (
          <Text style={styles.errorText}>{errorMessage(notifications.error)}</Text>
        ) : (
          <EmptyState icon="notifications-off-outline" title="Belum ada notifikasi" />
        )
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => openNotification(item)}
          style={({ pressed }) => [styles.notif, !item.read_at && styles.notifUnread, pressed && styles.notifPressed]}
        >
          <View style={[styles.notifIcon, item.alarm && { backgroundColor: colors.dangerSoft }]}>
            <Ionicons
              name={item.alarm ? 'alarm' : 'notifications-outline'}
              size={22}
              color={item.alarm ? colors.danger : colors.primary}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.notifItemTitle, !item.read_at && { fontWeight: '800' }]}>{item.title}</Text>
            {!!item.body && <Text style={styles.notifBody}>{item.body}</Text>}
            <Text style={styles.notifTime}>{formatRelative(item.created_at)}</Text>
          </View>
          {!item.read_at && <View style={styles.unreadDot} />}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  headerWrap: { gap: 16, marginBottom: 12 },
  profile: { gap: 16 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 26, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 15, color: colors.textMuted, marginTop: 2 },
  infoGrid: { gap: 12 },
  unitList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unitPillText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  pushCard: { gap: 12 },
  pushRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pushText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
  pushButtons: { flexDirection: 'row', gap: 10 },
  dndLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  dndText: { flex: 1, color: colors.primary, fontSize: 14, fontWeight: '600' },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  notifTitle: { fontSize: 19, fontWeight: '800', color: colors.text },
  markAll: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  markAllText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  notif: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
  },
  notifUnread: { borderColor: '#A5B4FC', backgroundColor: '#F5F7FF' },
  notifPressed: { backgroundColor: colors.primarySoft },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifItemTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  notifBody: { fontSize: 14, color: colors.textMuted },
  notifTime: { fontSize: 13, color: colors.textSubtle, marginTop: 2 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
  footer: { gap: 12, marginTop: 20 },
  version: { textAlign: 'center', color: colors.textSubtle, fontSize: 13 },
  errorText: { textAlign: 'center', color: colors.danger, marginVertical: 16 },
});
