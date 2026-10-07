import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { DateTimeField } from '@/components/DateTimeField';
import { SearchPickerModal } from '@/components/SearchPickerModal';
import {
  Button,
  Card,
  ErrorView,
  FieldError,
  FieldLabel,
  LoadingView,
  MutedText,
  Segmented,
  SelectField,
  TextField,
} from '@/components/ui';
import { applyActivityResult, useActivityMeta, useDailyActivity } from '@/hooks/useDailyActivity';
import { ApiError, errorMessage } from '@/lib/api';
import { activityApi, programApi } from '@/lib/endpoints';
import { fromYmd, todayYmd, toYmd } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { activityStatusTones, colors, DAILY_ACTIVITY_STATUS_OPTIONS, radius } from '@/lib/theme';
import { toast } from '@/lib/toast';
import type { DailyActivityBody, DailyActivityPerson, DailyActivityStatus, DailyActivityUpdateBody } from '@/lib/types';

type Errors = Partial<Record<keyof DailyActivityBody, string>>;

const MAX_TITLE = 250;

/**
 * Create a daily activity report (`POST /daily-activities`) or edit one (`?id=` → `PUT`).
 * `?program_activity_id=` links a new report to a programme activity I am PIC of.
 */
export default function ActivityFormScreen() {
  const params = useLocalSearchParams<{ id?: string; program_activity_id?: string }>();
  const editId = Number(params.id ?? 0);
  const isEdit = Number.isFinite(editId) && editId > 0;
  const linkId = Number(params.program_activity_id ?? 0);
  const hasLink = !isEdit && Number.isFinite(linkId) && linkId > 0;

  const router = useRouter();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();

  const existing = useDailyActivity(isEdit ? editId : 0);
  const meta = useActivityMeta(!isEdit);
  const linked = useQuery({
    queryKey: queryKeys.programActivity(linkId),
    queryFn: () => programApi.getActivity(linkId),
    enabled: hasLink,
  });

  const [date, setDate] = useState<Date | null>(() => fromYmd(todayYmd()));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [obstacles, setObstacles] = useState('');
  const [status, setStatus] = useState<DailyActivityStatus>('open');
  const [person, setPerson] = useState<DailyActivityPerson | null>(null);
  const [personOpen, setPersonOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const prefilled = useRef(false);
  const leaving = useRef(false);

  // Prefill once from the existing report (edit mode).
  useEffect(() => {
    if (!isEdit || !existing.data || prefilled.current) return;
    prefilled.current = true;
    const a = existing.data;
    setDate(fromYmd(a.activity_date));
    setTitle(a.title ?? '');
    setDescription(a.description ?? '');
    setFollowUp(a.follow_up ?? '');
    setObstacles(a.obstacles ?? '');
    setStatus(a.status);
  }, [isEdit, existing.data]);

  // Confirm before discarding unsaved input.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!dirty || saving || leaving.current) return;
      e.preventDefault();
      Alert.alert('Batalkan pengisian?', 'Perubahan yang belum disimpan akan hilang.', [
        { text: 'Lanjut Mengisi', style: 'cancel' },
        { text: 'Buang', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, dirty, saving]);

  const touch = () => setDirty(true);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!date) e.activity_date = 'Pilih tanggal kegiatan.';
    if (!title.trim()) e.title = 'Isi judul / laporan kegiatan.';
    else if (title.trim().length > MAX_TITLE) e.title = `Judul maksimal ${MAX_TITLE} karakter.`;
    if (!description.trim()) e.description = 'Uraikan kegiatan yang dilakukan.';
    return e;
  };

  const submit = async () => {
    const clientErrors = validate();
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      Alert.alert('Data belum lengkap', Object.values(clientErrors).join('\n'));
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const body: DailyActivityUpdateBody = {
          activity_date: toYmd(date as Date),
          title: title.trim(),
          description: description.trim(),
          follow_up: followUp.trim() || null,
          obstacles: obstacles.trim() || null,
        };
        const updated = await activityApi.update(editId, body);
        applyActivityResult(qc, updated, editId);
        toast('Perubahan tersimpan');
      } else {
        const body: DailyActivityBody = {
          activity_date: toYmd(date as Date),
          title: title.trim(),
          description: description.trim(),
          follow_up: followUp.trim() || null,
          obstacles: obstacles.trim() || null,
          status,
        };
        if (person && person.id !== me?.id) body.user_id = person.id;
        if (hasLink) body.work_program_activity_id = linkId;
        const created = await activityApi.create(body);
        applyActivityResult(qc, created);
        toast('Aktivitas tersimpan');
      }
      leaving.current = true;
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const serverErrors: Errors = {};
        for (const [field, messages] of Object.entries(e.errors)) {
          serverErrors[field as keyof Errors] = messages[0];
        }
        setErrors(serverErrors);
      }
      Alert.alert(isEdit ? 'Gagal menyimpan perubahan' : 'Gagal menyimpan aktivitas', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const screenTitle = isEdit ? 'Ubah Aktivitas' : 'Tambah Aktivitas';

  if (isEdit && existing.isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <LoadingView message="Memuat aktivitas…" />
      </>
    );
  }
  if (isEdit && !existing.data) {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <ErrorView
          message={existing.error ? errorMessage(existing.error) : 'Aktivitas tidak ditemukan.'}
          onRetry={() => void existing.refetch()}
        />
      </>
    );
  }
  if (isEdit && existing.data && !existing.data.permissions?.can_update) {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <ErrorView
          message="Aktivitas ini tidak dapat diubah (hanya pemilik laporan atau pimpinannya)."
          onRetry={() => router.back()}
          retryLabel="Kembali"
        />
      </>
    );
  }

  const canPickPerson = !isEdit && !!meta.data?.canReportForOthers;
  const programLink = isEdit ? existing.data?.program_activity ?? null : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: screenTitle }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {(hasLink || programLink) && (
          <View style={styles.linkCard}>
            <Ionicons name="list-circle-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.linkLabel}>Kegiatan program kerja</Text>
              {hasLink ? (
                linked.isLoading ? (
                  <Text style={styles.linkTitle}>Memuat kegiatan…</Text>
                ) : linked.data ? (
                  <Text style={styles.linkTitle}>{linked.data.title}</Text>
                ) : (
                  <Text style={[styles.linkTitle, { color: colors.danger }]}>
                    {linked.error ? errorMessage(linked.error) : 'Kegiatan tidak ditemukan.'}
                  </Text>
                )
              ) : (
                <Text style={styles.linkTitle}>
                  {programLink?.program_code}.{programLink?.item_code} · {programLink?.title}
                </Text>
              )}
            </View>
          </View>
        )}

        <Card style={styles.card}>
          <DateTimeField
            label="Tanggal Kegiatan"
            mode="date"
            required
            value={date}
            onChange={(d) => {
              setDate(d);
              touch();
            }}
            error={errors.activity_date}
          />
          <TextField
            label="Laporan Kegiatan"
            required
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              touch();
            }}
            placeholder="Judul singkat kegiatan"
            maxLength={MAX_TITLE}
            error={errors.title}
            hint={`${title.length}/${MAX_TITLE}`}
          />
          <TextField
            label="Uraian"
            required
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              touch();
            }}
            placeholder="Jelaskan apa yang dikerjakan"
            multiline
            numberOfLines={5}
            error={errors.description}
          />
          <TextField
            label="Tindak Lanjut"
            value={followUp}
            onChangeText={(t) => {
              setFollowUp(t);
              touch();
            }}
            placeholder="Langkah berikutnya (opsional)"
            multiline
            numberOfLines={3}
            error={errors.follow_up}
          />
          <TextField
            label="Kendala"
            value={obstacles}
            onChangeText={(t) => {
              setObstacles(t);
              touch();
            }}
            placeholder="Hambatan yang dihadapi (opsional)"
            multiline
            numberOfLines={3}
            error={errors.obstacles}
          />
        </Card>

        <Card style={styles.card}>
          <FieldLabel>Status</FieldLabel>
          {isEdit ? (
            <MutedText>Status diubah lewat tombol "Update Status" pada halaman detail.</MutedText>
          ) : (
            <>
              <Segmented<DailyActivityStatus>
                options={DAILY_ACTIVITY_STATUS_OPTIONS.map((o) => ({ ...o, color: activityStatusTones[o.value].fg }))}
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  touch();
                }}
              />
              <FieldError message={errors.status} />
            </>
          )}

          {canPickPerson && (
            <SelectField
              label="Atas nama"
              value={person?.name ?? null}
              subtitle={person ? [person.position, person.org_unit?.name].filter(Boolean).join(' · ') : null}
              placeholder="Diri sendiri (ketuk untuk memilih bawahan)"
              icon="person-outline"
              onPress={() => setPersonOpen(true)}
              onClear={() => {
                setPerson(null);
                touch();
              }}
              error={errors.user_id}
            />
          )}
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Button
          title={isEdit ? 'Simpan Perubahan' : 'Simpan Aktivitas'}
          icon="save-outline"
          onPress={submit}
          loading={saving}
        />
      </View>

      <SearchPickerModal<DailyActivityPerson>
        visible={personOpen}
        title="Laporan atas nama"
        placeholder="Cari nama / NRK"
        queryKey={queryKeys.activityPeople}
        fetcher={(q) => activityApi.people(q)}
        keyExtractor={(p) => String(p.id)}
        itemTitle={(p) => p.name}
        itemSubtitle={(p) => [p.nrk, p.position, p.org_unit?.name].filter(Boolean).join(' · ')}
        onClose={() => setPersonOpen(false)}
        onSelect={(p) => {
          setPerson(p.id === me?.id ? null : p);
          setPersonOpen(false);
          touch();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  card: { gap: 12 },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#A5B4FC',
  },
  linkLabel: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' },
  linkTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
