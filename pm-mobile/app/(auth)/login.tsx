import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { Button, TextField } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { colors, radius } from '@/lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ login?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    const errors: { login?: string; password?: string } = {};
    if (!login.trim()) errors.login = 'Email atau NRK wajib diisi.';
    if (!password) errors.password = 'Password wajib diisi.';
    setFieldErrors(errors);
    setFormError(null);
    if (errors.login || errors.password) return;

    setLoading(true);
    try {
      const result = await signIn(login, password);
      if (result === 'totp') {
        setPassword('');
        router.push('/totp');
      }
      // 'ok' → AuthGate redirects to the main tabs.
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const loginErr = e.fieldError('login');
        const passwordErr = e.fieldError('password');
        setFieldErrors({ login: loginErr, password: passwordErr });
        if (!loginErr && !passwordErr) setFormError(e.message);
      } else {
        setFormError(errorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="construct" size={40} color={colors.white} />
            </View>
            <Text style={styles.appName}>PrevenTech</Text>
            <Text style={styles.subtitle}>Work Order & Preventive Maintenance{'\n'}PT Industri Nabati Lestari</Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="Email atau NRK"
              value={login}
              onChangeText={setLogin}
              placeholder="nama@inl.co.id atau NRK"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={fieldErrors.login}
              editable={!loading}
            />
            <View>
              <TextField
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Password Portal INTES"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                error={fieldErrors.password}
                editable={!loading}
                style={{ paddingRight: 56 }}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eye}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            {formError && (
              <View style={styles.alert}>
                <Ionicons name="alert-circle" size={22} color={colors.danger} />
                <Text style={styles.alertText}>{formError}</Text>
              </View>
            )}

            <Button title="Masuk" icon="log-in-outline" onPress={submit} loading={loading} />
            <Text style={styles.note}>
              Gunakan akun Portal INTES Anda. Sesi tetap aktif di perangkat ini sampai Anda keluar.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 32 },
  brand: { alignItems: 'center', gap: 10 },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  form: {
    gap: 18,
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eye: { position: 'absolute', right: 6, top: 27, width: 48, height: 52, alignItems: 'center', justifyContent: 'center' },
  alert: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: radius.md,
  },
  alertText: { flex: 1, color: '#991B1B', fontSize: 15 },
  note: { fontSize: 13, color: colors.textSubtle, textAlign: 'center' },
});
