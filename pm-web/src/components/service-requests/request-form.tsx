"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, MessageSquareWarning, Save, Send } from "lucide-react";
import { FilePicker } from "@/components/common/file-picker";
import { useCurrentUser } from "@/components/layout/current-user";
import { PriorityPicker } from "@/components/work-orders/priority-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { useExecutorUnits, useMySuperior, useOffices } from "@/hooks/use-lookups";
import { ApiError, errorMessage } from "@/lib/api";
import { ATTACHMENT_MIME_TYPES, MAX_ATTACHMENTS, SR_PRIORITY_OPTIONS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import {
  createServiceRequest,
  serviceRequestCollectionFor,
  submitServiceRequest,
  updateServiceRequest,
  uploadServiceRequestAttachment,
} from "@/lib/service-requests";
import type { ValidationErrors } from "@/types/api";
import type { SuperiorCandidate } from "@/types/lookups";
import type { ServiceRequestDetail, ServiceRequestPayload, ServiceRequestPriority } from "@/types/service-request";
import { IdentityBlock, identityFromMe } from "./identity-block";
import { RequestRules } from "./request-rules";
import { SuperiorCombobox } from "./superior-combobox";

interface FormState {
  officeId: string;
  executorUnitId: string;
  categoryId: string;
  priority: ServiceRequestPriority;
  purpose: string;
  estimatedCost: number | null;
  superior: SuperiorCandidate | null;
}

type FieldKey = keyof ServiceRequestPayload;
type SaveMode = "draft" | "submit";

/** DOM ids of the controls, so the first invalid field can receive focus on submit. */
const FIELD_IDS: Partial<Record<FieldKey, string>> = {
  office_id: "office_id",
  executor_unit_id: "sr_executor_unit_id",
  service_category_id: "sr_service_category_id",
  estimated_cost: "estimated_cost",
  purpose: "purpose",
  superior_id: "superior_search",
};

const FIELD_ORDER: FieldKey[] = [
  "office_id",
  "executor_unit_id",
  "service_category_id",
  "estimated_cost",
  "priority",
  "purpose",
  "superior_id",
];

function initialState(request?: ServiceRequestDetail): FormState {
  if (!request) {
    return {
      officeId: "",
      executorUnitId: "",
      categoryId: "",
      priority: "medium",
      purpose: "",
      estimatedCost: null,
      superior: null,
    };
  }
  const cost = request.estimated_cost === null ? null : Number(request.estimated_cost);
  return {
    officeId: request.office ? String(request.office.id) : "",
    executorUnitId: String(request.executor_unit.id),
    categoryId: request.service_category ? String(request.service_category.id) : "",
    priority: request.priority,
    purpose: request.purpose,
    estimatedCost: cost !== null && Number.isFinite(cost) ? Math.round(cost) : null,
    superior: request.superior,
  };
}

/** Latest "revision requested" note, shown when editing a returned draft. */
function latestRevisionNote(request?: ServiceRequestDetail) {
  if (!request) return null;
  const steps = [...request.approval_history, ...request.approval_steps].filter(
    (step) => step.status === "revision_requested",
  );
  steps.sort((a, b) => new Date(b.acted_at ?? 0).getTime() - new Date(a.acted_at ?? 0).getTime());
  return steps[0] ?? null;
}

function focusFirstInvalid(errors: Partial<Record<FieldKey, string>>) {
  const first = FIELD_ORDER.find((key) => errors[key]);
  const id = first ? FIELD_IDS[first] : undefined;
  if (!id) return;
  const element = document.getElementById(id);
  if (element instanceof HTMLElement) {
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

/** Placeholder shaped like the form (identity card + request card + footer buttons). */
export function RequestFormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="panel space-y-4 p-4 sm:p-5">
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
      <div className="panel space-y-4 p-4 sm:p-5">
        <Skeleton className="h-4 w-28" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>
    </div>
  );
}

export function RequestForm({ request }: { request?: ServiceRequestDetail }) {
  const isEdit = !!request;
  const me = useCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const offices = useOffices();
  const executorUnits = useExecutorUnits("request");
  const mySuperior = useMySuperior(!isEdit);

  const [form, setForm] = React.useState<FormState>(() => initialState(request));
  const [superiorTouched, setSuperiorTouched] = React.useState(isEdit);
  const [files, setFiles] = React.useState<File[]>([]);
  const [clientErrors, setClientErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [serverErrors, setServerErrors] = React.useState<ValidationErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<string | null>(null);

  // Prefill the superior from the Portal default until the user picks one.
  React.useEffect(() => {
    if (!superiorTouched && mySuperior.data) {
      setForm((current) => (current.superior ? current : { ...current, superior: mySuperior.data ?? null }));
    }
  }, [mySuperior.data, superiorTouched]);

  const selectedUnit = executorUnits.data?.find((unit) => String(unit.id) === form.executorUnitId);
  const categories = selectedUnit?.categories ?? [];
  const fileSlots = MAX_ATTACHMENTS - (request?.attachments.length ?? 0);
  const revisionNote = latestRevisionNote(request);
  const canSubmit = !request || request.permissions.can_submit;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const errorFor = (key: FieldKey) => clientErrors[key] ?? serverErrors[key]?.[0];

  const validate = () => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!form.officeId) errors.office_id = "Pilih office.";
    if (!form.executorUnitId) errors.executor_unit_id = "Pilih unit pelaksana.";
    if (!form.categoryId) errors.service_category_id = "Pilih jenis permintaan.";
    if (!form.purpose.trim()) errors.purpose = "Keperluan wajib diisi.";
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) focusFirstInvalid(errors);
    return Object.keys(errors).length === 0;
  };

  const buildPayload = (): ServiceRequestPayload => ({
    executor_unit_id: form.executorUnitId ? Number(form.executorUnitId) : null,
    service_category_id: form.categoryId ? Number(form.categoryId) : null,
    office_id: form.officeId ? Number(form.officeId) : null,
    purpose: form.purpose.trim(),
    priority: form.priority,
    estimated_cost: form.estimatedCost,
    superior_id: form.superior?.id ?? null,
  });

  const mutation = useMutation({
    mutationFn: async ({ mode, payload }: { mode: SaveMode; payload: ServiceRequestPayload }) => {
      setProgress("Menyimpan…");
      let detail = request
        ? await updateServiceRequest(request.id, payload)
        : await createServiceRequest(payload);

      const failed: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        setProgress(`Mengunggah lampiran ${index + 1}/${files.length}…`);
        try {
          await uploadServiceRequestAttachment(detail.id, files[index], serviceRequestCollectionFor(files[index]));
        } catch (error) {
          failed.push(`${files[index].name}: ${errorMessage(error)}`);
        }
      }

      let submitError: unknown = null;
      if (mode === "submit") {
        setProgress("Mengajukan…");
        try {
          detail = await submitServiceRequest(detail.id, payload.superior_id);
        } catch (error) {
          submitError = error;
        }
      }
      return { detail, failed, submitError, mode };
    },
    onSuccess: ({ detail, failed, submitError, mode }) => {
      setProgress(null);
      queryClient.setQueryData(queryKeys.serviceRequest(detail.id), detail);
      if (files.length) void queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequest(detail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequestLists });
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });

      if (mode === "submit" && !submitError) {
        toast.success(detail.request_number ? `Form Request ${detail.request_number} diajukan.` : "Form Request diajukan.");
      } else if (submitError) {
        toast.error("Draf tersimpan, tetapi gagal diajukan", { description: errorMessage(submitError), duration: 10000 });
      } else {
        toast.success("Draf Form Request disimpan.");
      }
      if (failed.length) {
        toast.error(`${failed.length} lampiran gagal diunggah`, {
          description: (
            <ul className="list-disc space-y-0.5 pl-4">
              {failed.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ),
          duration: 10000,
        });
      }
      router.push(`/requests/${detail.id}`);
    },
    onError: (error) => {
      setProgress(null);
      if (error instanceof ApiError && error.status === 422) {
        setServerErrors(error.errors);
        focusFirstInvalid(
          Object.fromEntries(Object.keys(error.errors).map((key) => [key, "x"])) as Partial<Record<FieldKey, string>>,
        );
      }
      setFormError(errorMessage(error));
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const save = (mode: SaveMode) => {
    setServerErrors({});
    setFormError(null);
    if (!validate()) {
      setFormError("Lengkapi isian yang ditandai terlebih dahulu.");
      return;
    }
    mutation.mutate({ mode, payload: buildPayload() });
  };

  const submitting = mutation.isPending;
  const pendingMode = mutation.variables?.mode;
  const savingDraft = submitting && pendingMode === "draft";
  const savingSubmit = submitting && pendingMode === "submit";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save("draft");
      }}
      className="space-y-4 pb-28 sm:pb-0"
      noValidate
    >
      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger-foreground"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      ) : null}

      {revisionNote ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground"
        >
          <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">
              Diminta revisi oleh {revisionNote.acted_by?.name ?? revisionNote.assignee_label ?? revisionNote.label}
              {revisionNote.acted_at ? (
                <span className="tabular font-normal"> ({formatDateTime(revisionNote.acted_at)})</span>
              ) : null}
            </p>
            {revisionNote.notes ? <p className="mt-1 whitespace-pre-wrap break-words">{revisionNote.notes}</p> : null}
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Identitas karyawan</CardTitle>
          <CardDescription>Diambil otomatis dari profil Portal INTES.</CardDescription>
        </CardHeader>
        <CardContent>
          <IdentityBlock identity={identityFromMe(me)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permintaan</CardTitle>
          <CardDescription>Isi apa yang diminta, unit yang menangani, dan prioritasnya.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Office" htmlFor="office_id" required error={errorFor("office_id")}>
            <Select
              id="office_id"
              name="office_id"
              value={form.officeId}
              onChange={(event) => update("officeId", event.target.value)}
              disabled={offices.isPending || submitting}
              invalid={!!errorFor("office_id")}
            >
              <option value="">{offices.isPending ? "Memuat…" : "Pilih office"}</option>
              {offices.data?.map((office) => (
                <option key={office.id} value={String(office.id)}>
                  {office.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Unit pelaksana" htmlFor="sr_executor_unit_id" required error={errorFor("executor_unit_id")}>
            <Select
              id="sr_executor_unit_id"
              name="executor_unit_id"
              value={form.executorUnitId}
              onChange={(event) =>
                setForm((current) => ({ ...current, executorUnitId: event.target.value, categoryId: "" }))
              }
              disabled={executorUnits.isPending || submitting}
              invalid={!!errorFor("executor_unit_id")}
            >
              <option value="">{executorUnits.isPending ? "Memuat…" : "Pilih unit pelaksana"}</option>
              {executorUnits.data?.map((unit) => (
                <option key={unit.id} value={String(unit.id)}>
                  {unit.display_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Jenis permintaan"
            htmlFor="sr_service_category_id"
            required
            error={errorFor("service_category_id")}
          >
            <Select
              id="sr_service_category_id"
              name="service_category_id"
              value={form.categoryId}
              onChange={(event) => update("categoryId", event.target.value)}
              disabled={!selectedUnit || submitting}
              invalid={!!errorFor("service_category_id")}
            >
              <option value="">{selectedUnit ? "Pilih jenis permintaan" : "Pilih unit pelaksana dulu"}</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Estimasi biaya"
            htmlFor="estimated_cost"
            error={errorFor("estimated_cost")}
            hint="Opsional, dalam rupiah. Contoh: 1.500.000"
          >
            <CurrencyInput
              id="estimated_cost"
              name="estimated_cost"
              value={form.estimatedCost}
              onChange={(value) => update("estimatedCost", value)}
              placeholder="0"
              disabled={submitting}
              invalid={!!errorFor("estimated_cost")}
            />
          </Field>

          <Field label="Prioritas" required error={errorFor("priority")} className="sm:col-span-2">
            <PriorityPicker
              name="sr-priority"
              value={form.priority}
              onChange={(priority) => update("priority", priority)}
              options={SR_PRIORITY_OPTIONS}
              disabled={submitting}
              invalid={!!errorFor("priority")}
            />
          </Field>

          <Field
            label="Keperluan"
            htmlFor="purpose"
            required
            error={errorFor("purpose")}
            hint={`${form.purpose.length}/2000 karakter.`}
            className="sm:col-span-2"
          >
            <Textarea
              id="purpose"
              name="purpose"
              value={form.purpose}
              onChange={(event) => update("purpose", event.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Jelaskan barang/akses/layanan yang diminta dan alasannya…"
              disabled={submitting}
              invalid={!!errorFor("purpose")}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atasan yang menyetujui</CardTitle>
          <CardDescription>
            Default dari data atasan di Portal. Anda dapat menggantinya dengan pejabat lain yang grade-nya lebih tinggi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field
            label="Atasan YBS"
            htmlFor="superior_search"
            error={errorFor("superior_id")}
            hint={
              form.superior
                ? undefined
                : mySuperior.isPending && !isEdit
                  ? "Memuat atasan default…"
                  : "Bila dikosongkan, dipakai atasan dari Portal; bila tidak ada, langkah atasan dilewati."
            }
          >
            <SuperiorCombobox
              id="superior_search"
              selected={form.superior}
              onChange={(superior) => {
                setSuperiorTouched(true);
                update("superior", superior);
              }}
              disabled={submitting}
              invalid={!!errorFor("superior_id")}
            />
          </Field>
        </CardContent>
      </Card>

      {selectedUnit ? (
        <Card>
          <CardHeader>
            <CardTitle>Petunjuk dan aturan</CardTitle>
            <CardDescription>Dari {selectedUnit.display_name}. Berlaku setelah Form Request disahkan.</CardDescription>
          </CardHeader>
          <CardContent>
            <RequestRules rules={selectedUnit.request_rules} contactFooter={selectedUnit.contact_footer} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Lampiran</CardTitle>
          <CardDescription>
            Dokumen pendukung (PDF) atau foto.
            {request && request.attachments.length > 0
              ? ` ${request.attachments.length} lampiran yang sudah ada dapat dikelola di halaman detail.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fileSlots > 0 ? (
            <FilePicker
              files={files}
              onChange={setFiles}
              max={fileSlots}
              accept={ATTACHMENT_MIME_TYPES}
              disabled={submitting}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Batas {MAX_ATTACHMENTS} lampiran sudah tercapai.</p>
          )}
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap gap-2 border-t bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button asChild variant="ghost" className="sm:flex-none">
          <Link href={request ? `/requests/${request.id}` : "/requests"} aria-disabled={submitting}>
            Batal
          </Link>
        </Button>
        <Button type="submit" variant="outline" className="flex-1 sm:flex-none" loading={savingDraft} disabled={submitting}>
          {savingDraft ? null : <Save aria-hidden />}
          {savingDraft ? progress ?? "Menyimpan…" : "Simpan Draf"}
        </Button>
        {canSubmit ? (
          <Button className="flex-1 sm:flex-none" onClick={() => save("submit")} loading={savingSubmit} disabled={submitting}>
            {savingSubmit ? null : <Send aria-hidden />}
            {savingSubmit ? progress ?? "Mengajukan…" : "Simpan & Ajukan"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
