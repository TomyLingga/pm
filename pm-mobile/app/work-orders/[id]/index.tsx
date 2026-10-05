import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { ActionBar, type BarAction } from '@/components/ActionBar';
import { Timeline } from '@/components/Timeline';
import { Card, ErrorView, InfoRow, LoadingView, MutedText, PriorityBadge, Section, StatusBadge } from '@/components/ui';
import { assigneeNames, equipmentText } from '@/components/WorkOrderCard';
import { AcceptModal } from '@/components/workorder/AcceptModal';
import { AssignModal, type AssignResult } from '@/components/workorder/AssignModal';
import { Attachments } from '@/components/workorder/Attachments';
import { ReasonModal } from '@/components/workorder/ReasonModal';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useWorkOrder, useWorkOrderAction } from '@/hooks/useWorkOrder';
import { ApiError, errorMessage } from '@/lib/api';
import { clearanceLabel } from '@/lib/clearance';
import { MAX_ATTACHMENTS_PER_WO } from '@/lib/config';
import { downloadWorkOrderPdf } from '@/lib/download';
import { workOrderApi } from '@/lib/endpoints';
import { formatDateTime, formatDuration } from '@/lib/format';
import { choosePhotoSource, uploadPhotos } from '@/lib/photos';
import { queryKeys } from '@/lib/queryClient';
import { colors, radius, statusTone } from '@/lib/theme';
import { toast } from '@/lib/toast';
import type { AcceptBody, Attachment, ClearanceResult, UserBrief, WorkOrderDetail } from '@/lib/types';

const who = (u: UserBrief | null | undefined, at?: string | null) =>
  u ? [u.name, at ? formatDateTime(at) : null].filter(Boolean).join(' · ') : null;

function ResultPill({ result }: { result: ClearanceResult | null | undefined }) {
  const tone =
    result === 'ok'
      ? { bg: colors.successSoft, fg: '#15803D' }
      : result === 'not_ok'
        ? { bg: colors.dangerSoft, fg: '#B91C1C' }
        : { bg: '#F1F5F9', fg: colors.textSubtle };
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.fg }]}>{clearanceLabel(result)}</Text>
    </View>
  );
}

export default function WorkOrderDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const qc = useQueryClient();
  const { token, me } = useAuth();

  const query = useWorkOrder(id);
  const wo = query.data;
  const { refetch } = query;
  useRefreshOnFocus(refetch);

  const [refreshing, setRefreshing] = useState(false);
  const [assignMode, setAssignMode] = useState<'receive' | 'reassign' | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const pick = useWorkOrderAction(id, () => workOrderApi.pick(id));
  const start = useWorkOrderAction(id, () => workOrderApi.start(id));
  const receive = useWorkOrderAction(id, (b: AssignResult) => workOrderApi.receive(id, b));
  const reassign = useWorkOrderAction(id, (b: AssignResult) =>
    workOrderApi.updateAssignees(id, { assignee_ids: b.assignee_ids, lead_id: b.lead_id }),
  );
  const accept = useWorkOrderAction(id, (b: AcceptBody) => workOrderApi.accept(id, b));
  const cancel = useWorkOrderAction(id, (reason: string) => workOrderApi.cancel(id, reason));
  const convert = useWorkOrderAction(id, (reason: string) => workOrderApi.convertToRequest(id, reason));
  const removeAttachment = useWorkOrderAction(id, (attachmentId: number) =>
    workOrderApi.deleteAttachment(attachmentId),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  /** Runs an action, shows success toast / error alert; 409 → reload the WO. */
  const run = async (fn: () => Promise<unknown>, success: string): Promise<boolean> => {
    try {
      await fn();
      toast(success);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) void refetch();
      Alert.alert('Aksi gagal', errorMessage(e));
      return false;
    }
  };

  const confirmPick = () =>
    Alert.alert('Ambil WO?', 'WO akan langsung berstatus DIKERJAKAN dan Anda menjadi ketua pelaksana.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ambil WO', onPress: () => void run(() => pick.mutateAsync(), 'WO berhasil diambil') },
    ]);

  const confirmStart = () =>
    Alert.alert('Mulai kerjakan?', 'Status WO akan menjadi DIKERJAKAN.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Mulai', onPress: () => void run(() => start.mutateAsync(), 'Pekerjaan dimulai') },
    ]);

  const submitAssign = async (result: AssignResult) => {
    const ok =
      assignMode === 'receive'
        ? await run(() => receive.mutateAsync(result), 'WO diterima & ditugaskan')
        : await run(() => reassign.mutateAsync(result), 'Teknisi diperbarui');
    if (ok) setAssignMode(null);
  };

  const submitAccept = async (body: AcceptBody) => {
    const ok = await run(
      () => accept.mutateAsync(body),
      body.acceptance === 'yes' ? 'WO diterima dan ditutup' : 'WO dikembalikan ke teknisi',
    );
    if (ok) setAcceptOpen(false);
  };

  const submitCancel = async (reason: string) => {
    const ok = await run(() => cancel.mutateAsync(reason), 'WO dibatalkan');
    if (ok) setCancelOpen(false);
  };

  const submitConvert = async (reason: string) => {
    const ok = await run(() => convert.mutateAsync(reason), 'WO dialihkan ke Form Request');
    if (ok) setConvertOpen(false);
  };

  const addPhotos = async (detail: WorkOrderDetail) => {
    const remaining = MAX_ATTACHMENTS_PER_WO - (detail.attachments?.length ?? 0);
    if (remaining <= 0) {
      Alert.alert('Batas lampiran', `Maksimal ${MAX_ATTACHMENTS_PER_WO} lampiran per WO.`);
      return;
    }
    const photos = await choosePhotoSource(remaining);
    if (!photos.length) return;
    const collection =
      detail.status === 'in_progress' || detail.status === 'completed' ? 'photo_after' : 'photo_before';
    setUploading('Mengunggah…');
    try {
      const { failed, firstError } = await uploadPhotos(detail.id, photos, collection, (done, total) =>
        setUploading(`Mengunggah ${Math.min(done + 1, total)}/${total}…`),
      );
      await qc.invalidateQueries({ queryKey: queryKeys.workOrder(detail.id) });
      if (failed) Alert.alert('Unggah gagal', `${failed} foto gagal diunggah: ${errorMessage(firstError)}`);
      else toast('Foto berhasil diunggah');
    } finally {
      setUploading(null);
    }
  };

  const downloadPdf = async (detail: WorkOrderDetail) => {
    setDownloading(true);
    try {
      await downloadWorkOrderPdf(detail.id, detail.wo_number);
    } catch (e) {
      Alert.alert('Gagal mengunduh PDF', errorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  const deleteAttachment = (a: Attachment) =>
    void run(() => removeAttachment.mutateAsync(a.id), 'Lampiran dihapus');

  if (!Number.isFinite(id) || id <= 0) return <ErrorView message="ID Work Order tidak valid." />;
  if (query.isLoading) return <LoadingView message="Memuat detail WO…" />;
  if (!wo) {
    return (
      <ErrorView
        message={query.error ? errorMessage(query.error) : 'Work Order tidak ditemukan.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const p = wo.permissions ?? ({} as WorkOrderDetail['permissions']);
  const tone = statusTone(wo.status);
  const anyLoading =
    pick.isPending ||
    start.isPending ||
    receive.isPending ||
    reassign.isPending ||
    accept.isPending ||
    cancel.isPending ||
    convert.isPending;

  const primary: BarAction[] = [];
  if (p.can_pick) primary.push({ key: 'pick', title: 'Ambil WO', icon: 'hand-left-outline', onPress: confirmPick, loading: pick.isPending });
  if (p.can_receive) primary.push({ key: 'receive', title: 'Terima & Tugaskan', icon: 'people-outline', onPress: () => setAssignMode('receive') });
  if (p.can_start) primary.push({ key: 'start', title: 'Mulai Kerjakan', icon: 'play-outline', onPress: confirmStart, loading: start.isPending });
  if (p.can_complete) {
    primary.push({ key: 'complete', title: 'Selesaikan', icon: 'checkmark-done-outline', variant: 'success', onPress: () => router.push(`/work-orders/${wo.id}/complete`) });
  } else if (p.can_work) {
    primary.push({ key: 'work', title: 'Isi Data Pekerjaan', icon: 'create-outline', onPress: () => router.push(`/work-orders/${wo.id}/complete`) });
  }
  if (p.can_accept) primary.push({ key: 'accept', title: 'Konfirmasi Penerimaan', icon: 'shield-checkmark-outline', variant: 'success', onPress: () => setAcceptOpen(true) });

  const secondary: BarAction[] = [];
  if (p.can_reassign) secondary.push({ key: 'reassign', title: 'Ubah Teknisi', icon: 'swap-horizontal', onPress: () => setAssignMode('reassign') });
  if (p.can_upload)
    secondary.push({
      key: 'upload',
      title: uploading ?? 'Tambah Foto',
      icon: 'camera-outline',
      onPress: () => void addPhotos(wo),
      loading: !!uploading,
      disabled: (wo.attachments?.length ?? 0) >= MAX_ATTACHMENTS_PER_WO,
    });
  if (p.can_convert)
    secondary.push({ key: 'convert', title: 'Alihkan ke Form Request', icon: 'git-compare-outline', onPress: () => setConvertOpen(true) });
  if (p.can_cancel) secondary.push({ key: 'cancel', title: 'Batalkan', icon: 'close-circle-outline', variant: 'dangerOutline', onPress: () => setCancelOpen(true) });

  const canDeleteAttachment = (a: Attachment) =>
    !!me && a.uploaded_by?.id === me.id && !['closed', 'cancelled', 'converted'].includes(wo.status);
  const workFinished = !!wo.work_done || wo.status === 'completed' || wo.status === 'closed';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: wo.wo_number,
          headerRight: () => (
            <Pressable
              onPress={() => void downloadPdf(wo)}
              disabled={downloading}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Unduh PDF"
            >
              {downloading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="download-outline" size={22} color={colors.white} />
                  <Text style={styles.headerBtnText}>PDF</Text>
                </>
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Summary */}
        <Card style={[styles.summary, { borderTopColor: tone.border }]}>
          <View style={styles.badges}>
            <StatusBadge status={wo.status} label={wo.status_label} />
            <PriorityBadge priority={wo.priority} label={wo.priority_label} />
          </View>
          <Text style={styles.woNumber}>{wo.wo_number}</Text>
          <Text style={styles.description}>{wo.request_description}</Text>
          <Text style={styles.issued}>Diterbitkan {formatDateTime(wo.issued_at)}</Text>
          {wo.status === 'completed' && wo.acceptance_due_at && (
            <View style={[styles.notice, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="time-outline" size={20} color="#6D28D9" />
              <Text style={[styles.noticeText, { color: '#5B21B6' }]}>
                Menunggu konfirmasi pemohon. Otomatis diterima pada {formatDateTime(wo.acceptance_due_at)}.
              </Text>
            </View>
          )}
          {wo.rework_count > 0 && (
            <View style={[styles.notice, { backgroundColor: colors.warningSoft }]}>
              <Ionicons name="refresh" size={20} color={colors.warning} />
              <Text style={[styles.noticeText, { color: '#92400E' }]}>
                Pekerjaan pernah ditolak pemohon {wo.rework_count}x dan dikerjakan ulang.
              </Text>
            </View>
          )}
          {(wo.status === 'converted' || !!wo.converted_service_request) && (
            <Pressable
              disabled={!wo.converted_service_request}
              onPress={() => wo.converted_service_request && router.push(`/requests/${wo.converted_service_request.id}`)}
              style={[styles.notice, { backgroundColor: '#CCFBF1' }]}
              accessibilityRole="link"
            >
              <Ionicons name="git-compare-outline" size={20} color="#0F766E" />
              <Text style={[styles.noticeText, { color: '#115E59' }]}>
                Dialihkan ke Form Request{' '}
                {wo.converted_service_request?.request_number ?? (wo.converted_service_request ? '(draft)' : '')}
                {wo.conversion_reason ? ` — ${wo.conversion_reason}` : ''}
                {wo.converted_service_request ? '. Ketuk untuk membuka.' : ''}
              </Text>
            </Pressable>
          )}
          {!!wo.source_service_request && (
            <Pressable
              onPress={() => wo.source_service_request && router.push(`/requests/${wo.source_service_request.id}`)}
              style={[styles.notice, { backgroundColor: colors.primarySoft }]}
              accessibilityRole="link"
            >
              <Ionicons name="link-outline" size={20} color={colors.primary} />
              <Text style={[styles.noticeText, { color: colors.primary }]}>
                Berasal dari Form Request {wo.source_service_request.request_number ?? ''}. Ketuk untuk membuka.
              </Text>
            </Pressable>
          )}
          {wo.status === 'cancelled' && (
            <View style={[styles.notice, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
              <Text style={[styles.noticeText, { color: '#991B1B' }]}>
                Dibatalkan {formatDateTime(wo.cancelled_at)}
                {wo.cancel_reason ? ` — ${wo.cancel_reason}` : ''}
              </Text>
            </View>
          )}
        </Card>

        <Section title="Informasi" icon="information-circle-outline">
          <InfoRow label="Unit Pelaksana" value={wo.executor_unit?.display_name} />
          <InfoRow
            label="Kategori"
            value={[wo.service_category?.name, wo.category_note].filter(Boolean).join(' — ')}
          />
          <InfoRow label="Alat" value={equipmentText(wo)} />
          <InfoRow
            label="Lokasi"
            value={[wo.location?.name ?? wo.location_name, wo.location_note].filter(Boolean).join(' — ')}
          />
          <InfoRow label="Pemohon" value={[wo.requester?.name, wo.requester?.nrk].filter(Boolean).join(' · ')} />
          <InfoRow
            label="Unit Pemohon"
            value={[wo.requester_sub_bagian_name ?? wo.requester_org_unit_name, wo.requester_bagian_name]
              .filter(Boolean)
              .join(' · ')}
          />
        </Section>

        <Section title="Penugasan" icon="people-outline">
          <InfoRow label="Diterima oleh" value={who(wo.received_by, wo.received_at)} />
          {!!wo.picked_by && <InfoRow label="Diambil oleh" value={who(wo.picked_by, wo.picked_at)} />}
          {!wo.picked_by && !!wo.picked_at && <InfoRow label="Mulai dikerjakan" value={formatDateTime(wo.picked_at)} />}
          <InfoRow label="Teknisi" value={assigneeNames(wo.assignees)} />
          {wo.sla_minutes != null && <InfoRow label="Waktu Penyelesaian (SLA)" value={formatDuration(wo.sla_minutes)} />}
        </Section>

        <Section title="Pekerjaan Selesai" icon="checkmark-done-outline">
          {workFinished ? (
            <>
              <InfoRow label="Pekerjaan perbaikan" value={wo.work_done} />
              <InfoRow label="Diselesaikan oleh" value={who(wo.completed_by, wo.completed_at)} />
              <InfoRow
                label="Diterima pengguna"
                value={
                  wo.accepted_at
                    ? `${who(wo.accepted_by, wo.accepted_at) ?? formatDateTime(wo.accepted_at)}${wo.auto_accepted ? ' (otomatis)' : ''}`
                    : null
                }
              />
              <InfoRow
                label="Total Breakdown"
                value={wo.total_breakdown_hours != null ? `${wo.total_breakdown_hours} jam` : null}
              />
              <InfoRow label="Remarks" value={wo.remarks} />
            </>
          ) : (
            <MutedText>Pekerjaan belum diselesaikan.</MutedText>
          )}
        </Section>

        <Section title="Material" icon="cube-outline">
          {wo.materials?.length ? (
            wo.materials.map((m, i) => (
              <View key={m.id ?? i} style={styles.tableRow}>
                <Text style={styles.tableMain}>
                  {i + 1}. {m.material_name}
                </Text>
                <Text style={styles.tableSide}>
                  {m.quantity} {m.unit}
                </Text>
              </View>
            ))
          ) : (
            <MutedText>Tidak ada material.</MutedText>
          )}
        </Section>

        <Section
          title="Pekerja"
          icon="hammer-outline"
          right={
            wo.labours?.length ? <Text style={styles.total}>Total {formatDuration(wo.total_labour_minutes)}</Text> : null
          }
        >
          {wo.labours?.length ? (
            wo.labours.map((l, i) => (
              <View key={l.id ?? i} style={styles.labour}>
                <View style={styles.tableRow}>
                  <Text style={styles.tableMain}>{l.worker_name}</Text>
                  <Text style={styles.tableSide}>{formatDuration(l.duration_minutes)}</Text>
                </View>
                <Text style={styles.labourTime}>
                  {formatDateTime(l.started_at)} → {formatDateTime(l.finished_at)}
                </Text>
              </View>
            ))
          ) : (
            <MutedText>Belum ada data pekerja.</MutedText>
          )}
        </Section>

        <Section title="Clearance Checklist" icon="shield-checkmark-outline">
          {wo.clearances?.length ? (
            wo.clearances.map((c) => (
              <View key={c.item_no} style={styles.clearance}>
                <Text style={styles.clearanceTitle}>
                  {c.item_no}. {c.item_label}
                </Text>
                <View style={styles.clearanceRow}>
                  <Text style={styles.clearanceRole}>MTC</Text>
                  <ResultPill result={c.mtc_result} />
                  <Text style={styles.clearanceWho} numberOfLines={2}>
                    {who(c.mtc_confirmed_by, c.mtc_confirmed_at) ?? '-'}
                  </Text>
                </View>
                <View style={styles.clearanceRow}>
                  <Text style={styles.clearanceRole}>User</Text>
                  <ResultPill result={c.user_result} />
                  <Text style={styles.clearanceWho} numberOfLines={2}>
                    {who(c.user_confirmed_by, c.user_confirmed_at) ?? (wo.auto_accepted && c.user_result ? 'Otomatis' : '-')}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <MutedText>Belum ada data clearance.</MutedText>
          )}
        </Section>

        <Section title="Pengesahan" icon="ribbon-outline">
          {wo.signatures?.length ? (
            wo.signatures.map((s) => (
              <View key={s.role_key} style={styles.signature}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.signatureRole}>{s.role_label}</Text>
                  <Text style={styles.signatureName}>{s.signer_name}</Text>
                  <Text style={styles.signatureAt}>{formatDateTime(s.signed_at)}</Text>
                </View>
                {!!s.verify_url && (
                  <Pressable
                    onPress={() => void Linking.openURL(s.verify_url as string)}
                    style={styles.verifyBtn}
                    accessibilityRole="link"
                  >
                    <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
                    <Text style={styles.verifyText}>Verifikasi</Text>
                  </Pressable>
                )}
              </View>
            ))
          ) : (
            <MutedText>Belum ada tanda tangan.</MutedText>
          )}
        </Section>

        <Section
          title="Lampiran"
          icon="images-outline"
          right={
            <Text style={styles.total}>
              {wo.attachments?.length ?? 0}/{MAX_ATTACHMENTS_PER_WO}
            </Text>
          }
        >
          <Attachments
            attachments={wo.attachments ?? []}
            token={token}
            canDelete={canDeleteAttachment}
            onDelete={deleteAttachment}
          />
        </Section>

        <Section title="Riwayat" icon="git-commit-outline">
          <Timeline logs={wo.logs ?? []} toneFor={(st) => statusTone(st ?? wo.status)} />
        </Section>
      </ScrollView>

      <ActionBar primary={primary} secondary={secondary} busy={anyLoading} />

      {assignMode && (
        <AssignModal
          visible
          mode={assignMode}
          workOrder={wo}
          loading={receive.isPending || reassign.isPending}
          onClose={() => setAssignMode(null)}
          onSubmit={(r) => void submitAssign(r)}
        />
      )}
      <AcceptModal
        visible={acceptOpen}
        workOrder={wo}
        loading={accept.isPending}
        onClose={() => setAcceptOpen(false)}
        onSubmit={(b) => void submitAccept(b)}
      />
      <ReasonModal
        visible={cancelOpen}
        title="Batalkan Work Order"
        message="WO yang dibatalkan tidak dapat diproses lagi."
        label="Alasan pembatalan"
        confirmLabel="Batalkan WO"
        loading={cancel.isPending}
        onClose={() => setCancelOpen(false)}
        onSubmit={(r) => void submitCancel(r)}
      />
      <ReasonModal
        visible={convertOpen}
        title="Alihkan ke Form Request"
        message="WO akan berstatus DIALIHKAN dan pemohon mendapat Form Request (draft) berisi data WO ini untuk diajukan dengan persetujuan."
        label="Alasan pengalihan"
        placeholder="mis. butuh biaya/pembelian, gunakan Form Request"
        confirmLabel="Alihkan"
        confirmVariant="primary"
        loading={convert.isPending}
        onClose={() => setConvertOpen(false)}
        onSubmit={(r) => void submitConvert(r)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, minWidth: 64, justifyContent: 'center' },
  headerBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  summary: { gap: 10, borderTopWidth: 6 },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  woNumber: { fontSize: 20, fontWeight: '800', color: colors.text },
  description: { fontSize: 17, color: colors.text, lineHeight: 24 },
  issued: { fontSize: 14, color: colors.textSubtle },
  notice: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.md, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontSize: 14, fontWeight: '600' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  tableMain: { flex: 1, fontSize: 16, color: colors.text },
  tableSide: { fontSize: 16, fontWeight: '700', color: colors.text },
  total: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  labour: { gap: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  labourTime: { fontSize: 14, color: colors.textMuted },
  clearance: { gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  clearanceTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  clearanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clearanceRole: { width: 42, fontSize: 14, fontWeight: '700', color: colors.textMuted },
  clearanceWho: { flex: 1, fontSize: 14, color: colors.textMuted },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, minWidth: 48, alignItems: 'center' },
  pillText: { fontWeight: '800', fontSize: 13 },
  signature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  signatureRole: { fontSize: 13, fontWeight: '700', color: colors.textSubtle, textTransform: 'uppercase' },
  signatureName: { fontSize: 16, fontWeight: '700', color: colors.text },
  signatureAt: { fontSize: 14, color: colors.textMuted },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  verifyText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
