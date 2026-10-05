"use client";

import * as React from "react";
import { AlertTriangle, ClipboardCheck, Save, X } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { useExecutorStaff } from "@/hooks/use-lookups";
import { ApiError } from "@/lib/api";
import { DEFAULT_CLEARANCE_ITEMS } from "@/lib/constants";
import { completeWorkOrder, updateLabours, updateMaterials } from "@/lib/work-orders";
import type { ClearanceResult, CompletePayload, MaterialInput, WorkOrderDetail } from "@/types/work-order";
import { CLEARANCE_SEGMENTS } from "./accept-dialog";
import {
  LaboursEditor,
  labourRowsFrom,
  toLabourInputs,
  validateLabourRows,
  type LabourField,
  type LabourRow,
} from "./labours-editor";
import {
  MaterialsEditor,
  materialRowsFrom,
  validateMaterialRows,
  type MaterialField,
  type MaterialRow,
} from "./materials-editor";
import { firstError, useWorkOrderAction, validationErrors } from "./use-work-order-action";

function toMaterialInputs(rows: MaterialRow[]): MaterialInput[] {
  return rows.map((row) => ({
    material_id: row.material_id,
    material_name: row.material_name.trim(),
    quantity: Number(row.quantity),
    unit: row.unit.trim() || null,
  }));
}

function prefixed(errors: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).map(([key, value]) => [`${prefix}.${key}`, value]));
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold">{children}</h3>;
}

interface CompletePanelProps {
  wo: WorkOrderDetail;
  onClose: () => void;
}

/**
 * Technician panel: work done, materials, labours, MTC clearance and remarks.
 * "Simpan Draf" (can_work) stores materials + labours; "Selesai" (can_complete) sends everything.
 */
export const CompletePanel = React.forwardRef<HTMLDivElement, CompletePanelProps>(function CompletePanel(
  { wo, onClose },
  ref,
) {
  const { can_work: canWork, can_complete: canComplete } = wo.permissions;
  const staff = useExecutorStaff(wo.executor_unit.id);

  const clearanceItems = wo.clearances.length
    ? [...wo.clearances].sort((a, b) => a.item_no - b.item_no)
    : DEFAULT_CLEARANCE_ITEMS.map((item) => ({ ...item, mtc_result: null }));

  const [workDone, setWorkDone] = React.useState(wo.work_done ?? "");
  const [materials, setMaterials] = React.useState<MaterialRow[]>(() => materialRowsFrom(wo.materials));
  const [labours, setLabours] = React.useState<LabourRow[]>(() => labourRowsFrom(wo));
  const [clearance, setClearance] = React.useState<Record<number, ClearanceResult | undefined>>(() =>
    Object.fromEntries(wo.clearances.map((item) => [item.item_no, item.mtc_result ?? undefined])),
  );
  const [remarks, setRemarks] = React.useState(wo.remarks ?? "");
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const saveDraft = useWorkOrderAction(
    wo.id,
    async () => {
      await updateMaterials(wo.id, toMaterialInputs(materials));
      // The labours response (if any) is the freshest detail; otherwise the detail is refetched.
      return updateLabours(wo.id, toLabourInputs(labours));
    },
    { successMessage: "Draf material & pekerja disimpan." },
  );

  const complete = useWorkOrderAction(wo.id, (payload: CompletePayload) => completeWorkOrder(wo.id, payload), {
    successMessage: "Pekerjaan selesai. Menunggu konfirmasi penerimaan dari pemohon.",
    onSuccess: () => {
      setConfirmOpen(false);
      onClose();
    },
  });

  const serverErrors = { ...validationErrors(saveDraft.error), ...validationErrors(complete.error) };
  // The panel is long: repeat the server's 422 summary next to the buttons.
  const serverSummary = [complete.error, saveDraft.error].find(
    (error): error is ApiError => error instanceof ApiError && error.status === 422,
  )?.message;
  const errorFor = (...keys: string[]) =>
    keys.map((key) => clientErrors[key]).find(Boolean) ?? firstError(serverErrors, ...keys);
  const materialError = (index: number, field: MaterialField) => errorFor(`materials.${index}.${field}`);
  const labourError = (index: number, field: LabourField) => errorFor(`labours.${index}.${field}`);

  const validate = (mode: "draft" | "complete"): boolean => {
    const errors: Record<string, string> = {
      ...prefixed(validateMaterialRows(materials), "materials"),
      ...prefixed(validateLabourRows(labours), "labours"),
    };
    if (mode === "complete") {
      if (!workDone.trim()) errors.work_done = "Uraian pekerjaan yang diselesaikan wajib diisi.";
      if (labours.length === 0) errors.labours = "Tambahkan minimal satu pekerja.";
      if (clearanceItems.some((item) => !clearance[item.item_no])) {
        errors.clearance = "Isi semua item clearance (OK/TDK).";
      }
    }
    setClientErrors(errors);
    if (Object.keys(errors).length) {
      toast.error("Periksa kembali isian yang ditandai.");
      return false;
    }
    return true;
  };

  const onSaveDraft = () => {
    complete.reset();
    if (validate("draft")) saveDraft.mutate();
  };

  const onComplete = () => {
    saveDraft.reset();
    if (validate("complete")) setConfirmOpen(true);
  };

  const submitComplete = () =>
    complete.mutate({
      work_done: workDone.trim(),
      materials: toMaterialInputs(materials),
      labours: toLabourInputs(labours),
      clearance: clearanceItems.map((item) => ({
        item_no: item.item_no,
        result: clearance[item.item_no] as ClearanceResult,
      })),
      remarks: remarks.trim() || null,
    });

  const busy = saveDraft.isPending || complete.isPending;

  return (
    <Card ref={ref} id="selesaikan" className="scroll-mt-20 border-primary/40 ring-1 ring-primary/20">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 border-b">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" aria-hidden />
            Selesaikan Pekerjaan
          </CardTitle>
          <CardDescription>
            {canWork ? "Simpan draf material & pekerja kapan saja. " : ""}
            Tekan &quot;Selesai&quot; bila pekerjaan sudah tuntas.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup panel" disabled={busy}>
          <X />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6 pt-4 sm:pt-5">
        {wo.rework_count > 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              WO ini dikembalikan pemohon ({wo.rework_count}x). Lihat alasannya di bagian Riwayat sebelum
              menyelesaikan ulang.
            </span>
          </div>
        ) : null}

        <Field label="Pekerjaan perbaikan selesai" htmlFor="work_done" required error={errorFor("work_done")}>
          <Textarea
            id="work_done"
            value={workDone}
            onChange={(event) => setWorkDone(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Uraikan pekerjaan yang telah dilakukan..."
            disabled={busy}
            invalid={!!errorFor("work_done")}
          />
        </Field>

        <section className="space-y-2">
          <SubHeading>Material</SubHeading>
          <MaterialsEditor rows={materials} onChange={setMaterials} errorAt={materialError} disabled={busy} />
          <FieldError message={errorFor("materials")} />
        </section>

        <section className="space-y-2">
          <SubHeading>Pekerja</SubHeading>
          <LaboursEditor
            rows={labours}
            onChange={setLabours}
            staff={staff.data ?? []}
            staffLoading={staff.isPending && staff.fetchStatus !== "idle"}
            errorAt={labourError}
            disabled={busy}
          />
          <FieldError message={errorFor("labours")} />
        </section>

        <section className="space-y-2">
          <SubHeading>Maintenance clearance (konfirmasi MTC)</SubHeading>
          <ul className="divide-y rounded-md border">
            {clearanceItems.map((item) => (
              <li key={item.item_no} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <span className="text-sm">
                  {item.item_no}. {item.item_label}
                </span>
                <Segmented
                  name={`mtc-clearance-${item.item_no}`}
                  aria-label={item.item_label}
                  value={clearance[item.item_no]}
                  options={CLEARANCE_SEGMENTS}
                  onChange={(value) => setClearance((current) => ({ ...current, [item.item_no]: value }))}
                  disabled={busy}
                />
              </li>
            ))}
          </ul>
          <FieldError message={errorFor("clearance", "clearance.*")} />
        </section>

        <Field label="Remarks" htmlFor="complete-remarks" error={errorFor("remarks")}>
          <Textarea
            id="complete-remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Catatan tambahan (opsional)"
            disabled={busy}
          />
        </Field>

        {serverSummary ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{serverSummary}</span>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          {canWork ? (
            <Button variant="outline" onClick={onSaveDraft} loading={saveDraft.isPending} disabled={busy}>
              {saveDraft.isPending ? null : <Save />}
              Simpan Draf Material &amp; Pekerja
            </Button>
          ) : null}
          {canComplete ? (
            <Button onClick={onComplete} disabled={busy}>
              <ClipboardCheck />
              Selesai
            </Button>
          ) : null}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Tandai pekerjaan selesai?"
        description="Status WO menjadi SELESAI dan pemohon akan diminta mengonfirmasi penerimaan. Data material, pekerja, dan clearance tidak dapat diubah lagi kecuali WO dikembalikan."
        confirmLabel="Ya, selesai"
        loading={complete.isPending}
        onConfirm={submitComplete}
      />
    </Card>
  );
});
