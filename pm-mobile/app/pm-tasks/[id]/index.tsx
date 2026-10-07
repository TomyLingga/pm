import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { ActionBar, type BarAction } from '@/components/ActionBar';
import { MaterialsEditor, materialRowsFrom, validateMaterials, type MaterialRow } from '@/components/MaterialsEditor';
import { ChecklistItemCard, MAX_ITEM_PHOTOS, type PhotoSource } from '@/components/pm/ChecklistItemCard';
import { ChecklistPreview, ChecklistResults } from '@/components/pm/ChecklistReadOnly';
import { FindingWorkOrderModal } from '@/components/pm/FindingWorkOrderModal';
import { HINT_COLORS } from '@/components/pm/PmTaskCard';
import { CompleteTaskModal, PicModal } from '@/components/pm/TaskModals';
import { Timeline } from '@/components/Timeline';
import { Button, Card, ErrorView, InfoRow, LoadingView, MutedText, Section, StatusBadge, ToneBadge } from '@/components/ui';
import { AttachmentGrid } from '@/components/workorder/Attachments';
import { ReasonModal } from '@/components/workorder/ReasonModal';
import { useChecklistAutosave } from '@/hooks/useChecklistAutosave';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { applyPmTaskResult, usePmTask, usePmTaskAction } from '@/hooks/usePmTask';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { ApiError, errorMessage } from '@/lib/api';
import { attachmentApi, pmTaskApi } from '@/lib/endpoints';
import { formatDateTime, formatDuration } from '@/lib/format';
import { pickFromGallery, takePhoto, uploadEach } from '@/lib/photos';
import { dueHint, elapsedMinutes, findingDescription, groupBySection, isItemFilled, itemProblem } from '@/lib/pm';
import { queryKeys } from '@/lib/queryClient';
import { colors, pmStatusTone, radius } from '@/lib/theme';
import { toast } from '@/lib/toast';
import type { Attachment, PmCompleteBody, PmFindingWorkOrderBody, PmTaskDetail, PmTaskItem, UserBrief } from '@/lib/types';

const MAX_TASK_PHOTOS = 10;
const EMPTY_ITEMS: PmTaskItem[] = [];
const LATE_TONE = { fg: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5' };

type ModalKind = 'complete' | 'propose' | 'skip' | 'pic' | null;

const who = (u: UserBrief | null | undefined, at?: string | null) =>
  u ? [u.name, at ? formatDateTime(at) : null].filter(Boolean).join(' · ') : at ? formatDateTime(at) : null;

/** Maps `errors["items.{id}"]` (API_PM.md §5) to item ids; everything else is returned as `other`. */
function splitCompleteErrors(errors: Record<string, string[]>, ordered: PmTaskItem[]) {
  const items: Record<number, string> = {};
  const other: Record<string, string> = {};
  const ids = new Set(ordered.map((i) => i.id));
  for (const [key, messages] of Object.entries(errors)) {
    const message = messages?.[0] ?? 'Isian belum valid.';
    const match = /^items\.(\d+)/.exec(key);
    if (match) {
      const n = Number(match[1]);
      // The contract keys errors by item id; fall back to a list index just in case.
      const id = ids.has(n) ? n : ordered[n]?.id;
      if (id !== undefined && !(id in items)) items[id] = message;
    } else {
      other[key] = message;
    }
  }
  return { items, other };
}

function Banner({
  icon,
  color,
  bg,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.bannerText, { color }]}>{children}</Text>
    </View>
  );
}

export default function PmTaskDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { token, me } = useAuth();

  const query = usePmTask(id);
  const task = query.data;
  const { refetch } = query;
  useRefreshOnFocus(refetch);

  const items = task?.items ?? EMPTY_ITEMS;
  const canWork = !!task?.permissions?.can_work;
  const autosave = useChecklistAutosave({
    taskId: id,
    items,
    enabled: canWork,
    onConflict: () => void refetch(),
  });

  // The sticky action bar is hidden while typing so the field being edited stays visible.
  const keyboardVisible = useKeyboardVisible();
  const scrollRef = useRef<ScrollView>(null);
  const itemY = useRef<Record<number, number>>({});
  const materialsY = useRef(0);

  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const [completeErrors, setCompleteErrors] = useState<{ duration_minutes?: string; notes?: string }>({});
  const [completing, setCompleting] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);
  const [uploadingGeneral, setUploadingGeneral] = useState(false);
  const [findingItem, setFindingItem] = useState<PmTaskItem | null>(null);
  const [creatingWo, setCreatingWo] = useState(false);

  // Materials (explicit save; also sent with "Selesaikan" when still unsaved).
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [materialsDirty, setMaterialsDirty] = useState(false);
  const [materialErrors, setMaterialErrors] = useState<Record<string, string>>({});
  const [savingMaterials, setSavingMaterials] = useState(false);
  const materialsSignature = JSON.stringify(task?.materials ?? []);
  const materialsDirtyRef = useRef(false);
  materialsDirtyRef.current = materialsDirty;
  useEffect(() => {
    if (!materialsDirtyRef.current) setMaterials(materialRowsFrom(task?.materials));
    // Re-sync from the server whenever its list changes and there are no local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialsSignature]);

  const start = usePmTaskAction(id, () => pmTaskApi.start(id));
  const proposeSkip = usePmTaskAction(id, (reason: string) => pmTaskApi.proposeSkip(id, reason));
  const skip = usePmTaskAction(id, (reason: string) => pmTaskApi.skip(id, reason));
  const reassign = usePmTaskAction(id, (picUserId: number) => pmTaskApi.reassign(id, picUserId));

  const sections = useMemo(() => groupBySection(items), [items]);
  const ordered = useMemo(() => sections.flatMap((s) => s.items.map((x) => x.item)), [sections]);

  // Warn before leaving with unsaved materials (checklist items save themselves).
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!materialsDirtyRef.current) return;
      e.preventDefault();
      Alert.alert('Material belum disimpan', 'Keluar tanpa menyimpan perubahan material?', [
        { text: 'Tetap di sini', style: 'cancel' },
        { text: 'Keluar', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await autosave.flush();
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [autosave, refetch]);

  /** Runs an action, toasts on success, alerts on error (409 → reload). Closes the modal on success. */
  const run = async (fn: () => Promise<unknown>, success: string): Promise<boolean> => {
    try {
      await fn();
      toast(success);
      setModal(null);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) void refetch();
      Alert.alert('Aksi gagal', errorMessage(e));
      return false;
    }
  };

  // ---- Stable callbacks for the memoised item cards ----

  const { update: updateDraft } = autosave;
  const onItemChange = useCallback(
    (itemId: number, patch: Parameters<typeof updateDraft>[1]) => {
      updateDraft(itemId, patch);
      setItemErrors((prev) => {
        if (!(itemId in prev)) return prev;
        const rest = { ...prev };
        delete rest[itemId];
        return rest;
      });
    },
    [updateDraft],
  );

  const onItemLayout = useCallback((itemId: number, y: number) => {
    itemY.current[itemId] = y;
  }, []);

  const scrollToItem = useCallback((itemId: number) => {
    const y = itemY.current[itemId];
    if (typeof y === 'number') scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, []);

  const onAddItemPhoto = useCallback(
    async (item: PmTaskItem, source: PhotoSource) => {
      const remaining = MAX_ITEM_PHOTOS - (item.attachments?.length ?? 0);
      if (remaining <= 0) {
        Alert.alert('Batas foto', `Maksimal ${MAX_ITEM_PHOTOS} foto per butir.`);
        return;
      }
      const files = source === 'camera' ? await takePhoto() : await pickFromGallery(remaining);
      if (!files.length) return;
      setUploadingItemId(item.id);
      try {
        const { failed, firstError } = await uploadEach(files, (file) => pmTaskApi.uploadAttachment(id, file, item.id));
        await qc.invalidateQueries({ queryKey: queryKeys.pmTask(id) });
        if (failed) Alert.alert('Unggah gagal', `${failed} foto gagal diunggah: ${errorMessage(firstError)}`);
        else {
          toast('Foto tersimpan');
          setItemErrors((prev) => {
            if (!(item.id in prev)) return prev;
            const rest = { ...prev };
            delete rest[item.id];
            return rest;
          });
        }
      } finally {
        setUploadingItemId(null);
      }
    },
    [id, qc],
  );

  const onDeletePhoto = useCallback(
    async (attachment: Attachment) => {
      try {
        await attachmentApi.remove(attachment.id);
        await qc.invalidateQueries({ queryKey: queryKeys.pmTask(id) });
        toast('Foto dihapus');
      } catch (e) {
        Alert.alert('Gagal menghapus foto', errorMessage(e));
      }
    },
    [id, qc],
  );

  const myId = me?.id ?? null;
  const canDeletePhoto = useCallback(
    (attachment: Attachment) => canWork && myId !== null && attachment.uploaded_by?.id === myId,
    [canWork, myId],
  );

  const onCreateWorkOrder = useCallback((item: PmTaskItem) => setFindingItem(item), []);
  const onOpenWorkOrder = useCallback((workOrderId: number) => router.push(`/work-orders/${workOrderId}`), [router]);

  // ---- Actions ----

  const addGeneralPhoto = async (detail: PmTaskDetail, source: PhotoSource) => {
    const remaining = MAX_TASK_PHOTOS - (detail.attachments?.length ?? 0);
    if (remaining <= 0) {
      Alert.alert('Batas foto', `Maksimal ${MAX_TASK_PHOTOS} foto umum per tugas.`);
      return;
    }
    const files = source === 'camera' ? await takePhoto() : await pickFromGallery(remaining);
    if (!files.length) return;
    setUploadingGeneral(true);
    try {
      const { failed, firstError } = await uploadEach(files, (file) => pmTaskApi.uploadAttachment(id, file));
      await qc.invalidateQueries({ queryKey: queryKeys.pmTask(id) });
      if (failed) Alert.alert('Unggah gagal', `${failed} foto gagal diunggah: ${errorMessage(firstError)}`);
      else toast('Foto tersimpan');
    } finally {
      setUploadingGeneral(false);
    }
  };

  const confirmStart = () =>
    Alert.alert('Mulai kerjakan?', 'Status tugas menjadi DIKERJAKAN dan checklist siap diisi.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Mulai', onPress: () => void run(() => start.mutateAsync(), 'Tugas PM dimulai') },
    ]);

  const saveMaterials = async () => {
    const errors: Record<string, string> = {};
    const payload = validateMaterials(materials, errors);
    setMaterialErrors(errors);
    if (Object.keys(errors).length) {
      Alert.alert('Periksa material', 'Lengkapi baris material yang ditandai merah.');
      return;
    }
    setSavingMaterials(true);
    try {
      const detail = await pmTaskApi.saveMaterials(id, payload);
      setMaterialsDirty(false);
      materialsDirtyRef.current = false;
      setMaterials(materialRowsFrom(detail.materials));
      qc.setQueryData(queryKeys.pmTask(id), detail);
      toast('Material tersimpan');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) void refetch();
      Alert.alert('Gagal menyimpan material', errorMessage(e));
    } finally {
      setSavingMaterials(false);
    }
  };

  /** Client-side completeness check before opening the "Selesaikan" modal. */
  const openComplete = () => {
    const problems: Record<number, string> = {};
    for (const item of ordered) {
      const draft = autosave.drafts[item.id];
      if (!draft) continue;
      const problem = autosave.rejected[item.id] ?? itemProblem(item, draft);
      if (problem) problems[item.id] = problem;
    }
    setItemErrors(problems);
    const firstInvalid = ordered.find((i) => i.id in problems);
    if (firstInvalid) {
      scrollToItem(firstInvalid.id);
      Alert.alert('Checklist belum lengkap', `${Object.keys(problems).length} butir perlu dilengkapi (ditandai merah).`);
      return;
    }
    if (materialsDirty) {
      const errors: Record<string, string> = {};
      validateMaterials(materials, errors);
      setMaterialErrors(errors);
      if (Object.keys(errors).length) {
        scrollRef.current?.scrollTo({ y: Math.max(0, materialsY.current - 12), animated: true });
        Alert.alert('Periksa material', 'Lengkapi baris material yang ditandai merah.');
        return;
      }
    }
    setCompleteErrors({});
    setModal('complete');
  };

  const submitComplete = async (durationMinutes: number | null, notes: string) => {
    setCompleting(true);
    try {
      // Make sure every checklist change is on the server before completing.
      const saved = await autosave.flush();
      if (!saved) {
        Alert.alert('Isian belum tersimpan', 'Sebagian butir checklist gagal disimpan. Periksa koneksi lalu coba lagi.');
        return;
      }
      // Optional keys are omitted (not sent as null) when empty.
      const body: PmCompleteBody = {};
      if (durationMinutes !== null) body.duration_minutes = durationMinutes;
      if (notes) body.notes = notes;
      if (materialsDirty) body.materials = validateMaterials(materials, {});
      const detail = await pmTaskApi.complete(id, body);
      setMaterialsDirty(false);
      materialsDirtyRef.current = false;
      applyPmTaskResult(qc, id, detail);
      setItemErrors({});
      setModal(null);
      toast('Tugas PM selesai');
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const { items: byItem, other } = splitCompleteErrors(e.errors, ordered);
        const firstInvalid = ordered.find((i) => i.id in byItem);
        if (firstInvalid) {
          setItemErrors(byItem);
          setModal(null);
          // Wait for the modal to close before scrolling.
          setTimeout(() => scrollToItem(firstInvalid.id), 350);
          Alert.alert('Checklist belum lengkap', `${Object.keys(byItem).length} butir ditolak server (ditandai merah).`);
          return;
        }
        setCompleteErrors({ duration_minutes: other.duration_minutes, notes: other.notes });
      }
      if (e instanceof ApiError && e.status === 409) void refetch();
      Alert.alert('Gagal menyelesaikan tugas', errorMessage(e));
    } finally {
      setCompleting(false);
    }
  };

  const submitFinding = async (body: PmFindingWorkOrderBody) => {
    if (!findingItem) return;
    const target = findingItem;
    setCreatingWo(true);
    try {
      // The server only accepts items that are already "Tidak OK" there.
      const saved = await autosave.flush();
      if (!saved) {
        Alert.alert('Isian belum tersimpan', 'Hasil butir ini belum tersimpan di server. Periksa koneksi lalu coba lagi.');
        return;
      }
      const detail = await pmTaskApi.createWorkOrder(id, target.id, body);
      applyPmTaskResult(qc, id, detail);
      void qc.invalidateQueries({ queryKey: queryKeys.workOrders });
      const wo = detail.items?.find((i) => i.id === target.id)?.work_order;
      toast(wo ? `WO ${wo.wo_number} dibuat` : 'WO dibuat');
      setFindingItem(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        void refetch();
        setFindingItem(null);
      }
      Alert.alert('Gagal membuat WO', errorMessage(e));
    } finally {
      setCreatingWo(false);
    }
  };

  // ---- Render ----

  if (!Number.isFinite(id) || id <= 0) return <ErrorView message="ID tugas PM tidak valid." />;
  if (query.isLoading) return <LoadingView message="Memuat tugas PM…" />;
  if (!task) {
    return (
      <ErrorView
        message={query.error ? errorMessage(query.error) : 'Tugas PM tidak ditemukan.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const p = task.permissions ?? ({} as PmTaskDetail['permissions']);
  const tone = pmStatusTone(task.status);
  const hint = dueHint(task);
  const mode: 'preview' | 'work' | 'results' = items.length === 0 ? 'preview' : canWork ? 'work' : 'results';
  const filled = ordered.filter((i) => {
    const d = autosave.drafts[i.id];
    return d ? isItemFilled(i, d) : false;
  }).length;
  const total = ordered.length;
  const busy = start.isPending || proposeSkip.isPending || skip.isPending || reassign.isPending || completing;
  const equipment = task.equipment;
  const equipmentLabel = equipment ? `${equipment.code} — ${equipment.name}` : null;
  const generalPhotos = task.attachments ?? [];

  const primary: BarAction[] = [];
  if (p.can_start)
    primary.push({ key: 'start', title: 'Mulai Kerjakan', icon: 'play', onPress: confirmStart, loading: start.isPending });
  if (p.can_complete)
    primary.push({ key: 'complete', title: 'Selesaikan', icon: 'checkmark-done', variant: 'success', onPress: openComplete });

  const secondary: BarAction[] = [];
  if (p.can_propose_skip)
    secondary.push({ key: 'propose', title: 'Usulkan Lewati', icon: 'play-skip-forward-outline', onPress: () => setModal('propose') });
  if (p.can_skip)
    secondary.push({ key: 'skip', title: 'Lewati', icon: 'play-skip-forward', variant: 'dangerOutline', onPress: () => setModal('skip') });
  if (p.can_reassign) secondary.push({ key: 'pic', title: 'Ganti PIC', icon: 'swap-horizontal', onPress: () => setModal('pic') });

  const saveLabel =
    autosave.state === 'saving' || autosave.state === 'pending'
      ? 'Menyimpan…'
      : autosave.state === 'saved'
        ? 'Tersimpan'
        : autosave.state === 'error'
          ? 'Gagal menyimpan — ketuk untuk coba lagi'
          : '';

  // While working, the checklist comes first; the info block moves below it.
  const infoSection = (
    <Section title="Informasi" icon="information-circle-outline">
      <InfoRow label="No. Tugas" value={task.number} />
      <InfoRow
        label="Jadwal"
        value={[task.schedule?.name, task.schedule?.frequency_label].filter(Boolean).join(' · ')}
      />
      <InfoRow label="Template Checklist" value={task.checklist_template?.name} />
      <InfoRow label="Unit Pelaksana" value={task.executor_unit?.display_name} />
      <InfoRow label="PIC" value={task.pic?.name} />
      <InfoRow label="Jatuh Tempo" value={formatDateTime(task.due_at)} />
      <InfoRow
        label="Batas Toleransi"
        value={
          task.overdue_at
            ? `${formatDateTime(task.overdue_at)}${task.tolerance_hours != null ? ` (+${task.tolerance_hours} jam)` : ''}`
            : null
        }
      />
      <InfoRow
        label="Estimasi Pengerjaan"
        value={task.estimated_minutes != null ? formatDuration(task.estimated_minutes) : null}
      />
      {!!task.started_at && <InfoRow label="Dimulai" value={who(task.started_by, task.started_at)} />}
      {!!task.completed_at && <InfoRow label="Diselesaikan" value={who(task.completed_by, task.completed_at)} />}
      {task.duration_minutes != null && <InfoRow label="Durasi" value={formatDuration(task.duration_minutes)} />}
      {!!task.notes && <InfoRow label="Catatan" value={task.notes} />}
    </Section>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: task.number }} />

      {mode === 'work' && (
        <Pressable
          onPress={() => autosave.state === 'error' && void autosave.flush()}
          disabled={autosave.state !== 'error'}
          style={styles.progressBar}
          accessibilityLabel={`Checklist ${filled} dari ${total} butir. ${saveLabel}`}
        >
          <View style={styles.progressTop}>
            <Text style={styles.progressText}>
              {filled}/{total} butir
            </Text>
            <View style={styles.saveState}>
              {(autosave.state === 'saving' || autosave.state === 'pending') && (
                <ActivityIndicator size="small" color={colors.textMuted} />
              )}
              {autosave.state === 'saved' && <Ionicons name="cloud-done-outline" size={18} color={colors.success} />}
              {autosave.state === 'error' && <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />}
              <Text
                style={[
                  styles.saveText,
                  autosave.state === 'saved' && { color: colors.success },
                  autosave.state === 'error' && { color: colors.danger },
                ]}
                numberOfLines={1}
              >
                {saveLabel}
              </Text>
            </View>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${total ? Math.round((filled / total) * 100) : 0}%` }]} />
          </View>
        </Pressable>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Summary */}
        <Card style={[styles.summary, { borderTopColor: tone.border }]}>
          <View style={styles.badges}>
            <StatusBadge status={task.status} label={task.status_label} tone={tone} />
            {task.is_late && <ToneBadge label="Terlambat" tone={LATE_TONE} />}
            {task.findings_count > 0 && <ToneBadge label={`${task.findings_count} temuan`} tone={LATE_TONE} />}
          </View>
          <Text style={styles.equipment}>{equipmentLabel ?? 'Alat tidak diketahui'}</Text>
          {!!equipment?.location_name && (
            <View style={styles.inline}>
              <Ionicons name="location-outline" size={18} color={colors.textSubtle} />
              <Text style={styles.location}>{equipment.location_name}</Text>
            </View>
          )}
          <View style={styles.dueRow}>
            <Ionicons name="alarm-outline" size={22} color={hint ? HINT_COLORS[hint.tone] : colors.textSubtle} />
            <Text style={styles.dueText}>{formatDateTime(task.due_at)}</Text>
            {hint && <Text style={[styles.dueHint, { color: HINT_COLORS[hint.tone] }]}>· {hint.text}</Text>}
          </View>
          {!!equipment && (
            <Pressable
              onPress={() => router.push(`/equipment/${equipment.id}/history`)}
              style={styles.historyLink}
              accessibilityRole="link"
            >
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={styles.historyText}>Riwayat alat</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>
          )}
        </Card>

        {!!task.skip_proposal && task.status !== 'skipped' && (
          <Banner icon="play-skip-forward-circle-outline" color="#9A3412" bg="#FFEDD5">
            Usulan lewati dari {task.skip_proposal.by?.name ?? 'teknisi'}
            {task.skip_proposal.at ? ` (${formatDateTime(task.skip_proposal.at)})` : ''}: “{task.skip_proposal.reason}”
            {p.can_skip ? '\nGunakan tombol "Lewati" untuk menyetujui.' : '\nMenunggu keputusan pimpinan unit.'}
          </Banner>
        )}
        {task.status === 'skipped' && (
          <Banner icon="play-skip-forward-circle" color="#4B5563" bg="#F3F4F6">
            Dilewati oleh {task.skipped_by?.name ?? 'sistem'}
            {task.skipped_at ? ` pada ${formatDateTime(task.skipped_at)}` : ''}
            {task.skip_reason ? ` — ${task.skip_reason}` : ''}
          </Banner>
        )}
        {task.status === 'scheduled' && !p.can_start && (
          <Banner icon="information-circle-outline" color={colors.primary} bg={colors.primarySoft}>
            Tugas dapat dimulai saat JATUH TEMPO
            {task.due_window_at ? ` (mulai ${formatDateTime(task.due_window_at)})` : ''}.
          </Banner>
        )}

        {mode !== 'work' && infoSection}

        {mode === 'preview' && (task.status !== 'skipped' || (task.checklist_preview?.length ?? 0) > 0) && (
          <Section
            title="Checklist"
            icon="list-outline"
            right={<Text style={styles.count}>{task.checklist_preview?.length ?? 0} butir</Text>}
          >
            {task.status !== 'skipped' && <MutedText>Pratinjau — checklist dapat diisi setelah tugas dimulai.</MutedText>}
            <ChecklistPreview items={task.checklist_preview ?? []} />
          </Section>
        )}

        {mode === 'results' && (
          <Section title="Hasil Checklist" icon="list-outline">
            <ChecklistResults items={items} token={token} onOpenWorkOrder={onOpenWorkOrder} />
          </Section>
        )}

        {/* Editable checklist: cards are direct children of the scroll content so their y offsets can be used for scrolling. */}
        {mode === 'work' &&
          sections.map((sec, index) => (
            <React.Fragment key={`${sec.title ?? 'none'}-${index}`}>
              {!!sec.title && <Text style={styles.sectionTitle}>{sec.title}</Text>}
              {sec.items.map(({ item, no }) => {
                const draft = autosave.drafts[item.id];
                if (!draft) return null;
                return (
                  <ChecklistItemCard
                    key={item.id}
                    no={no}
                    item={item}
                    draft={draft}
                    error={itemErrors[item.id] ?? autosave.rejected[item.id]}
                    token={token}
                    uploading={uploadingItemId === item.id}
                    canCreateWorkOrder={!!p.can_create_work_order}
                    onChange={onItemChange}
                    onAddPhoto={onAddItemPhoto}
                    onDeletePhoto={onDeletePhoto}
                    canDeletePhoto={canDeletePhoto}
                    onCreateWorkOrder={onCreateWorkOrder}
                    onOpenWorkOrder={onOpenWorkOrder}
                    onLayoutY={onItemLayout}
                  />
                );
              })}
            </React.Fragment>
          ))}

        {(mode === 'work' || generalPhotos.length > 0) && (
          <Section
            title="Foto Umum"
            icon="images-outline"
            right={
              <Text style={styles.count}>
                {generalPhotos.length}/{MAX_TASK_PHOTOS}
              </Text>
            }
          >
            {generalPhotos.length === 0 && <MutedText>Belum ada foto umum tugas.</MutedText>}
            <AttachmentGrid
              attachments={generalPhotos}
              token={token}
              canDelete={canDeletePhoto}
              onDelete={(a) => void onDeletePhoto(a)}
            />
            {canWork && generalPhotos.length < MAX_TASK_PHOTOS && (
              <View style={styles.photoButtons}>
                <Button
                  title={uploadingGeneral ? 'Mengunggah…' : 'Ambil Foto'}
                  icon="camera"
                  variant="secondary"
                  onPress={() => void addGeneralPhoto(task, 'camera')}
                  loading={uploadingGeneral}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Galeri"
                  icon="images-outline"
                  variant="ghost"
                  onPress={() => void addGeneralPhoto(task, 'gallery')}
                  disabled={uploadingGeneral}
                />
              </View>
            )}
          </Section>
        )}

        {(mode === 'work' || (task.materials?.length ?? 0) > 0) && (
          <View onLayout={(e) => (materialsY.current = e.nativeEvent.layout.y)}>
            <Section title="Material" icon="cube-outline">
              {mode === 'work' ? (
                <>
                  <MaterialsEditor
                    rows={materials}
                    onChange={(rows) => {
                      setMaterials(rows);
                      setMaterialsDirty(true);
                    }}
                    errors={materialErrors}
                  />
                  {materialsDirty && (
                    <Button title="Simpan Material" icon="save-outline" onPress={saveMaterials} loading={savingMaterials} />
                  )}
                </>
              ) : (
                task.materials.map((m, i) => (
                  <View key={m.id ?? i} style={styles.tableRow}>
                    <Text style={styles.tableMain}>
                      {i + 1}. {m.material_name}
                    </Text>
                    <Text style={styles.tableSide}>
                      {m.quantity} {m.unit}
                    </Text>
                  </View>
                ))
              )}
            </Section>
          </View>
        )}

        {mode === 'work' && infoSection}

        <Section title="Riwayat" icon="git-commit-outline">
          <Timeline logs={task.logs ?? []} toneFor={(st) => pmStatusTone(st ?? task.status)} />
        </Section>
      </ScrollView>

      {!keyboardVisible && <ActionBar primary={primary} secondary={secondary} busy={busy} />}

      <CompleteTaskModal
        visible={modal === 'complete'}
        elapsedMinutes={elapsedMinutes(task.started_at)}
        estimatedMinutes={task.estimated_minutes}
        initialNotes={task.notes ?? ''}
        loading={completing}
        errors={completeErrors}
        onClose={() => setModal(null)}
        onSubmit={(minutes, notes) => void submitComplete(minutes, notes)}
      />
      <ReasonModal
        visible={modal === 'propose'}
        title="Usulkan Lewati Tugas"
        message="Usulan dikirim ke pimpinan unit. Status tugas tidak berubah sampai pimpinan memutuskan."
        label="Alasan"
        placeholder="mis. alat sedang dipakai produksi / sedang diperbaiki"
        confirmLabel="Kirim Usulan"
        confirmVariant="primary"
        loading={proposeSkip.isPending}
        onClose={() => setModal(null)}
        onSubmit={(reason) => void run(() => proposeSkip.mutateAsync(reason), 'Usulan lewati terkirim')}
      />
      <ReasonModal
        visible={modal === 'skip'}
        title="Lewati Tugas PM"
        message="Tugas berstatus DILEWATI dan tidak dapat dikerjakan lagi."
        label="Alasan"
        initialValue={task.skip_proposal?.reason ?? ''}
        confirmLabel="Lewati"
        loading={skip.isPending}
        onClose={() => setModal(null)}
        onSubmit={(reason) => void run(() => skip.mutateAsync(reason), 'Tugas dilewati')}
      />
      <PicModal
        visible={modal === 'pic'}
        executorUnitId={task.executor_unit.id}
        currentPicId={task.pic?.id ?? null}
        loading={reassign.isPending}
        onClose={() => setModal(null)}
        onSubmit={(picUserId) => void run(() => reassign.mutateAsync(picUserId), 'PIC diganti')}
      />
      <FindingWorkOrderModal
        visible={!!findingItem}
        taskUnitId={task.executor_unit.id}
        equipmentLabel={equipmentLabel}
        defaultDescription={
          findingItem ? findingDescription(task.number, findingItem, autosave.drafts[findingItem.id]) : ''
        }
        loading={creatingWo}
        onClose={() => setFindingItem(null)}
        onSubmit={(body) => void submitFinding(body)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  progressBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  progressText: { fontSize: 17, fontWeight: '800', color: colors.text },
  saveState: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  saveText: { fontSize: 14, fontWeight: '700', color: colors.textMuted, flexShrink: 1 },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 4, backgroundColor: colors.success },
  summary: { gap: 10, borderTopWidth: 6 },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  equipment: { fontSize: 21, fontWeight: '800', color: colors.text, lineHeight: 28 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  location: { flex: 1, fontSize: 15, color: colors.textMuted },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dueText: { fontSize: 17, fontWeight: '700', color: colors.text },
  dueHint: { fontSize: 16, fontWeight: '800' },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  historyText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  banner: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.md, alignItems: 'flex-start' },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  count: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  photoButtons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  tableMain: { flex: 1, fontSize: 16, color: colors.text },
  tableSide: { fontSize: 16, fontWeight: '700', color: colors.text },
});
