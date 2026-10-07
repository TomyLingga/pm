import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { DateTimeField } from '@/components/DateTimeField';
import { MaterialsEditor, materialRowsFrom, validateMaterials, type MaterialRow } from '@/components/MaterialsEditor';
import { SearchPickerModal } from '@/components/SearchPickerModal';
import {
  Button,
  Card,
  ErrorView,
  FieldError,
  FieldLabel,
  LoadingView,
  Segmented,
  SelectField,
  TextField,
} from '@/components/ui';
import { applyWorkOrderResult, useWorkOrder } from '@/hooks/useWorkOrder';
import { ApiError, errorMessage } from '@/lib/api';
import { CLEARANCE_OPTIONS, clearanceItems } from '@/lib/clearance';
import { lookupApi, workOrderApi } from '@/lib/endpoints';
import { formatDuration, minutesBetween, toApiDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { colors, radius } from '@/lib/theme';
import { toast } from '@/lib/toast';
import type {
  ClearanceResult,
  LabourInput,
  MaterialInput,
  StaffMember,
  WorkOrderDetail,
} from '@/lib/types';

interface LabourRow {
  key: string;
  user_id: number | null;
  worker_name: string;
  started: Date | null;
  finished: Date | null;
}

let rowSeq = 0;
const newKey = () => `row-${Date.now()}-${rowSeq++}`;

const parseDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

type Errors = Record<string, string>;

function validateLabours(rows: LabourRow[], errors: Errors): LabourInput[] {
  const out: LabourInput[] = [];
  rows.forEach((r) => {
    let ok = true;
    if (!r.worker_name.trim()) {
      errors[`l.${r.key}.worker`] = 'Pilih atau isi nama pekerja.';
      ok = false;
    }
    if (!r.started) {
      errors[`l.${r.key}.start`] = 'Isi jam mulai.';
      ok = false;
    }
    if (!r.finished) {
      errors[`l.${r.key}.finish`] = 'Isi jam selesai.';
      ok = false;
    }
    if (r.started && r.finished && r.finished.getTime() <= r.started.getTime()) {
      errors[`l.${r.key}.finish`] = 'Jam selesai harus setelah jam mulai.';
      ok = false;
    }
    if (ok && r.started && r.finished) {
      out.push({
        user_id: r.user_id,
        worker_name: r.worker_name.trim(),
        started_at: toApiDateTime(r.started),
        finished_at: toApiDateTime(r.finished),
      });
    }
  });
  return out;
}

export default function CompleteWorkOrderScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const query = useWorkOrder(id);
  const wo = query.data;

  const [initialized, setInitialized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [workDone, setWorkDone] = useState('');
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [labours, setLabours] = useState<LabourRow[]>([]);
  const [clearance, setClearance] = useState<Record<number, ClearanceResult | undefined>>({});
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [workerPickerFor, setWorkerPickerFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const leaving = useRef(false);

  // Prefill once from the current detail.
  useEffect(() => {
    if (!wo || initialized) return;
    setWorkDone(wo.work_done ?? '');
    setRemarks(wo.remarks ?? '');
    setMaterials(materialRowsFrom(wo.materials));
    const existing = (wo.labours ?? []).map<LabourRow>((l) => ({
      key: newKey(),
      user_id: l.user_id,
      worker_name: l.worker_name,
      started: parseDate(l.started_at),
      finished: parseDate(l.finished_at),
    }));
    if (existing.length === 0 && me) {
      existing.push({
        key: newKey(),
        user_id: me.id,
        worker_name: me.name,
        started: parseDate(wo.picked_at),
        finished: null,
      });
    }
    setLabours(existing);
    const c: Record<number, ClearanceResult | undefined> = {};
    for (const item of wo.clearances ?? []) if (item.mtc_result) c[item.item_no] = item.mtc_result;
    setClearance(c);
    setInitialized(true);
  }, [wo, initialized, me]);

  // Confirm before leaving with unsaved changes.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!dirty || leaving.current) return;
      e.preventDefault();
      Alert.alert('Perubahan belum disimpan', 'Keluar tanpa menyimpan? Gunakan "Simpan Draf" untuk menyimpan material & pekerja.', [
        { text: 'Tetap di sini', style: 'cancel' },
        { text: 'Keluar', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, dirty]);

  const touch = () => setDirty(true);

  const updateLabour = (key: string, patch: Partial<LabourRow>) => {
    touch();
    setLabours((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addLabour = () => {
    touch();
    setLabours((rows) => {
      const last = rows[rows.length - 1];
      return [
        ...rows,
        { key: newKey(), user_id: null, worker_name: '', started: last?.started ?? null, finished: last?.finished ?? null },
      ];
    });
  };

  if (!Number.isFinite(id) || id <= 0) return <ErrorView message="ID Work Order tidak valid." />;
  if (query.isLoading || (wo && !initialized)) return <LoadingView />;
  if (!wo) return <ErrorView message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;

  const p = wo.permissions;
  const canDraft = !!(p?.can_work || p?.can_complete);
  const canComplete = !!p?.can_complete;
  const items = clearanceItems(wo.clearances);
  const unitId = wo.executor_unit.id;

  const totalMinutes = labours.reduce((sum, r) => sum + (minutesBetween(r.started, r.finished) ?? 0), 0);

  const applyServerErrors = (e: unknown) => {
    if (e instanceof ApiError && e.status === 422) {
      const mapped: Errors = {};
      for (const [field, msgs] of Object.entries(e.errors)) mapped[field] = msgs[0];
      setErrors((prev) => ({ ...prev, ...mapped }));
    }
    if (e instanceof ApiError && e.status === 409) void query.refetch();
  };

  const saveDraft = async () => {
    const e: Errors = {};
    const mats = validateMaterials(materials, e);
    const labs = validateLabours(labours, e);
    setErrors(e);
    if (Object.keys(e).length) {
      Alert.alert('Periksa isian', 'Lengkapi baris material/pekerja yang ditandai merah.');
      return;
    }
    setSaving(true);
    try {
      const r1 = await workOrderApi.updateMaterials(id, mats);
      applyWorkOrderResult(qc, id, r1);
      const r2 = await workOrderApi.updateLabours(id, labs);
      applyWorkOrderResult(qc, id, r2);
      setDirty(false);
      toast('Draf material & pekerja tersimpan');
    } catch (err) {
      applyServerErrors(err);
      Alert.alert('Gagal menyimpan draf', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const doComplete = async (mats: MaterialInput[], labs: LabourInput[]) => {
    setCompleting(true);
    try {
      const detail: WorkOrderDetail = await workOrderApi.complete(id, {
        work_done: workDone.trim(),
        materials: mats,
        labours: labs,
        clearance: items.map((it) => ({ item_no: it.item_no, result: clearance[it.item_no] as ClearanceResult })),
        remarks: remarks.trim() || null,
      });
      applyWorkOrderResult(qc, id, detail);
      void qc.invalidateQueries({ queryKey: queryKeys.notifications });
      leaving.current = true;
      toast('WO selesai — menunggu konfirmasi pemohon');
      router.back();
    } catch (err) {
      applyServerErrors(err);
      Alert.alert('Gagal menyelesaikan WO', errorMessage(err));
    } finally {
      setCompleting(false);
    }
  };

  const complete = () => {
    const e: Errors = {};
    if (!workDone.trim()) e.work_done = 'Uraikan pekerjaan perbaikan yang sudah dilakukan.';
    const mats = validateMaterials(materials, e);
    const labs = validateLabours(labours, e);
    if (labours.length === 0) e.labours = 'Tambahkan minimal satu pekerja.';
    for (const it of items) if (!clearance[it.item_no]) e[`c${it.item_no}`] = 'Pilih OK atau TDK.';
    setErrors(e);
    if (Object.keys(e).length) {
      Alert.alert('Data belum lengkap', 'Periksa kembali isian yang ditandai merah.');
      return;
    }
    Alert.alert('Selesaikan WO?', 'Pemohon akan diminta mengonfirmasi penerimaan pekerjaan.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Selesai', onPress: () => void doComplete(mats, labs) },
    ]);
  };

  const staffFetcher = async (q: string): Promise<StaffMember[]> => {
    const list = await qc.fetchQuery({
      queryKey: queryKeys.staff(unitId),
      queryFn: () => lookupApi.staff(unitId),
      staleTime: 5 * 60_000,
    });
    const needle = q.toLowerCase();
    return needle ? list.filter((s) => s.name.toLowerCase().includes(needle) || s.nrk?.includes(needle)) : list;
  };

  if (!canDraft) {
    return (
      <ErrorView
        message="Anda tidak dapat mengubah data pekerjaan WO ini pada status saat ini."
        onRetry={() => router.back()}
        retryLabel="Kembali"
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.woNumber}>{wo.wo_number}</Text>

        <Card style={styles.card}>
          <TextField
            label="Pekerjaan Perbaikan Selesai"
            required={canComplete}
            value={workDone}
            onChangeText={(t) => {
              touch();
              setWorkDone(t);
            }}
            placeholder="Uraikan tindakan perbaikan yang dilakukan"
            multiline
            numberOfLines={5}
            error={errors.work_done}
          />
        </Card>

        {/* Materials */}
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <FieldLabel>Material</FieldLabel>
            <Text style={styles.muted}>{materials.length} baris</Text>
          </View>
          <MaterialsEditor
            rows={materials}
            onChange={(rows) => {
              touch();
              setMaterials(rows);
            }}
            errors={errors}
          />
        </Card>

        {/* Labours */}
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <FieldLabel required={canComplete}>Pekerja</FieldLabel>
            <Text style={styles.total}>Total {formatDuration(totalMinutes)}</Text>
          </View>
          <FieldError message={errors.labours} />
          {labours.map((l, i) => {
            const duration = minutesBetween(l.started, l.finished);
            return (
              <View key={l.key} style={styles.rowCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.rowTitle}>Pekerja {i + 1}</Text>
                  <Pressable
                    onPress={() => {
                      touch();
                      setLabours((rows) => rows.filter((r) => r.key !== l.key));
                    }}
                    hitSlop={10}
                    style={styles.removeBtn}
                    accessibilityLabel="Hapus pekerja"
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.danger} />
                  </Pressable>
                </View>
                <SelectField
                  value={l.worker_name || null}
                  subtitle={l.user_id ? 'Staf unit pelaksana' : 'Isian bebas'}
                  placeholder="Pilih teknisi / isi nama"
                  icon="person-outline"
                  onPress={() => setWorkerPickerFor(l.key)}
                  error={errors[`l.${l.key}.worker`]}
                />
                <View style={styles.inline}>
                  <DateTimeField
                    label="Mulai"
                    value={l.started}
                    onChange={(d) => updateLabour(l.key, { started: d })}
                    error={errors[`l.${l.key}.start`]}
                  />
                  <DateTimeField
                    label="Selesai"
                    value={l.finished}
                    onChange={(d) => updateLabour(l.key, { finished: d })}
                    error={errors[`l.${l.key}.finish`]}
                  />
                </View>
                <Text style={styles.duration}>Durasi: {formatDuration(duration)}</Text>
              </View>
            );
          })}
          <Button title="Tambah Pekerja" icon="person-add-outline" variant="secondary" onPress={addLabour} />
        </Card>

        {/* Clearance */}
        <Card style={styles.card}>
          <FieldLabel required={canComplete}>Maintenance Clearance Checklist</FieldLabel>
          {items.map((it) => (
            <View key={it.item_no} style={{ gap: 8 }}>
              <Text style={styles.clearanceLabel}>
                {it.item_no}. {it.item_label}
              </Text>
              <Segmented
                options={CLEARANCE_OPTIONS}
                value={clearance[it.item_no] ?? null}
                onChange={(v) => {
                  touch();
                  setClearance((prev) => ({ ...prev, [it.item_no]: v }));
                }}
              />
              <FieldError message={errors[`c${it.item_no}`]} />
            </View>
          ))}
          <TextField
            label="Remarks"
            value={remarks}
            onChangeText={(t) => {
              touch();
              setRemarks(t);
            }}
            multiline
            numberOfLines={3}
            placeholder="Catatan tambahan (opsional)"
          />
        </Card>
        <Text style={styles.hint}>
          "Simpan Draf" menyimpan daftar material & pekerja. Uraian pekerjaan, clearance dan remarks dikirim saat
          menekan "Selesai".
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Button
          title="Simpan Draf"
          icon="save-outline"
          variant="secondary"
          onPress={saveDraft}
          loading={saving}
          disabled={completing}
          style={{ flex: 1 }}
        />
        {canComplete && (
          <Button
            title="Selesai"
            icon="checkmark-done"
            variant="success"
            onPress={complete}
            loading={completing}
            disabled={saving}
            style={{ flex: 1 }}
          />
        )}
      </View>

      <SearchPickerModal<StaffMember>
        visible={!!workerPickerFor}
        title="Pilih Pekerja"
        placeholder="Cari nama / NRK, atau ketik nama pekerja"
        queryKey={['staff-search', unitId]}
        fetcher={staffFetcher}
        keyExtractor={(s) => String(s.id)}
        itemTitle={(s) => s.name}
        itemSubtitle={(s) => [s.nrk, s.position].filter(Boolean).join(' · ')}
        onClose={() => setWorkerPickerFor(null)}
        onSelect={(s) => {
          if (workerPickerFor) updateLabour(workerPickerFor, { user_id: s.id, worker_name: s.name });
          setWorkerPickerFor(null);
        }}
        onFreeText={(text) => {
          if (workerPickerFor) updateLabour(workerPickerFor, { user_id: null, worker_name: text });
          setWorkerPickerFor(null);
        }}
        freeTextLabel={(t) => `Pekerja lain: "${t}"`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  woNumber: { fontSize: 18, fontWeight: '800', color: colors.text },
  card: { gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  muted: { fontSize: 14, color: colors.textSubtle },
  total: { fontSize: 15, fontWeight: '800', color: colors.primary },
  rowCard: {
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  removeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', gap: 10 },
  duration: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  clearanceLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.textSubtle, paddingHorizontal: 4 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
