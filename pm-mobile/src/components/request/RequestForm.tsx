import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { SearchPickerModal } from '@/components/SearchPickerModal';
import {
  Button,
  Card,
  ChipGroup,
  ErrorView,
  FieldError,
  FieldLabel,
  InfoRow,
  LoadingView,
  Segmented,
  SelectField,
  TextField,
} from '@/components/ui';
import { applyRequestResult } from '@/hooks/useServiceRequest';
import { ApiError, errorMessage } from '@/lib/api';
import { MAX_ATTACHMENTS_PER_WO } from '@/lib/config';
import { lookupApi, requestApi } from '@/lib/endpoints';
import { digitsOnly, formatRupiah, groupThousands } from '@/lib/format';
import { chooseFileSource, isImageFile, uploadFiles, type PickedFile } from '@/lib/photos';
import { queryKeys } from '@/lib/queryClient';
import { colors, priorityTones, radius, REQUEST_PRIORITY_OPTIONS } from '@/lib/theme';
import type { Priority, RequestIdentity, ServiceRequestBody, ServiceRequestDetail, SuperiorCandidate, UserBrief } from '@/lib/types';
import { RulesBlock } from './RulesBlock';

type Errors = Partial<Record<keyof ServiceRequestBody | 'superior', string>>;
type Superior = (UserBrief & { grade_code?: string | null }) | null;

const MAX_FILES = MAX_ATTACHMENTS_PER_WO;

/** Create (no `initial`) or edit (draft `initial`) a Form Request; "Simpan Draf" or "Simpan & Ajukan". */
export function RequestForm({ initial }: { initial?: ServiceRequestDetail }) {
  const router = useRouter();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();

  const units = useQuery({
    queryKey: queryKeys.requestExecutorUnits,
    queryFn: lookupApi.requestExecutorUnits,
    staleTime: 5 * 60_000,
  });
  const offices = useQuery({ queryKey: queryKeys.offices, queryFn: lookupApi.offices, staleTime: 30 * 60_000 });
  const mySuperior = useQuery({
    queryKey: queryKeys.mySuperior,
    queryFn: lookupApi.mySuperior,
    enabled: !initial,
    staleTime: 5 * 60_000,
  });

  const [officeId, setOfficeId] = useState<number | null>(initial?.office?.id ?? null);
  const [unitId, setUnitId] = useState<number | null>(initial?.executor_unit?.id ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(initial?.service_category?.id ?? null);
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium');
  const [purpose, setPurpose] = useState(initial?.purpose ?? '');
  const [cost, setCost] = useState(
    initial?.estimated_cost != null && initial.estimated_cost !== '' ? String(Math.round(Number(initial.estimated_cost))) : '',
  );
  const [superior, setSuperior] = useState<Superior>(initial?.superior ?? null);
  const [superiorTouched, setSuperiorTouched] = useState(!!initial);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [superiorOpen, setSuperiorOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const savedId = useRef<number | null>(initial?.id ?? null);
  const leaving = useRef(false);

  const unit = useMemo(() => units.data?.find((u) => u.id === unitId) ?? null, [units.data, unitId]);
  const existingCount = initial?.attachments?.length ?? 0;
  const canSubmit = !initial || initial.permissions?.can_submit;

  // Default superior (Portal atasan_id) for new requests.
  useEffect(() => {
    if (!initial && !superiorTouched && mySuperior.data !== undefined) setSuperior(mySuperior.data);
  }, [initial, superiorTouched, mySuperior.data]);

  // Auto-select when there is only one choice.
  useEffect(() => {
    if (units.data?.length === 1 && unitId === null) setUnitId(units.data[0].id);
  }, [units.data, unitId]);
  useEffect(() => {
    if (offices.data?.length === 1 && officeId === null) setOfficeId(offices.data[0].id);
  }, [offices.data, officeId]);

  // Confirm before discarding unsaved input.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!dirty || leaving.current || saving) return;
      e.preventDefault();
      Alert.alert('Batalkan pengisian?', 'Perubahan yang belum disimpan akan hilang.', [
        { text: 'Lanjut Mengisi', style: 'cancel' },
        { text: 'Buang', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, dirty, saving]);

  const touch = () => setDirty(true);

  const identity: RequestIdentity = initial?.identity ?? {
    name: me?.name ?? null,
    employment_status: me?.employment_status ?? null,
    nrk: me?.nrk ?? null,
    position: me?.position ?? null,
    superior_name: superior?.name ?? null,
    bagian: me?.bagian ?? null,
    sub_bagian: me?.sub_bagian ?? null,
    email: me?.email ?? null,
    phone: me?.phone ?? null,
  };

  const addFiles = async () => {
    const remaining = MAX_FILES - existingCount - files.length;
    if (remaining <= 0) {
      Alert.alert('Batas lampiran', `Maksimal ${MAX_FILES} lampiran per Form Request.`);
      return;
    }
    const picked = await chooseFileSource(remaining, { allowDocuments: true });
    if (picked.length) {
      touch();
      setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES - existingCount));
    }
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!officeId) e.office_id = 'Pilih office.';
    if (!unitId) e.executor_unit_id = 'Pilih divisi pelaksana.';
    if (!categoryId) e.service_category_id = 'Pilih jenis permintaan.';
    if (!purpose.trim()) e.purpose = 'Keperluan wajib diisi.';
    return e;
  };

  const save = async (submit: boolean) => {
    const clientErrors = validate();
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      Alert.alert('Data belum lengkap', Object.values(clientErrors).join('\n'));
      return;
    }
    const costDigits = digitsOnly(cost);
    const body: ServiceRequestBody = {
      executor_unit_id: unitId as number,
      service_category_id: categoryId as number,
      office_id: officeId as number,
      purpose: purpose.trim(),
      priority,
      estimated_cost: costDigits ? Number(costDigits) : null,
      superior_id: superior?.id ?? null,
    };

    setSaving(submit ? 'submit' : 'draft');
    setProgress('Menyimpan…');
    let id = savedId.current;
    try {
      const saved = id ? await requestApi.update(id, body) : await requestApi.create(body);
      id = saved.id;
      savedId.current = id;
      applyRequestResult(qc, id, saved);
      setDirty(false);

      if (files.length) {
        const targetId = id;
        const { failed, firstError } = await uploadFiles(
          (file, collection) => requestApi.uploadAttachment(targetId, file, collection),
          files,
          (f) => (isImageFile(f) ? 'photo_before' : 'document'),
          (done, total) => setProgress(`Mengunggah lampiran ${Math.min(done + 1, total)}/${total}…`),
        );
        setFiles([]);
        void qc.invalidateQueries({ queryKey: queryKeys.request(targetId) });
        if (failed) {
          Alert.alert(
            'Sebagian lampiran gagal diunggah',
            `${failed} dari ${files.length} file gagal (${errorMessage(firstError)}). Tambahkan lagi dari halaman detail.`,
          );
        }
      }

      if (submit) {
        setProgress('Mengajukan…');
        try {
          const submitted = await requestApi.submit(id, superior?.id ?? null);
          applyRequestResult(qc, id, submitted);
        } catch (e) {
          Alert.alert('Draf tersimpan, tetapi gagal diajukan', `${errorMessage(e)}\n\nAnda dapat mengajukan ulang dari halaman detail.`);
        }
      }

      leaving.current = true;
      if (initial) router.back();
      else router.replace(`/requests/${id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const serverErrors: Errors = {};
        for (const [field, messages] of Object.entries(e.errors)) serverErrors[field as keyof Errors] = messages[0];
        setErrors(serverErrors);
      }
      Alert.alert('Gagal menyimpan Form Request', errorMessage(e));
    } finally {
      setSaving(null);
      setProgress(null);
    }
  };

  if (units.isLoading || offices.isLoading) return <LoadingView message="Memuat formulir…" />;
  if (units.isError || offices.isError) {
    return (
      <ErrorView
        message={errorMessage(units.error ?? offices.error)}
        onRetry={() => {
          void units.refetch();
          void offices.refetch();
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {initial && initial.revision_no > 0 && (
          <View style={styles.revision}>
            <Ionicons name="refresh" size={20} color="#C2410C" />
            <Text style={styles.revisionText}>
              Revisi ke-{initial.revision_no}. Periksa catatan revisi di halaman detail sebelum mengajukan ulang.
            </Text>
          </View>
        )}

        <Card style={styles.card}>
          <FieldLabel>Identitas Pemohon</FieldLabel>
          <View style={styles.identity}>
            <InfoRow label="Nama" value={identity.name} />
            <InfoRow label="NRK" value={identity.nrk} />
            <InfoRow label="Jabatan" value={identity.position} />
            <InfoRow label="Status Karyawan" value={identity.employment_status} />
            <InfoRow label="Bagian / Sub Bagian" value={[identity.bagian, identity.sub_bagian].filter(Boolean).join(' / ')} />
            <InfoRow label="Email" value={identity.email} />
            <InfoRow label="No. HP" value={identity.phone} />
          </View>
          <Text style={styles.hint}>Diambil otomatis dari profil Portal INTES.</Text>
        </Card>

        <Card style={styles.card}>
          <FieldLabel required>Office</FieldLabel>
          <ChipGroup
            options={(offices.data ?? []).map((o) => ({ value: o.id, label: o.name }))}
            value={officeId}
            onChange={(v) => {
              touch();
              setOfficeId(v);
            }}
          />
          <FieldError message={errors.office_id} />

          <FieldLabel required>Divisi Pelaksana</FieldLabel>
          <ChipGroup
            options={(units.data ?? []).map((u) => ({ value: u.id, label: u.display_name }))}
            value={unitId}
            onChange={(v) => {
              if (v === unitId) return;
              touch();
              setUnitId(v);
              setCategoryId(null);
            }}
          />
          <FieldError message={errors.executor_unit_id} />

          {unit && (
            <>
              <FieldLabel required>Jenis Permintaan</FieldLabel>
              {unit.categories.length ? (
                <ChipGroup
                  options={unit.categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={categoryId}
                  onChange={(v) => {
                    touch();
                    setCategoryId(v);
                  }}
                />
              ) : (
                <Text style={styles.hint}>Divisi ini belum memiliki jenis permintaan.</Text>
              )}
              <FieldError message={errors.service_category_id} />
            </>
          )}
        </Card>

        <Card style={styles.card}>
          <FieldLabel required>Prioritas</FieldLabel>
          <Segmented
            options={REQUEST_PRIORITY_OPTIONS.map((p) => ({ ...p, color: priorityTones[p.value].fg }))}
            value={priority}
            onChange={(v) => {
              touch();
              setPriority(v);
            }}
          />
          <FieldError message={errors.priority} />
          <TextField
            label="Keperluan"
            required
            value={purpose}
            onChangeText={(t) => {
              touch();
              setPurpose(t);
            }}
            placeholder="Jelaskan kebutuhan, mis. laptop untuk staf baru, akses aplikasi, dll."
            multiline
            numberOfLines={5}
            error={errors.purpose}
          />
          <TextField
            label="Estimasi Biaya (Rp)"
            value={cost ? groupThousands(cost) : ''}
            onChangeText={(t) => {
              touch();
              setCost(digitsOnly(t));
            }}
            keyboardType="number-pad"
            placeholder="Opsional"
            hint={cost ? formatRupiah(Number(digitsOnly(cost))) : 'Kosongkan bila belum diketahui.'}
            error={errors.estimated_cost}
          />
        </Card>

        <Card style={styles.card}>
          <SelectField
            label="Atasan YBS (penyetuju pertama)"
            value={superior?.name ?? null}
            subtitle={[superior?.nrk, superior?.position, superior?.grade_code].filter(Boolean).join(' · ')}
            placeholder={mySuperior.isLoading ? 'Memuat atasan…' : 'Pilih atasan'}
            icon="person-circle-outline"
            onPress={() => setSuperiorOpen(true)}
            onClear={() => {
              touch();
              setSuperiorTouched(true);
              setSuperior(null);
            }}
            error={errors.superior_id ?? errors.superior}
          />
          <Text style={styles.hint}>
            {superior
              ? 'Default dari data atasan di Portal. Ketuk untuk mengganti.'
              : 'Tanpa atasan: langkah persetujuan Atasan YBS akan dilewati bila Anda tidak memiliki atasan.'}
          </Text>
        </Card>

        {(unit?.request_rules || unit?.contact_footer || initial?.rules) && (
          <RulesBlock
            rules={unit?.request_rules ?? initial?.rules ?? null}
            contactFooter={unit?.contact_footer ?? initial?.contact_footer ?? null}
          />
        )}

        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <FieldLabel>Lampiran (foto / PDF)</FieldLabel>
            <Text style={styles.hint}>
              {existingCount + files.length}/{MAX_FILES}
            </Text>
          </View>
          {existingCount > 0 && (
            <Text style={styles.hint}>{existingCount} lampiran sudah tersimpan (lihat di halaman detail).</Text>
          )}
          {files.length > 0 && (
            <View style={styles.fileGrid}>
              {files.map((f, i) => (
                <View key={`${f.uri}-${i}`} style={styles.fileWrap}>
                  {isImageFile(f) ? (
                    <Image source={{ uri: f.uri }} style={styles.fileThumb} />
                  ) : (
                    <View style={[styles.fileThumb, styles.docThumb]}>
                      <Ionicons name="document-text-outline" size={30} color={colors.primary} />
                      <Text style={styles.docName} numberOfLines={2}>
                        {f.name}
                      </Text>
                    </View>
                  )}
                  <Pressable
                    onPress={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    style={styles.fileRemove}
                    hitSlop={8}
                    accessibilityLabel="Hapus lampiran"
                  >
                    <Ionicons name="close" size={18} color={colors.white} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Button
            title="Tambah Lampiran"
            icon="attach"
            variant="secondary"
            onPress={addFiles}
            disabled={existingCount + files.length >= MAX_FILES}
          />
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        {progress && <Text style={styles.progress}>{progress}</Text>}
        <View style={styles.footerRow}>
          <Button
            title="Simpan Draf"
            icon="save-outline"
            variant="secondary"
            onPress={() => void save(false)}
            loading={saving === 'draft'}
            disabled={!!saving}
            style={{ flex: 1 }}
          />
          {canSubmit && (
            <Button
              title="Simpan & Ajukan"
              icon="send"
              onPress={() => void save(true)}
              loading={saving === 'submit'}
              disabled={!!saving}
              style={{ flex: 1.2 }}
            />
          )}
        </View>
      </View>

      <SearchPickerModal<SuperiorCandidate>
        visible={superiorOpen}
        title="Pilih Atasan"
        placeholder="Cari nama / NRK atasan"
        queryKey={['superior-candidates']}
        fetcher={(q) => lookupApi.superiorCandidates(q)}
        keyExtractor={(u) => String(u.id)}
        itemTitle={(u) => u.name}
        itemSubtitle={(u) => [u.nrk, u.position, u.grade_code].filter(Boolean).join(' · ')}
        onClose={() => setSuperiorOpen(false)}
        onSelect={(u) => {
          touch();
          setSuperiorTouched(true);
          setSuperior(u);
          setSuperiorOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  card: { gap: 12 },
  identity: { gap: 10 },
  hint: { fontSize: 13, color: colors.textSubtle },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  revision: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: '#FFEDD5',
    alignItems: 'flex-start',
  },
  revisionText: { flex: 1, color: '#9A3412', fontSize: 14, fontWeight: '600' },
  fileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fileWrap: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden' },
  fileThumb: { width: '100%', height: '100%', backgroundColor: '#E2E8F0' },
  docThumb: { alignItems: 'center', justifyContent: 'center', padding: 6, gap: 4 },
  docName: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  fileRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,42,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  footerRow: { flexDirection: 'row', gap: 12 },
  progress: { textAlign: 'center', color: colors.textMuted, fontSize: 15 },
});
