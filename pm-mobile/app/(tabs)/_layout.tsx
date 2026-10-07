import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { usePmSummary } from '@/hooks/usePmTask';
import { approvalApi, notificationApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import { colors } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (active: IconName, inactive: IconName) =>
  ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size + 2} color={color} />
  );

export default function TabsLayout() {
  const { status, isExecutor } = useAuth();
  const insets = useSafeAreaInsets();

  const unread = useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: notificationApi.unreadCount,
    enabled: status === 'signedIn',
    refetchInterval: 60_000,
  });
  const unreadCount = unread.data ?? 0;

  const pending = useQuery({
    queryKey: queryKeys.pendingApprovalCount,
    queryFn: approvalApi.pendingCount,
    enabled: status === 'signedIn',
    refetchInterval: 60_000,
  });
  const pendingCount = pending.data ?? 0;

  // PM badge = my tasks that are due or overdue (API_PM.md §5 summary).
  const pmSummary = usePmSummary(status === 'signedIn' && isExecutor);
  const pmCount = (pmSummary.data?.mine?.due ?? 0) + (pmSummary.data?.mine?.overdue ?? 0);
  const badge = (n: number) => (n > 0 ? (n > 99 ? '99+' : n) : undefined);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: { height: 64 + insets.bottom, paddingBottom: 8 + insets.bottom, paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {/* Executor-unit staff only: WO (pool + my assignments) and PM tasks. */}
      <Tabs.Screen
        name="work"
        options={{
          title: 'WO',
          headerTitle: 'Work Order Unit Pelaksana',
          href: isExecutor ? undefined : null,
          tabBarIcon: icon('hammer', 'hammer-outline'),
        }}
      />
      <Tabs.Screen
        name="pm"
        options={{
          title: 'PM',
          headerTitle: 'Preventive Maintenance',
          href: isExecutor ? undefined : null,
          tabBarIcon: icon('calendar', 'calendar-outline'),
          tabBarBadge: badge(pmCount),
        }}
      />
      <Tabs.Screen
        name="mine"
        options={{
          title: 'Pengajuan',
          headerTitle: 'Pengajuan Saya',
          tabBarIcon: icon('document-text', 'document-text-outline'),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Persetujuan',
          headerTitle: 'Menunggu Persetujuan Saya',
          tabBarIcon: icon('checkmark-done-circle', 'checkmark-done-circle-outline'),
          tabBarBadge: badge(pendingCount),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Akun',
          tabBarIcon: icon('person-circle', 'person-circle-outline'),
          tabBarBadge: badge(unreadCount),
        }}
      />
    </Tabs>
  );
}
