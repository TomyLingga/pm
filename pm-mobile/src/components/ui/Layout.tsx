import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/lib/theme';
import { Button } from './Button';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Section({
  title,
  icon,
  right,
  children,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          {icon && <Ionicons name={icon} size={20} color={colors.primary} />}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {right}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}

export function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  const isEmpty = value === null || value === undefined || value === '';
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' || isEmpty ? (
        <Text style={styles.infoValue}>{isEmpty ? '-' : value}</Text>
      ) : (
        <View style={styles.infoValueWrap}>{value}</View>
      )}
    </View>
  );
}

export function MutedText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function LoadingView({ message = 'Memuat…' }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.centerText}>{message}</Text>
    </View>
  );
}

export function ErrorView({
  message,
  onRetry,
  retryLabel = 'Coba Lagi',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={48} color={colors.textSubtle} />
      <Text style={styles.centerText}>{message}</Text>
      {onRetry && <Button title={retryLabel} icon="refresh" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={52} color="#94A3B8" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {message && <Text style={styles.centerText}>{message}</Text>}
    </View>
  );
}

export function Fab({
  label,
  icon = 'add',
  onPress,
  bottom = 20,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  bottom?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom }, pressed && { backgroundColor: colors.primaryPressed }]}
    >
      <Ionicons name={icon} size={26} color={colors.white} />
      <Text style={styles.fabText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sectionBody: { gap: spacing.md },
  infoRow: { gap: 2 },
  infoLabel: { fontSize: 13, color: colors.textSubtle, fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 16, color: colors.text },
  infoValueWrap: { marginTop: 2 },
  muted: { fontSize: 15, color: colors.textSubtle },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  centerText: { fontSize: 16, color: colors.textMuted, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 16,
    minHeight: 58,
    paddingHorizontal: 20,
    borderRadius: 29,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
