import { Redirect } from 'expo-router';
import React from 'react';

import { useAuth } from '@/auth/AuthContext';
import { LoadingView } from '@/components/ui';

export default function Index() {
  const { status, isExecutor } = useAuth();
  if (status === 'loading') return <LoadingView message="Memuat PM-App…" />;
  if (status === 'signedOut') return <Redirect href="/login" />;
  return <Redirect href={isExecutor ? '/pool' : '/mine'} />;
}
