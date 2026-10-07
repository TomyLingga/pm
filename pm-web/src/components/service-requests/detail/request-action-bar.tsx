"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCheck,
  Pencil,
  Printer,
  RotateCcw,
  Send,
  Trash2,
  UserRoundCog,
  XCircle,
  XOctagon,
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ReasonDialog } from "@/components/common/reason-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import {
  cancelServiceRequest,
  completeServiceRequest,
  convertServiceRequestToWorkOrder,
  deleteServiceRequest,
  rejectServiceRequest,
  requestRevision,
  serviceRequestPdfUrl,
} from "@/lib/service-requests";
import type { ServiceRequestDetail } from "@/types/service-request";
import { useRequestAction } from "../use-request-action";
import { ApproveDialog } from "./approve-dialog";
import { SuperiorDialog } from "./superior-dialog";

type DialogKey =
  | "submit"
  | "change_superior"
  | "approve"
  | "reject"
  | "revision"
  | "complete"
  | "cancel"
  | "convert"
  | "delete"
  | null;

/** Outline button with a destructive tint (reject / cancel). */
const dangerOutline = "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive";

/** Buttons are driven exclusively by `request.permissions`. */
export function RequestActionBar({ request }: { request: ServiceRequestDetail }) {
  const p = request.permissions;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<DialogKey>(null);
  const [deleting, setDeleting] = React.useState(false);
  const close = () => setDialog(null);
  const onOpenChange = (open: boolean) => !open && close();

  const reject = useRequestAction(request.id, (notes: string) => rejectServiceRequest(request.id, notes), {
    successMessage: "Form Request ditolak.",
    onSuccess: close,
  });
  const revision = useRequestAction(request.id, (notes: string) => requestRevision(request.id, notes), {
    successMessage: "Form Request dikembalikan ke pemohon untuk direvisi.",
    onSuccess: close,
  });
  const complete = useRequestAction(request.id, (notes: string) => completeServiceRequest(request.id, notes), {
    successMessage: "Form Request diselesaikan.",
    onSuccess: close,
  });
  const cancel = useRequestAction(request.id, (reason: string) => cancelServiceRequest(request.id, reason), {
    successMessage: "Form Request dibatalkan.",
    onSuccess: close,
  });
  const convert = useRequestAction(
    request.id,
    (reason: string) => convertServiceRequestToWorkOrder(request.id, reason),
    {
      successMessage: "Form Request dialihkan menjadi Work Order.",
      onSuccess: (detail) => {
        close();
        void queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
        const wo = detail?.converted_work_order;
        if (wo) {
          toast.info(`Work Order ${wo.wo_number} dibuat.`, {
            action: { label: "Lihat WO", onClick: () => router.push(`/work-orders/${wo.id}`) },
          });
        }
      },
    },
  );

  const onDelete = async () => {
    setDeleting(true);
    try {
      await deleteServiceRequest(request.id);
      toast.success("Draf Form Request dihapus.");
      queryClient.removeQueries({ queryKey: queryKeys.serviceRequest(request.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequestLists });
      router.replace("/requests");
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
    }
  };

  const hasDanger = p.can_cancel || p.can_delete;

  return (
    <div className="panel flex flex-wrap gap-2 p-3" role="group" aria-label="Tindakan Form Request">
      {p.can_submit ? (
        <Button onClick={() => setDialog("submit")}>
          <Send aria-hidden />
          Ajukan
        </Button>
      ) : null}
      {p.can_approve ? (
        <Button onClick={() => setDialog("approve")}>
          <CheckCircle2 aria-hidden />
          Setujui
        </Button>
      ) : null}
      {p.can_complete ? (
        <Button onClick={() => setDialog("complete")}>
          <ClipboardCheck aria-hidden />
          Selesaikan
        </Button>
      ) : null}
      {p.can_request_revision ? (
        <Button variant="outline" onClick={() => setDialog("revision")}>
          <RotateCcw aria-hidden />
          Minta Revisi
        </Button>
      ) : null}
      {p.can_reject ? (
        <Button variant="outline" className={dangerOutline} onClick={() => setDialog("reject")}>
          <XOctagon aria-hidden />
          Tolak
        </Button>
      ) : null}
      {p.can_convert ? (
        <Button variant="outline" onClick={() => setDialog("convert")}>
          <ArrowRightLeft aria-hidden />
          Alihkan ke WO
        </Button>
      ) : null}
      {p.can_change_superior ? (
        <Button variant="outline" onClick={() => setDialog("change_superior")}>
          <UserRoundCog aria-hidden />
          Ganti Atasan
        </Button>
      ) : null}
      {p.can_update ? (
        <Button asChild variant="outline">
          <Link href={`/requests/${request.id}/edit`}>
            <Pencil aria-hidden />
            Ubah
          </Link>
        </Button>
      ) : null}
      <Button asChild variant="outline">
        <a href={serviceRequestPdfUrl(request.id)} target="_blank" rel="noopener">
          <Printer aria-hidden />
          Cetak PDF
        </a>
      </Button>
      {hasDanger ? (
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {p.can_cancel ? (
            <Button variant="outline" className={dangerOutline} onClick={() => setDialog("cancel")}>
              <XCircle aria-hidden />
              Batalkan
            </Button>
          ) : null}
          {p.can_delete ? (
            <Button variant="destructive" onClick={() => setDialog("delete")}>
              <Trash2 aria-hidden />
              Hapus
            </Button>
          ) : null}
        </div>
      ) : null}

      <SuperiorDialog request={request} mode="submit" open={dialog === "submit"} onOpenChange={onOpenChange} />
      <SuperiorDialog
        request={request}
        mode="change"
        open={dialog === "change_superior"}
        onOpenChange={onOpenChange}
      />
      <ApproveDialog request={request} open={dialog === "approve"} onOpenChange={onOpenChange} />
      <ReasonDialog
        open={dialog === "reject"}
        onOpenChange={onOpenChange}
        title="Tolak Form Request?"
        description="Form Request yang ditolak berstatus final dan tidak dapat diproses lagi. Alasan ditampilkan kepada pemohon."
        label="Alasan penolakan"
        placeholder="Contoh: anggaran tidak tersedia tahun ini"
        required
        fieldKey="notes"
        confirmLabel="Tolak Form Request"
        confirmVariant="destructive"
        loading={reject.isPending}
        error={reject.error}
        onSubmit={(text) => reject.mutate(text)}
      />
      <ReasonDialog
        open={dialog === "revision"}
        onOpenChange={onOpenChange}
        title="Minta revisi"
        description="Form Request kembali menjadi DRAFT agar pemohon dapat memperbaikinya lalu mengajukan ulang."
        label="Catatan revisi"
        placeholder="Apa yang perlu diperbaiki pemohon?"
        required
        fieldKey="notes"
        confirmLabel="Kirim Permintaan Revisi"
        loading={revision.isPending}
        error={revision.error}
        onSubmit={(text) => revision.mutate(text)}
      />
      <ReasonDialog
        open={dialog === "complete"}
        onOpenChange={onOpenChange}
        title="Selesaikan Form Request"
        description="Isi keterangan penyelesaian (tampil di kolom KETERANGAN pada formulir)."
        label="Keterangan"
        placeholder="Contoh: laptop sudah diserahkan, akses sudah dibuat"
        required
        fieldKey="executor_notes"
        confirmLabel="Tandai Selesai"
        loading={complete.isPending}
        error={complete.error}
        onSubmit={(text) => complete.mutate(text)}
      />
      <ReasonDialog
        open={dialog === "cancel"}
        onOpenChange={onOpenChange}
        title="Batalkan Form Request?"
        description="Form Request yang dibatalkan tidak dapat diproses lagi."
        label="Alasan pembatalan"
        placeholder="Contoh: kebutuhan sudah tidak relevan"
        required
        fieldKey="reason"
        confirmLabel="Batalkan Form Request"
        confirmVariant="destructive"
        loading={cancel.isPending}
        error={cancel.error}
        onSubmit={(text) => cancel.mutate(text)}
      />
      <ReasonDialog
        open={dialog === "convert"}
        onOpenChange={onOpenChange}
        title="Alihkan ke Work Order?"
        description="Form Request berstatus DIALIHKAN KE WO dan dibuatkan Work Order baru (DIAJUKAN) dengan isi yang sama."
        label="Alasan pengalihan"
        placeholder="Contoh: tidak memerlukan biaya, cukup ditangani lewat WO"
        required
        fieldKey="reason"
        confirmLabel="Alihkan ke WO"
        loading={convert.isPending}
        error={convert.error}
        onSubmit={(text) => convert.mutate(text)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={onOpenChange}
        title="Hapus draf Form Request?"
        description="Draf beserta lampirannya akan dihapus permanen dan tidak dapat dikembalikan."
        confirmLabel="Hapus Draf"
        confirmVariant="destructive"
        loading={deleting}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
