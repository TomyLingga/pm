import * as Notifications from 'expo-notifications';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, setAuthToken, setUnauthorizedHandler } from '@/lib/api';
import { authApi } from '@/lib/endpoints';
import { deviceName, registerForPush, unregisterPush } from '@/lib/push';
import { queryClient } from '@/lib/queryClient';
import { storage } from '@/lib/storage';
import type { LoginSuccess, Me } from '@/lib/types';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface PendingTotp {
  totpToken: string;
  login: string;
}

interface AuthContextValue {
  status: AuthStatus;
  token: string | null;
  me: Me | null;
  /** True when the user belongs to at least one executor (support) unit. */
  isExecutor: boolean;
  pendingTotp: PendingTotp | null;
  /** Returns 'totp' when a second factor is required (see `pendingTotp`). */
  signIn: (login: string, password: string) => Promise<'ok' | 'totp'>;
  verifyTotp: (code: string) => Promise<void>;
  cancelTotp: () => void;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [pendingTotp, setPendingTotp] = useState<PendingTotp | null>(null);
  const signingOut = useRef(false);

  const clearLocalSession = useCallback(async () => {
    setAuthToken(null);
    await storage.clearAll();
    queryClient.clear();
    setToken(null);
    setMe(null);
    setPendingTotp(null);
    setStatus('signedOut');
    Notifications.dismissAllNotificationsAsync().catch(() => undefined);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const fresh = await authApi.me();
      setMe(fresh);
      await storage.setMe(fresh);
    } catch (e) {
      // 401 is handled globally (session cleared); other errors keep the cached profile.
      if (!(e instanceof ApiError && e.status === 401)) console.warn('[auth] refresh /auth/me failed', e);
    }
  }, []);

  // Token revoked / user deactivated → back to login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (signingOut.current) return;
      signingOut.current = true;
      clearLocalSession().finally(() => {
        signingOut.current = false;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [clearLocalSession]);

  // Restore session on app start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedToken, cachedMe] = await Promise.all([storage.getToken(), storage.getMe()]);
      if (cancelled) return;
      if (!storedToken) {
        setStatus('signedOut');
        return;
      }
      setAuthToken(storedToken);
      setToken(storedToken);
      setMe(cachedMe);
      setStatus('signedIn');
      void refreshMe();
      void registerForPush();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  const completeLogin = useCallback(async (result: LoginSuccess) => {
    setAuthToken(result.token);
    await storage.setToken(result.token);
    await storage.setMe(result.user);
    setToken(result.token);
    setMe(result.user);
    setPendingTotp(null);
    setStatus('signedIn');
    void registerForPush();
  }, []);

  const signIn = useCallback(
    async (login: string, password: string): Promise<'ok' | 'totp'> => {
      const result = await authApi.login(login.trim(), password, deviceName());
      if ('requires_totp' in result && result.requires_totp) {
        setPendingTotp({ totpToken: result.totp_token, login: login.trim() });
        return 'totp';
      }
      await completeLogin(result as LoginSuccess);
      return 'ok';
    },
    [completeLogin],
  );

  const verifyTotp = useCallback(
    async (code: string) => {
      if (!pendingTotp) throw new ApiError(0, 'Sesi verifikasi berakhir. Silakan masuk kembali.');
      const result = await authApi.totp(pendingTotp.totpToken, code.trim(), deviceName());
      await completeLogin(result);
    },
    [pendingTotp, completeLogin],
  );

  const cancelTotp = useCallback(() => setPendingTotp(null), []);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    try {
      await unregisterPush();
      try {
        await authApi.logout();
      } catch (e) {
        console.warn('[auth] logout request failed (continuing locally)', e);
      }
    } finally {
      await clearLocalSession();
      signingOut.current = false;
    }
  }, [clearLocalSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      token,
      me,
      isExecutor: (me?.executor_units?.length ?? 0) > 0,
      pendingTotp,
      signIn,
      verifyTotp,
      cancelTotp,
      signOut,
      refreshMe,
    }),
    [status, token, me, pendingTotp, signIn, verifyTotp, cancelTotp, signOut, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
