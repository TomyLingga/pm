"use client";

import * as React from "react";
import { Flag, Play, SkipForward, UserRoundCog } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ReasonDialog } from "@/components/common/reason-dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { proposeSkipPmTask, skipPmTask, startPmTask } from "@/lib/pm-tasks";
import type { PmTaskDetail } from "@/types/pm";
import { ReassignDialog } from "./reassign-dialog";
import { usePmTaskAction } from "./use-pm-task";

type DialogKey = "start" | "propose_skip" | "skip" | "reassign" | null;

/** Skip proposal banner + task actions. Buttons are driven exclusively by `task.permissions`. */
export function TaskActionBar({ task }: { task: PmTaskDetail }) {
  const p = task.permissions;
  const [dialog, setDialog] = React.useState<DialogKey>(null);
  const close = () => setDialog(null);
  const onOpenChange = (open: boolean) => !open && close();

  const start = usePmTaskAction(task.id, () => startPmTask(task.id), {
    successMessage: "Tugas dimulai. Silakan isi checklist.",
    onSuccess: close,
  });
  const proposeSkip = usePmTaskAction(task.id, (reason: string) => proposeSkipPmTask(task.id, reason), {
    successMessage: "Usulan lewati dikirim ke pimpinan unit.",
    onSuccess: close,
  });
  const skip = usePmTaskAction(task.id, (reason: string) => skipPmTask(task.id, reason), {
    successMessage: "Tugas dilewati.",
    onSuccess: close,
  });

  const proposal = task.skip_proposal;
  const hasActions = p.can_start || p.can_propose_skip || p.can_skip || p.can_reassign;

  return (
    <>
      {proposal ? (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Flag className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold">
                Usulan lewati dari {proposal.by?.name ?? "teknisi"} &middot;{" "}
                <span className="tabular">{formatDateTime(proposal.at)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap">{proposal.reason}</p>
              {!p.can_skip ? (
                <p className="mt-1 text-xs opacity-80">Menunggu keputusan pimpinan unit.</p>
              ) : null}
            </div>
          </div>
          {p.can_skip ? (
            <Button variant="outline" className="shrink-0" onClick={() => setDialog("skip")}>
              <SkipForward />
              Lewati tugas ini
            </Button>
          ) : null}
        </div>
      ) : null}

      {hasActions ? (
        <div className="panel flex flex-wrap gap-2 p-3 sm:p-4">
          {p.can_start ? (
            <Button size="lg" className="w-full sm:w-auto" onClick={() => setDialog("start")}>
              <Play />
              Mulai Kerjakan
            </Button>
          ) : null}
          {p.can_reassign ? (
            <Button variant="outline" onClick={() => setDialog("reassign")}>
              <UserRoundCog />
              Ganti PIC
            </Button>
          ) : null}
          {p.can_propose_skip ? (
            <Button variant="outline" onClick={() => setDialog("propose_skip")}>
              <Flag />
              Usulkan Lewati
            </Button>
          ) : null}
          {p.can_skip ? (
            <Button
              variant="outline"
              className="border-danger/40 text-danger-foreground hover:bg-danger-soft hover:text-danger-foreground sm:ml-auto"
              onClick={() => setDialog("skip")}
            >
              <SkipForward />
              Lewati
            </Button>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={dialog === "start"}
        onOpenChange={onOpenChange}
        title="Mulai kerjakan tugas ini?"
        description="Status menjadi DIKERJAKAN, waktu mulai dicatat, dan checklist siap diisi."
        confirmLabel="Mulai Kerjakan"
        loading={start.isPending}
        onConfirm={() => start.mutate()}
      />
      <ReasonDialog
        open={dialog === "propose_skip"}
        onOpenChange={onOpenChange}
        title="Usulkan tugas dilewati"
        description="Status tugas tidak berubah. Pimpinan unit akan dinotifikasi dan memutuskan apakah tugas dilewati."
        label="Alasan"
        placeholder="Contoh: alat sedang dipakai produksi / sedang diperbaiki"
        required
        fieldKey="reason"
        confirmLabel="Kirim Usulan"
        loading={proposeSkip.isPending}
        error={proposeSkip.error}
        onSubmit={(reason) => proposeSkip.mutate(reason)}
      />
      <ReasonDialog
        open={dialog === "skip"}
        onOpenChange={onOpenChange}
        title={`Lewati tugas ${task.number}?`}
        description="Tugas berstatus DILEWATI dan tidak dapat dikerjakan lagi. Tugas berikutnya dari jadwal tetap berjalan."
        label="Alasan dilewati"
        defaultValue={proposal?.reason ?? ""}
        required
        fieldKey="reason"
        confirmLabel="Lewati Tugas"
        confirmVariant="destructive"
        loading={skip.isPending}
        error={skip.error}
        onSubmit={(reason) => skip.mutate(reason)}
      />
      <ReassignDialog task={task} open={dialog === "reassign"} onOpenChange={onOpenChange} />
    </>
  );
}
