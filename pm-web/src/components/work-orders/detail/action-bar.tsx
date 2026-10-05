"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCheck,
  Hand,
  Pencil,
  Play,
  Printer,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ReasonDialog } from "@/components/common/reason-dialog";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/query-keys";
import { convertWorkOrderToRequest, pickWorkOrder, startWorkOrder, workOrderPdfUrl } from "@/lib/work-orders";
import type { WorkOrderDetail } from "@/types/work-order";
import { AcceptDialog } from "./accept-dialog";
import { AssignDialog } from "./assign-dialog";
import { CancelDialog } from "./cancel-dialog";
import { useWorkOrderAction } from "./use-work-order-action";

type DialogKey = "pick" | "start" | "receive" | "reassign" | "accept" | "cancel" | "convert" | null;

interface ActionBarProps {
  wo: WorkOrderDetail;
  completeOpen: boolean;
  onOpenComplete: () => void;
}

/** Buttons are driven exclusively by `wo.permissions`. */
export function ActionBar({ wo, completeOpen, onOpenComplete }: ActionBarProps) {
  const p = wo.permissions;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<DialogKey>(null);
  const close = () => setDialog(null);

  const pick = useWorkOrderAction(wo.id, () => pickWorkOrder(wo.id), {
    successMessage: "WO berhasil diambil. Silakan mulai bekerja.",
    onSuccess: close,
  });
  const start = useWorkOrderAction(wo.id, () => startWorkOrder(wo.id), {
    successMessage: "Status WO menjadi DIKERJAKAN.",
    onSuccess: close,
  });

  const convert = useWorkOrderAction(wo.id, (reason: string) => convertWorkOrderToRequest(wo.id, reason), {
    successMessage: "WO dialihkan ke Form Request (draft milik pemohon).",
    onSuccess: (detail) => {
      close();
      void queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests });
      const target = detail?.converted_service_request;
      if (target) router.push(`/requests/${target.id}`);
    },
  });

  const canFinish = p.can_work || p.can_complete;

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-3 shadow-sm">
      {p.can_pick ? (
        <Button onClick={() => setDialog("pick")}>
          <Hand />
          Ambil WO
        </Button>
      ) : null}
      {p.can_receive ? (
        <Button onClick={() => setDialog("receive")}>
          <UserCheck />
          Terima &amp; Tugaskan
        </Button>
      ) : null}
      {p.can_start ? (
        <Button onClick={() => setDialog("start")}>
          <Play />
          Mulai Kerjakan
        </Button>
      ) : null}
      {canFinish && !completeOpen ? (
        <Button onClick={onOpenComplete}>
          <ClipboardCheck />
          Selesaikan Pekerjaan
        </Button>
      ) : null}
      {p.can_accept ? (
        <Button onClick={() => setDialog("accept")}>
          <CheckCircle2 />
          Konfirmasi Penerimaan
        </Button>
      ) : null}
      {p.can_reassign ? (
        <Button variant="outline" onClick={() => setDialog("reassign")}>
          <Users />
          Ubah Teknisi
        </Button>
      ) : null}
      {p.can_update ? (
        <Button asChild variant="outline">
          <Link href={`/work-orders/${wo.id}/edit`}>
            <Pencil />
            Ubah
          </Link>
        </Button>
      ) : null}
      <Button asChild variant="outline">
        <a href={workOrderPdfUrl(wo.id)} target="_blank" rel="noopener noreferrer">
          <Printer />
          Cetak PDF
        </a>
      </Button>
      {p.can_convert ? (
        <Button variant="outline" onClick={() => setDialog("convert")}>
          <ArrowRightLeft />
          Alihkan ke Form Request
        </Button>
      ) : null}
      {p.can_cancel ? (
        <Button
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:ml-auto"
          onClick={() => setDialog("cancel")}
        >
          <XCircle />
          Batalkan WO
        </Button>
      ) : null}

      <ConfirmDialog
        open={dialog === "pick"}
        onOpenChange={(open) => !open && close()}
        title="Ambil WO ini?"
        description="Anda akan menjadi teknisi (ketua) WO ini dan statusnya langsung menjadi DIKERJAKAN."
        confirmLabel="Ambil WO"
        loading={pick.isPending}
        onConfirm={() => pick.mutate()}
      />
      <ConfirmDialog
        open={dialog === "start"}
        onOpenChange={(open) => !open && close()}
        title="Mulai kerjakan WO ini?"
        description="Status WO akan berubah menjadi DIKERJAKAN dan waktu mulai dicatat."
        confirmLabel="Mulai Kerjakan"
        loading={start.isPending}
        onConfirm={() => start.mutate()}
      />
      <AssignDialog
        wo={wo}
        mode="receive"
        open={dialog === "receive"}
        onOpenChange={(open) => !open && close()}
      />
      <AssignDialog
        wo={wo}
        mode="reassign"
        open={dialog === "reassign"}
        onOpenChange={(open) => !open && close()}
      />
      <AcceptDialog wo={wo} open={dialog === "accept"} onOpenChange={(open) => !open && close()} />
      <CancelDialog wo={wo} open={dialog === "cancel"} onOpenChange={(open) => !open && close()} />
      <ReasonDialog
        open={dialog === "convert"}
        onOpenChange={(open) => !open && close()}
        title="Alihkan ke Form Request?"
        description="WO akan berstatus DIALIHKAN KE FORM REQUEST dan dibuatkan Form Request (draft) milik pemohon dengan isi yang sama, mis. karena butuh biaya/persetujuan."
        label="Alasan pengalihan"
        placeholder="Contoh: perlu pembelian sparepart, gunakan Form Request"
        required
        fieldKey="reason"
        confirmLabel="Alihkan"
        loading={convert.isPending}
        error={convert.error}
        onSubmit={(reason) => convert.mutate(reason)}
      />
    </div>
  );
}
