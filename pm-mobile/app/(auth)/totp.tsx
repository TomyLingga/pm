import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { colors, radius } from '@/lib/theme';

export default function TotpScreen() {
  const router = useRouter();
  const { status, pendingTotp, verifyTotp, cancelTotp } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After a successful verification the session is signed in and AuthGate navigates away.
  if (!pendingTotp) return status === 'signedIn' ? null : <Redirect href="/login" />;

  const submit = async (value = code) => {
    if (!/^\d{6}$/.test(value)) {
      setError('Masukkan 6 digit kode dari aplikasi authenticator.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await verifyTotp(value);
      // AuthGate redirects to the main tabs.
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setError(e.fieldError('code') ?? e.fieldError('totp_token') ?? e.message);
      } else {
        setError(errorMessage(e));
      }
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const back = () => {
    cancelTotp();
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.icon}>
              <Ionicons name="shield-checkmark" size={40} color={colors.white} />
            </View>
            <Text style={styles.title}>Verifikasi Dua Langkah</Text>
            <Text style={styles.subtitle}>
              Masukkan 6 digit kode dari aplikasi authenticator untuk akun{'\n'}
              <Text style={{ fontWeight: '700', color: colors.text }}>{pendingTotp.login}</Text>
            </Text>
          </View>

          <View style={styles.card}>
            <TextInput
              value={code}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, '').slice(0, 6);
                setCode(digits);
                if (digits.length === 6 && !loading) void submit(digits);
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="••••••"
              placeholderTextColor="#94A3B8"
              style={[styles.codeInput, !!error && { borderColor: colors.danger }]}
              accessibilityLabel="Kode verifikasi 6 digit"
              editable={!loading}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button title="Verifikasi" icon="checkmark-circle-outline" onPress={() => submit()} loading={loading} />
            <Button title="Kembali ke Login" variant="ghost" onPress={back} disabled={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 28 },
  header: { alignItems: 'center', gap: 10 },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  card: {
    gap: 14,
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeInput: {
    minHeight: 68,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    fontSize: 32,
    letterSpacing: 12,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, fontSize: 15, textAlign: 'center' },
});
