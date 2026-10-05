import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { ActionBar, type BarAction } from '@/components/ActionBar';
import { ApprovalSteps } from '@/components/request/ApprovalSteps';
import { ExecutorPicker } from '@/components/request/ExecutorPicker';
import { RulesBlock } from '@/components/request/RulesBlock';
import { SuperiorModal } from '@/components/request/SuperiorModal';
import { Timeline } from '@/components/Timeline';
import { Card, ErrorView, InfoRow, LoadingView, MutedText, PriorityBadge, Section, StatusBadge } from '@/components/ui';
import { Attachments } from '@/components/workorder/Attachments';
import { ReasonModal } from '@/components/workorder/ReasonModal';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { applyRequestResult, useRequestAction, useServiceRequest } from '@/hooks/useServiceRequest';
import { ApiError, errorMessage } from '@/lib/api';
import { MAX_ATTACHMENTS_PER_WO } from '@/lib/config';
import { downloadRequestPdf } from '@/lib/download';
import { attachmentApi, requestApi } from '@/lib/endpoints';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { chooseFileSource, isImageFile, uploadFiles } from '@/lib/photos';
import { queryKeys } from '@/lib/queryClient';
import { colors, radius, requestStatusTone } from '@/lib/theme';
import { toast } from '@/lib/toast';
import type { ApprovalStep, Attachment, ServiceRequestDetail, UserBrief } from '@/lib/types';

type ModalKind = 'submit' | 'superior' | 'cancel' | 'approve' | 'reject' | 'revision' | 'complete' | 'convert' | null;

const FINAL_STATUSES = ['completed', 'rejected', 'cancelled', 'converted'];

function Notice({
  icon,
  color,
  bg,
  text,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  text: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[styles.notice, { backgroundColor: bg }]}
      accessibilityRole={onPress ? 'link' : undefined}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.noticeText, { color }]}>{text}</Text>
    </Pressable>
  );
}

function latestStepWith(steps: ApprovalStep[] | undefined, status: string): ApprovalStep | undefined {
  return [...(steps ?? [])]
    .filter((s) => s.status === status)
    .sort((a, b) => (b.acted_at ?? '').localeCompare(a.acted_at ?? ''))[0];
}

export default function RequestDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const qc = useQueryClient();
  const { token, me } = useAuth();

  const query = useServiceRequest(id);
  const sr = query.data;
  const { refetch } = query;
  useRefreshOnFocus(refetch);

  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [executorId, setExecutorId] = useState<number | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const submit = useRequestAction(id, (superiorId: number | null) => requestApi.submit(id, superiorId));
  const changeSuperior = useRequestAction(id, (v: { superiorId: number; reason: string }) =>
    requestApi.changeSuperior(id, v.superiorId, v.reason),
  );
  const approve = useRequestAction(id, (v: { notes: string; executorId: number | null }) =>
    requestApi.approve(id, v.notes, v.executorId),
  );
  const reject = useRequestAction(id, (notes: string) => requestApi.reject(id, notes));
  const revision = useRequestAction(id, (notes: string) => requestApi.requestRevision(id, notes));
  const complete = useRequestAction(id, (notes: string) => requestApi.complete(id, notes));
  const cancel = useRequestAction(id, (reason: string) => requestApi.cancel(id, reason));
  const convert = useRequestAction(id, (reason: string) => requestApi.convertToWorkOrder(id, reason));
  const removeAttachment = useRequestAction(id, (attachmentId: number) => attachmentApi.remove(attachmentId));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  /** Runs an action, toasts on success, alerts on error (409 → reload). Closes the modal on success. */
  const run = async (fn: () => Promise<unknown>, success: string): Promise<unknown> => {
    try {
      const result = await fn();
      toast(success);
      setModal(null);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) void refetch();
      Alert.alert('Aksi gagal', errorMessage(e));
      return undefined;
    }
  };

  const confirmDelete = () =>
    Alert.alert('Hapus draft?', 'Draft Form Request ini akan dihapus permanen.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await requestApi.remove(id);
            qc.removeQueries({ queryKey: queryKeys.request(id) });
            void qc.invalidateQueries({ queryKey: queryKeys.requests });
            toast('Draft dihapus');
            router.back();
          } catch (e) {
            Alert.alert('Gagal menghapus', errorMessage(e));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  const addFiles = async (detail: ServiceRequestDetail) => {
    const remaining = MAX_ATTACHMENTS_PER_WO - (detail.attachments?.length ?? 0);
    if (remaining <= 0) {
      Alert.alert('Batas lampiran', `Maksimal ${MAX_ATTACHMENTS_PER_WO} lampiran.`);
      return;
    }
    const files = await chooseFileSource(remaining, { allowDocuments: true });
    if (!files.length) return;
    setUploading('Mengunggah…');
    try {
      const { failed, firstError } = await uploadFiles(
        (file, collection) => requestApi.uploadAttachment(detail.id, file, collection),
        files,
        (f) => (isImageFile(f) ? 'photo_before' : 'document'),
        (done, total) => setUploading(`Mengunggah ${Math.min(done + 1, total)}/${total}…`),
      );
      await qc.invalidateQueries({ queryKey: queryKeys.request(detail.id) });
      if (failed) Alert.alert('Unggah gagal', `${failed} file gagal diunggah: ${errorMessage(firstError)}`);
      else toast('Lampiran berhasil diunggah');
    } finally {
      setUploading(null);
    }
  };

  const downloadPdf = async (detail: ServiceRequestDetail) => {
    setDownloading(true);
    try {
      await downloadRequestPdf(detail.id, detail.request_number);
    } catch (e) {
      Alert.alert('Gagal mengunduh PDF', errorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  if (!Number.isFinite(id) || id <= 0) return <ErrorView message="ID Form Request tidak valid." />;
  if (query.isLoading) return <LoadingView message="Memuat Form Request…" />;
  if (!sr) {
    return (
      <ErrorView
        message={query.error ? errorMessage(query.error) : 'Form Request tidak ditemukan.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const p = sr.permissions ?? ({} as ServiceRequestDetail['permissions']);
  const tone = requestStatusTone(sr.status);
  const currentStepKey = sr.current_step?.key ?? sr.approval_steps?.find((s) => s.status === 'pending')?.key ?? null;
  const pendingStep = sr.approval_steps?.find((s) => s.status === 'pending');
  const revisionStep = sr.status === 'draft' ? latestStepWith(sr.approval_history, 'revision_requested') : undefined;
  const rejectedStep = sr.status === 'rejected' ? latestStepWith(sr.approval_steps, 'rejected') : undefined;
  const identity = sr.identity;

  const busy =
    submit.isPending ||
    changeSuperior.isPending ||
    approve.isPending ||
    reject.isPending ||
    revision.isPending ||
    complete.isPending ||
    cancel.isPending ||
    convert.isPending ||
    deleting;

  const primary: BarAction[] = [];
  if (p.can_submit) primary.push({ key: 'submit', title: 'Ajukan', icon: 'send', onPress: () => setModal('submit') });
  if (p.can_approve)
    primary.push({
      key: 'approve',
      title: 'Setujui',
      icon: 'checkmark-circle-outline',
      variant: 'success',
      onPress: () => {
        setExecutorId(null);
        setModal('approve');
      },
    });
  if (p.can_complete)
    primary.push({ key: 'complete', title: 'Selesaikan', icon: 'checkmark-done-outline', variant: 'success', onPress: () => setModal('complete') });

  const secondary: BarAction[] = [];
  if (p.can_update) secondary.push({ key: 'edit', title: 'Ubah', icon: 'create-outline', onPress: () => router.push(`/requests/${sr.id}/edit`) });
  if (p.can_reject) secondary.push({ key: 'reject', title: 'Tolak', icon: 'close-circle-outline', variant: 'dangerOutline', onPress: () => setModal('reject') });
  if (p.can_request_revision) secondary.push({ key: 'revision', title: 'Minta Revisi', icon: 'return-down-back-outline', onPress: () => setModal('revision') });
  if (p.can_change_superior) secondary.push({ key: 'superior', title: 'Ganti Atasan', icon: 'swap-horizontal', onPress: () => setModal('superior') });
  if (p.can_convert) secondary.push({ key: 'convert', title: 'Alihkan ke WO', icon: 'git-compare-outline', onPress: () => setModal('convert') });
  if (p.can_upload)
    secondary.push({
      key: 'upload',
      title: uploading ?? 'Tambah Lampiran',
      icon: 'attach',
      onPress: () => void addFiles(sr),
      loading: !!uploading,
      disabled: (sr.attachments?.length ?? 0) >= MAX_ATTACHMENTS_PER_WO,
    });
  if (p.can_delete) secondary.push({ key: 'delete', title: 'Hapus', icon: 'trash-outline', variant: 'dangerOutline', onPress: confirmDelete, loading: deleting });
  if (p.can_cancel) secondary.push({ key: 'cancel', title: 'Batalkan', icon: 'close-outline', variant: 'dangerOutline', onPress: () => setModal('cancel') });

  const canDeleteAttachment = (a: Attachment) =>
    !!me && a.uploaded_by?.id === me.id && !FINAL_STATUSES.includes(sr.status);

  const onConverted = (result: unknown) => {
    const detail = applyRequestResult(qc, sr.id, result);
    const wo = detail?.converted_work_order;
    if (wo) {
      Alert.alert('Dialihkan ke Work Order', `WO ${wo.wo_number} telah dibuat.`, [
        { text: 'Tutup', style: 'cancel' },
        { text: 'Buka WO', onPress: () => router.push(`/work-orders/${wo.id}`) },
      ]);
    }
  };

  const superiorBrief: (UserBrief & { grade_code?: string | null }) | null = sr.superior ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: sr.request_number ?? 'Draft Form Request',
          headerRight: () => (
            <Pressable
              onPress={() => void downloadPdf(sr)}
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
        <Card style={[styles.summary, { borderTopColor: tone.border }]}>
          <View style={styles.badges}>
            <StatusBadge status={sr.status} label={sr.status_label} tone={tone} />
            <PriorityBadge priority={sr.priority} label={sr.priority_label} />
            {sr.revision_no > 0 && (
              <View style={styles.revBadge}>
                <Text style={styles.revBadgeText}>Revisi ke-{sr.revision_no}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.number, !sr.request_number && styles.draftNumber]}>
            {sr.request_number ?? 'Draft (nomor terbit saat diajukan)'}
          </Text>
          <Text style={styles.purpose}>{sr.purpose}</Text>
          <Text style={styles.meta}>
            Dibuat {formatDateTime(sr.created_at)}
            {sr.submitted_at ? ` · Diajukan ${formatDateTime(sr.submitted_at)}` : ''}
            {sr.completed_at ? ` · Selesai ${formatDateTime(sr.completed_at)}` : ''}
          </Text>

          {!!pendingStep && (
            <Notice
              icon="hourglass-outline"
              color="#92400E"
              bg={colors.warningSoft}
              text={`Menunggu ${pendingStep.label}: ${pendingStep.assignee_label ?? '-'}${
                pendingStep.activated_at ? ` (sejak ${formatDateTime(pendingStep.activated_at)})` : ''
              }`}
            />
          )}
          {!!revisionStep && (
            <Notice
              icon="return-down-back-outline"
              color="#9A3412"
              bg="#FFEDD5"
              text={`Diminta revisi oleh ${revisionStep.acted_by?.name ?? revisionStep.label}${
                revisionStep.notes ? `: "${revisionStep.notes}"` : ''
              }. Ubah lalu ajukan kembali.`}
            />
          )}
          {sr.status === 'rejected' && (
            <Notice
              icon="close-circle"
              color="#991B1B"
              bg={colors.dangerSoft}
              text={`Ditolak ${formatDateTime(sr.rejected_at)}${rejectedStep?.acted_by ? ` oleh ${rejectedStep.acted_by.name}` : ''}${
                rejectedStep?.notes ? ` — ${rejectedStep.notes}` : ''
              }`}
            />
          )}
          {sr.status === 'cancelled' && (
            <Notice
              icon="close-circle"
              color="#991B1B"
              bg={colors.dangerSoft}
              text={`Dibatalkan ${formatDateTime(sr.cancelled_at)}${sr.cancel_reason ? ` — ${sr.cancel_reason}` : ''}`}
            />
          )}
          {(sr.status === 'converted' || !!sr.converted_work_order) && (
            <Notice
              icon="git-compare-outline"
              color="#115E59"
              bg="#CCFBF1"
              text={`Dialihkan ke Work Order ${sr.converted_work_order?.wo_number ?? ''}${
                sr.conversion_reason ? ` — ${sr.conversion_reason}` : ''
              }${sr.converted_work_order ? '. Ketuk untuk membuka.' : ''}`}
              onPress={sr.converted_work_order ? () => router.push(`/work-orders/${sr.converted_work_order?.id}`) : undefined}
            />
          )}
          {!!sr.source_work_order && (
            <Notice
              icon="link-outline"
              color={colors.primary}
              bg={colors.primarySoft}
              text={`Berasal dari Work Order ${sr.source_work_order.wo_number}. Ketuk untuk membuka.`}
              onPress={() => sr.source_work_order && router.push(`/work-orders/${sr.source_work_order.id}`)}
            />
          )}
        </Card>

        <Section title="Permintaan" icon="document-text-outline">
          <InfoRow label="Keperluan" value={sr.purpose} />
          <InfoRow label="Jenis Permintaan" value={sr.service_category?.name} />
          <InfoRow label="Prioritas" value={sr.priority_label} />
          <InfoRow label="Divisi Pelaksana" value={sr.executor_unit?.display_name} />
          <InfoRow label="Office" value={sr.office?.name} />
          <InfoRow label="Estimasi Biaya" value={sr.estimated_cost != null ? formatRupiah(sr.estimated_cost) : null} />
          <InfoRow label="Atasan YBS" value={sr.superior?.name} />
        </Section>

        <Section title="Keterangan" icon="chatbox-ellipses-outline">
          <InfoRow label="Keterangan pelaksana" value={sr.executor_notes} />
          <InfoRow label="Pelaksana ditunjuk" value={sr.assigned_executor?.name} />
        </Section>

        <Section title="Pengesahan" icon="ribbon-outline">
          <ApprovalSteps
            steps={sr.approval_steps ?? []}
            history={sr.approval_history ?? []}
            signatures={sr.signatures ?? []}
          />
        </Section>

        {(sr.rules || sr.contact_footer) && <RulesBlock rules={sr.rules} contactFooter={sr.contact_footer} />}

        <Section title="Identitas Pemohon" icon="person-outline">
          {identity ? (
            <>
              <InfoRow label="Nama" value={identity.name} />
              <InfoRow label="Status Karyawan" value={identity.employment_status} />
              <InfoRow label="NRK" value={identity.nrk} />
              <InfoRow label="Jabatan" value={identity.position} />
              <InfoRow label="Atasan" value={identity.superior_name} />
              <InfoRow label="Bagian" value={identity.bagian} />
              <InfoRow label="Sub Bagian" value={identity.sub_bagian} />
              <InfoRow label="Email" value={identity.email} />
              <InfoRow label="No. HP" value={identity.phone} />
            </>
          ) : (
            <InfoRow label="Pemohon" value={[sr.requester?.name, sr.requester?.nrk].filter(Boolean).join(' · ')} />
          )}
        </Section>

        <Section
          title="Lampiran"
          icon="attach"
          right={
            <Text style={styles.count}>
              {sr.attachments?.length ?? 0}/{MAX_ATTACHMENTS_PER_WO}
            </Text>
          }
        >
          <Attachments
            attachments={sr.attachments ?? []}
            token={token}
            canDelete={canDeleteAttachment}
            onDelete={(a) => void run(() => removeAttachment.mutateAsync(a.id), 'Lampiran dihapus')}
          />
        </Section>

        <Section title="Riwayat" icon="git-commit-outline">
          {sr.logs?.length ? (
            <Timeline logs={sr.logs} toneFor={(st) => requestStatusTone(st ?? sr.status)} />
          ) : (
            <MutedText>Belum ada riwayat.</MutedText>
          )}
        </Section>
      </ScrollView>

      <ActionBar primary={primary} secondary={secondary} busy={busy} />

      <SuperiorModal
        visible={modal === 'submit' || modal === 'superior'}
        mode={modal === 'superior' ? 'change' : 'submit'}
        initialSuperior={superiorBrief}
        loading={submit.isPending || changeSuperior.isPending}
        onClose={() => setModal(null)}
        onSubmit={(sup, reason) => {
          if (modal === 'superior' && sup) {
            void run(() => changeSuperior.mutateAsync({ superiorId: sup.id, reason }), 'Atasan diganti');
          } else {
            void run(() => submit.mutateAsync(sup?.id ?? null), 'Form Request diajukan');
          }
        }}
      />
      <ReasonModal
        visible={modal === 'approve'}
        title="Setujui Form Request"
        label="Catatan"
        required={false}
        placeholder="Opsional"
        confirmLabel="Setujui"
        confirmVariant="success"
        loading={approve.isPending}
        onClose={() => setModal(null)}
        onSubmit={(notes) =>
          void run(
            () =>
              approve.mutateAsync({
                notes,
                executorId: currentStepKey === 'executor_lead' ? executorId : null,
              }),
            'Form Request disetujui',
          )
        }
      >
        {currentStepKey === 'executor_lead' && (
          <ExecutorPicker
            executorUnitId={sr.executor_unit.id}
            value={executorId}
            onChange={setExecutorId}
            enabled={modal === 'approve'}
          />
        )}
      </ReasonModal>
      <ReasonModal
        visible={modal === 'reject'}
        title="Tolak Form Request"
        message="Form Request yang ditolak tidak dapat diproses lagi."
        label="Alasan penolakan"
        confirmLabel="Tolak"
        loading={reject.isPending}
        onClose={() => setModal(null)}
        onSubmit={(notes) => void run(() => reject.mutateAsync(notes), 'Form Request ditolak')}
      />
      <ReasonModal
        visible={modal === 'revision'}
        title="Minta Revisi"
        message="Form Request dikembalikan ke pemohon (status DRAFT) untuk diperbaiki lalu diajukan ulang."
        label="Catatan revisi"
        confirmLabel="Kirim Revisi"
        confirmVariant="primary"
        loading={revision.isPending}
        onClose={() => setModal(null)}
        onSubmit={(notes) => void run(() => revision.mutateAsync(notes), 'Revisi diminta')}
      />
      <ReasonModal
        visible={modal === 'complete'}
        title="Selesaikan Form Request"
        label="Keterangan penyelesaian"
        placeholder="mis. laptop sudah diserahkan, akses sudah dibuat"
        confirmLabel="Selesaikan"
        confirmVariant="success"
        loading={complete.isPending}
        onClose={() => setModal(null)}
        onSubmit={(notes) => void run(() => complete.mutateAsync(notes), 'Form Request selesai')}
      />
      <ReasonModal
        visible={modal === 'cancel'}
        title="Batalkan Form Request"
        message="Form Request yang dibatalkan tidak dapat diproses lagi."
        label="Alasan pembatalan"
        confirmLabel="Batalkan"
        loading={cancel.isPending}
        onClose={() => setModal(null)}
        onSubmit={(reason) => void run(() => cancel.mutateAsync(reason), 'Form Request dibatalkan')}
      />
      <ReasonModal
        visible={modal === 'convert'}
        title="Alihkan ke Work Order"
        message="Form Request akan berstatus DIALIHKAN KE WO dan Work Order baru (DIAJUKAN) dibuat untuk pemohon."
        label="Alasan pengalihan"
        placeholder="mis. cukup ditangani sebagai perbaikan tanpa biaya"
        confirmLabel="Alihkan"
        confirmVariant="primary"
        loading={convert.isPending}
        onClose={() => setModal(null)}
        onSubmit={(reason) =>
          void run(() => convert.mutateAsync(reason), 'Dialihkan ke Work Order').then((r) => {
            if (r) onConverted(r);
          })
        }
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
  revBadge: { backgroundColor: '#FFEDD5', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  revBadgeText: { color: '#C2410C', fontWeight: '700', fontSize: 13 },
  number: { fontSize: 19, fontWeight: '800', color: colors.text },
  draftNumber: { color: colors.textMuted, fontStyle: 'italic', fontSize: 17 },
  purpose: { fontSize: 17, color: colors.text, lineHeight: 24 },
  meta: { fontSize: 14, color: colors.textSubtle },
  notice: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.md, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontSize: 14, fontWeight: '600' },
  count: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
});
