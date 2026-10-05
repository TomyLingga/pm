import { QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthContext';
// Importing push registers the foreground notification handler at startup.
import { documentPath, documentQueryKey, type DocumentRef } from '@/lib/documents';
import { documentRefFromNotification } from '@/lib/push';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { colors } from '@/lib/theme';

function useNavigationReady(): boolean {
  const state = useRootNavigationState();
  return !!state?.key;
}

/** Redirects between the (auth) group and the app depending on the session. */
function AuthGate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const ready = useNavigationReady();

  useEffect(() => {
    if (!ready || status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    if (status === 'signedOut' && !inAuthGroup) {
      router.replace('/login');
    } else if (status === 'signedIn' && inAuthGroup) {
      router.replace('/');
    }
  }, [ready, status, segments, router]);

  return null;
}

/** Opens the WO / Form Request from a tapped notification (foreground, background and cold start). */
function NotificationRouter() {
  const { status } = useAuth();
  const router = useRouter();
  const ready = useNavigationReady();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledIds = useRef(new Set<string>());
  const [pendingDoc, setPendingDoc] = useState<DocumentRef | null>(null);

  useEffect(() => {
    if (!lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const key = lastResponse.notification.request.identifier;
    if (handledIds.current.has(key)) return;
    handledIds.current.add(key);
    const ref = documentRefFromNotification(lastResponse.notification);
    if (ref) setPendingDoc(ref);
  }, [lastResponse]);

  useEffect(() => {
    if (!pendingDoc || !ready || status !== 'signedIn') return;
    // Let the initial redirect (index → tabs) settle before pushing the detail screen.
    const t = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: documentQueryKey(pendingDoc) });
      router.push(documentPath(pendingDoc));
      setPendingDoc(null);
    }, 300);
    return () => clearTimeout(t);
  }, [pendingDoc, ready, status, router]);

  // Keep lists fresh when a notification arrives while the app is open.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests });
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
      const ref = documentRefFromNotification(notification);
      if (ref) void queryClient.invalidateQueries({ queryKey: documentQueryKey(ref) });
    });
    return () => sub.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <AuthGate />
          <NotificationRouter />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: colors.white,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="work-orders/new" options={{ title: 'Buat Work Order' }} />
            <Stack.Screen name="work-orders/[id]/index" options={{ title: 'Detail Work Order' }} />
            <Stack.Screen name="work-orders/[id]/complete" options={{ title: 'Penyelesaian Pekerjaan' }} />
            <Stack.Screen name="requests/new" options={{ title: 'Buat Form Request' }} />
            <Stack.Screen name="requests/[id]/index" options={{ title: 'Detail Form Request' }} />
            <Stack.Screen name="requests/[id]/edit" options={{ title: 'Ubah Form Request' }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
