import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button, EmptyState } from '@/components/ui';

export default function NotFound() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Stack.Screen options={{ title: 'Tidak ditemukan' }} />
      <EmptyState icon="help-circle-outline" title="Halaman tidak ditemukan" />
      <Button title="Kembali ke Beranda" onPress={() => router.replace('/')} />
    </View>
  );
}
