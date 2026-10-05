import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchPickerModal } from '@/components/SearchPickerModal';
import {
  Button,
  Card,
  ChipGroup,
  ErrorView,
  FieldError,
  FieldLabel,
  LoadingView,
  Segmented,
  SelectField,
  TextField,
} from '@/components/ui';
import { applyWorkOrderResult } from '@/hooks/useWorkOrder';
import { ApiError, errorMessage } from '@/lib/api';
import { MAX_ATTACHMENTS_PER_WO } from '@/lib/config';
import { lookupApi, workOrderApi } from '@/lib/endpoints';
import { choosePhotoSource, uploadPhotos, type PhotoAsset } from '@/lib/photos';
import { queryKeys } from '@/lib/queryClient';
import { colors, PRIORITY_OPTIONS, priorityTones, radius } from '@/lib/theme';
import type { CreateWorkOrderBody, EquipmentItem, LocationItem, Priority } from '@/lib/types';

type Errors = Partial<Record<keyof CreateWorkOrderBody | 'photos', string>>;

export default function NewWorkOrderScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();

  const units = useQuery({ queryKey: queryKeys.executorUnits, queryFn: lookupApi.executorUnits, staleTime: 5 * 60_000 });

  const [unitId, setUnitId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categoryNote, setCategoryNote] = useState('');
  const [equipment, setEquipment] = useState<EquipmentItem | null>(null);
  const [manualEquipment, setManualEquipment] = useState(false);
  const [equipmentCode, setEquipmentCode] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [location, setLocation] = useState<LocationItem | null>(null);
  const [locationNote, setLocationNote] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const unit = useMemo(() => units.data?.find((u) => u.id === unitId) ?? null, [units.data, unitId]);
  const category = useMemo(() => unit?.categories.find((c) => c.id === categoryId) ?? null, [unit, categoryId]);

  // Auto-select when there is only one executor unit.
  useEffect(() => {
    if (units.data?.length === 1 && unitId === null) setUnitId(units.data[0].id);
  }, [units.data, unitId]);

  const dirty = !!(description || photos.length || equipment || equipmentName || location);

  // Confirm before discarding a filled form.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!dirty || submitting) return;
      e.preventDefault();
      Alert.alert('Batalkan pengisian?', 'Data yang sudah diisi akan hilang.', [
        { text: 'Lanjut Mengisi', style: 'cancel' },
        { text: 'Buang', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, dirty, submitting]);

  const selectUnit = (id: number) => {
    if (id === unitId) return;
    setUnitId(id);
    setCategoryId(null);
    setCategoryNote('');
    setEquipment(null);
  };

  const addPhotos = async () => {
    const remaining = MAX_ATTACHMENTS_PER_WO - photos.length;
    if (remaining <= 0) {
      Alert.alert('Batas foto', `Maksimal ${MAX_ATTACHMENTS_PER_WO} foto per WO.`);
      return;
    }
    const picked = await choosePhotoSource(remaining);
    if (picked.length) setPhotos((prev) => [...prev, ...picked].slice(0, MAX_ATTACHMENTS_PER_WO));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!unitId) e.executor_unit_id = 'Pilih unit pelaksana.';
    if (!categoryId) e.service_category_id = 'Pilih kategori pekerjaan.';
    if (category?.requires_note && !categoryNote.trim()) e.category_note = 'Keterangan kategori wajib diisi.';
    if (manualEquipment && !equipmentName.trim() && !equipmentCode.trim())
      e.equipment_name = 'Isi kode atau nama alat, atau matikan isian manual.';
    if (!description.trim()) e.request_description = 'Uraikan permintaan pekerjaan.';
    return e;
  };

  const submit = async () => {
    const clientErrors = validate();
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      Alert.alert('Data belum lengkap', Object.values(clientErrors).join('\n'));
      return;
    }

    const body: CreateWorkOrderBody = {
      executor_unit_id: unitId as number,
      service_category_id: categoryId as number,
      category_note: category?.requires_note ? categoryNote.trim() : null,
      equipment_id: manualEquipment ? null : equipment?.id ?? null,
      equipment_code: manualEquipment ? equipmentCode.trim() || null : null,
      equipment_name: manualEquipment ? equipmentName.trim() || null : null,
      location_id: location?.id ?? null,
      location_note: locationNote.trim() || null,
      request_description: description.trim(),
      priority,
    };

    setSubmitting(true);
    setProgress('Menyimpan WO…');
    try {
      const created = await workOrderApi.create(body);
      applyWorkOrderResult(qc, created.id, created);

      if (photos.length) {
        const { failed, firstError } = await uploadPhotos(created.id, photos, 'photo_before', (done, total) =>
          setProgress(`Mengunggah foto ${Math.min(done + 1, total)}/${total}…`),
        );
        await qc.invalidateQueries({ queryKey: queryKeys.workOrder(created.id) });
        if (failed > 0) {
          Alert.alert(
            'Sebagian foto gagal diunggah',
            `${failed} dari ${photos.length} foto gagal diunggah (${errorMessage(firstError)}). ` +
              'Anda dapat menambahkannya lagi dari halaman detail WO.',
          );
        }
      }

      setPhotos([]);
      setDescription('');
      router.replace(`/work-orders/${created.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const serverErrors: Errors = {};
        for (const [field, messages] of Object.entries(e.errors)) {
          serverErrors[field as keyof Errors] = messages[0];
        }
        setErrors(serverErrors);
      }
      Alert.alert('Gagal membuat WO', errorMessage(e));
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  if (units.isLoading) return <LoadingView message="Memuat unit pelaksana…" />;
  if (units.isError) return <ErrorView message={errorMessage(units.error)} onRetry={() => void units.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <FieldLabel required>Unit Pelaksana Tujuan</FieldLabel>
          <ChipGroup
            options={(units.data ?? []).map((u) => ({ value: u.id, label: u.display_name }))}
            value={unitId}
            onChange={selectUnit}
          />
          <FieldError message={errors.executor_unit_id} />

          {unit && (
            <>
              <FieldLabel required>Kategori</FieldLabel>
              {unit.categories.length ? (
                <ChipGroup
                  options={unit.categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={categoryId}
                  onChange={setCategoryId}
                />
              ) : (
                <Text style={styles.muted}>Unit ini belum memiliki kategori.</Text>
              )}
              <FieldError message={errors.service_category_id} />
              {category?.requires_note && (
                <TextField
                  label="Keterangan Kategori"
                  required
                  value={categoryNote}
                  onChangeText={setCategoryNote}
                  placeholder="Sebutkan jenis pekerjaan"
                  error={errors.category_note}
                />
              )}
            </>
          )}
        </Card>

        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <FieldLabel>Alat / Equipment</FieldLabel>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Isi manual</Text>
              <Switch
                value={manualEquipment}
                onValueChange={(v) => {
                  setManualEquipment(v);
                  if (v) setEquipment(null);
                }}
                trackColor={{ true: colors.primary, false: colors.borderStrong }}
              />
            </View>
          </View>
          {manualEquipment ? (
            <>
              <TextField
                label="Kode / No. Alat"
                value={equipmentCode}
                onChangeText={setEquipmentCode}
                placeholder="mis. PRN-01"
                autoCapitalize="characters"
                error={errors.equipment_code}
              />
              <TextField
                label="Nama Alat"
                value={equipmentName}
                onChangeText={setEquipmentName}
                placeholder="mis. Printer Epson L3110"
                error={errors.equipment_name}
              />
            </>
          ) : (
            <SelectField
              value={equipment ? `${equipment.code} — ${equipment.name}` : null}
              subtitle={equipment?.location?.name}
              placeholder="Cari alat (opsional)"
              icon="construct-outline"
              onPress={() => setEquipmentOpen(true)}
              onClear={() => setEquipment(null)}
              error={errors.equipment_id}
            />
          )}
          <Text style={styles.hint}>Alat tidak ada di daftar? Aktifkan "Isi manual".</Text>
        </Card>

        <Card style={styles.card}>
          <SelectField
            label="Lokasi"
            value={location ? location.name : null}
            subtitle={location?.code}
            placeholder="Cari lokasi"
            icon="location-outline"
            onPress={() => setLocationOpen(true)}
            onClear={() => setLocation(null)}
            error={errors.location_id}
          />
          <TextField
            label="Keterangan Lokasi"
            value={locationNote}
            onChangeText={setLocationNote}
            placeholder="mis. Lantai 2, ruang server (opsional)"
            error={errors.location_note}
          />
        </Card>

        <Card style={styles.card}>
          <FieldLabel required>Prioritas</FieldLabel>
          <Segmented
            options={PRIORITY_OPTIONS.map((p) => ({ ...p, color: priorityTones[p.value].fg }))}
            value={priority}
            onChange={setPriority}
          />
          <FieldError message={errors.priority} />
          <TextField
            label="Permintaan Pekerjaan"
            required
            value={description}
            onChangeText={setDescription}
            placeholder="Jelaskan kerusakan / pekerjaan yang diminta"
            multiline
            numberOfLines={5}
            error={errors.request_description}
          />
        </Card>

        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <FieldLabel>Foto Kondisi</FieldLabel>
            <Text style={styles.muted}>
              {photos.length}/{MAX_ATTACHMENTS_PER_WO}
            </Text>
          </View>
          {photos.length > 0 && (
            <View style={styles.photoGrid}>
              {photos.map((p, i) => (
                <View key={`${p.uri}-${i}`} style={styles.photoWrap}>
                  <Image source={{ uri: p.uri }} style={styles.photo} />
                  <Pressable
                    onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    style={styles.photoRemove}
                    hitSlop={8}
                    accessibilityLabel="Hapus foto"
                  >
                    <Ionicons name="close" size={18} color={colors.white} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Button
            title="Tambah Foto"
            icon="camera-outline"
            variant="secondary"
            onPress={addPhotos}
            disabled={photos.length >= MAX_ATTACHMENTS_PER_WO}
          />
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        {progress && <Text style={styles.progress}>{progress}</Text>}
        <Button title="Kirim WO" icon="send" onPress={submit} loading={submitting} />
      </View>

      <SearchPickerModal<EquipmentItem>
        visible={equipmentOpen}
        title="Pilih Alat"
        placeholder="Cari kode / nama alat"
        queryKey={['equipment', unitId]}
        fetcher={(q) => lookupApi.equipment(q, unitId)}
        keyExtractor={(e) => String(e.id)}
        itemTitle={(e) => `${e.code} — ${e.name}`}
        itemSubtitle={(e) => e.location?.name}
        onClose={() => setEquipmentOpen(false)}
        onSelect={(e) => {
          setEquipment(e);
          if (!location && e.location) setLocation(e.location);
          setEquipmentOpen(false);
        }}
        onFreeText={(text) => {
          setManualEquipment(true);
          setEquipment(null);
          setEquipmentName(text);
          setEquipmentOpen(false);
        }}
        freeTextLabel={(t) => `Isi manual: "${t}"`}
      />

      <SearchPickerModal<LocationItem>
        visible={locationOpen}
        title="Pilih Lokasi"
        placeholder="Cari kode / nama lokasi"
        queryKey={['locations']}
        fetcher={(q) => lookupApi.locations(q)}
        keyExtractor={(l) => String(l.id)}
        itemTitle={(l) => l.name}
        itemSubtitle={(l) => l.code}
        onClose={() => setLocationOpen(false)}
        onSelect={(l) => {
          setLocation(l);
          setLocationOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  card: { gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchLabel: { fontSize: 15, color: colors.textMuted },
  muted: { fontSize: 15, color: colors.textSubtle },
  hint: { fontSize: 13, color: colors.textSubtle },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoRemove: {
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
  progress: { textAlign: 'center', color: colors.textMuted, fontSize: 15 },
});
