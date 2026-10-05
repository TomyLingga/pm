"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, PencilLine, Search } from "lucide-react";
import { AsyncCombobox } from "@/components/common/async-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { useExecutorUnits } from "@/hooks/use-lookups";
import { ApiError, errorMessage } from "@/lib/api";
import { MAX_ATTACHMENTS } from "@/lib/constants";
import { searchEquipment, searchLocations } from "@/lib/lookups";
import { queryKeys } from "@/lib/query-keys";
import { createWorkOrder, updateWorkOrder, uploadAttachment } from "@/lib/work-orders";
import type { ValidationErrors } from "@/types/api";
import type { EquipmentOption, LocationOption } from "@/types/lookups";
import type { WorkOrderDetail, WorkOrderPayload, WorkOrderPriority } from "@/types/work-order";
import { PhotoPicker } from "./photo-picker";
import { PriorityPicker } from "./priority-picker";

interface FormState {
  executorUnitId: string;
  categoryId: string;
  categoryNote: string;
  equipment: EquipmentOption | null;
  manualEquipment: boolean;
  equipmentCode: string;
  equipmentName: string;
  location: LocationOption | null;
  locationNote: string;
  description: string;
  priority: WorkOrderPriority;
}

function initialState(wo?: WorkOrderDetail): FormState {
  if (!wo) {
    return {
      executorUnitId: "",
      categoryId: "",
      categoryNote: "",
      equipment: null,
      manualEquipment: false,
      equipmentCode: "",
      equipmentName: "",
      location: null,
      locationNote: "",
      description: "",
      priority: "medium",
    };
  }
  const manual = !wo.equipment && !!(wo.equipment_code || wo.equipment_name);
  return {
    executorUnitId: String(wo.executor_unit.id),
    categoryId: wo.service_category ? String(wo.service_category.id) : "",
    categoryNote: wo.category_note ?? "",
    equipment: wo.equipment ? { ...wo.equipment, location: null } : null,
    manualEquipment: manual,
    equipmentCode: manual ? wo.equipment_code ?? "" : "",
    equipmentName: manual ? wo.equipment_name ?? "" : "",
    location: wo.location,
    locationNote: wo.location_note ?? "",
    description: wo.request_description,
    priority: wo.priority,
  };
}

type FieldKey = keyof WorkOrderPayload;

interface WorkOrderFormProps {
  /** When given, the form edits this WO (`PUT`), otherwise it creates a new one. */
  workOrder?: WorkOrderDetail;
}

export function WorkOrderForm({ workOrder }: WorkOrderFormProps) {
  const isEdit = !!workOrder;
  const router = useRouter();
  const queryClient = useQueryClient();
  const executorUnits = useExecutorUnits();

  const [form, setForm] = React.useState<FormState>(() => initialState(workOrder));
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [clientErrors, setClientErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [serverErrors, setServerErrors] = React.useState<ValidationErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState<{ done: number; total: number } | null>(null);

  const selectedUnit = executorUnits.data?.find((unit) => String(unit.id) === form.executorUnitId);
  const categories = selectedUnit?.categories ?? [];
  const selectedCategory = categories.find((category) => String(category.id) === form.categoryId);
  const executorUnitId = form.executorUnitId ? Number(form.executorUnitId) : null;
  const photoSlots = MAX_ATTACHMENTS - (workOrder?.attachments.length ?? 0);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const errorFor = (key: FieldKey) => clientErrors[key] ?? serverErrors[key]?.[0];

  const validate = (): boolean => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!form.executorUnitId) errors.executor_unit_id = "Pilih unit pelaksana.";
    if (!form.categoryId) errors.service_category_id = "Pilih kategori pekerjaan.";
    if (selectedCategory?.requires_note && !form.categoryNote.trim()) {
      errors.category_note = "Keterangan kategori wajib diisi.";
    }
    if (!form.description.trim()) errors.request_description = "Uraian permintaan pekerjaan wajib diisi.";
    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildPayload = (): WorkOrderPayload => ({
    executor_unit_id: executorUnitId,
    service_category_id: form.categoryId ? Number(form.categoryId) : null,
    category_note: selectedCategory?.requires_note ? form.categoryNote.trim() || null : null,
    equipment_id: form.manualEquipment ? null : form.equipment?.id ?? null,
    equipment_code: form.manualEquipment ? form.equipmentCode.trim() || null : null,
    equipment_name: form.manualEquipment ? form.equipmentName.trim() || null : null,
    location_id: form.location?.id ?? null,
    location_note: form.locationNote.trim() || null,
    request_description: form.description.trim(),
    priority: form.priority,
  });

  const mutation = useMutation({
    mutationFn: async (payload: WorkOrderPayload) => {
      const detail = workOrder ? await updateWorkOrder(workOrder.id, payload) : await createWorkOrder(payload);
      const failed: string[] = [];
      for (let index = 0; index < photos.length; index += 1) {
        setUploadProgress({ done: index, total: photos.length });
        try {
          await uploadAttachment(detail.id, photos[index], "photo_before");
        } catch (error) {
          failed.push(`${photos[index].name}: ${errorMessage(error)}`);
        }
      }
      return { detail, failed };
    },
    onSuccess: ({ detail, failed }) => {
      queryClient.setQueryData(queryKeys.workOrder(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
      toast.success(isEdit ? "Perubahan WO disimpan." : `WO ${detail.wo_number} berhasil dibuat.`);
      if (failed.length) {
        toast.error(`${failed.length} foto gagal diunggah`, {
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
      router.push(`/work-orders/${detail.id}`);
    },
    onError: (error) => {
      setUploadProgress(null);
      if (error instanceof ApiError && error.status === 422) {
        setServerErrors(error.errors);
      }
      setFormError(errorMessage(error));
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setServerErrors({});
    setFormError(null);
    if (!validate()) {
      setFormError("Lengkapi isian yang ditandai terlebih dahulu.");
      return;
    }
    mutation.mutate(buildPayload());
  };

  const submitting = mutation.isPending;
  const submitLabel = uploadProgress
    ? `Mengunggah foto ${uploadProgress.done + 1}/${uploadProgress.total}...`
    : isEdit
      ? "Simpan Perubahan"
      : "Kirim WO";

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-24 sm:pb-0" noValidate>
      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Tujuan pekerjaan</CardTitle>
          <CardDescription>Pilih unit pelaksana dan kategori layanan yang dibutuhkan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Unit pelaksana" htmlFor="executor_unit_id" required error={errorFor("executor_unit_id")}>
            <Select
              id="executor_unit_id"
              value={form.executorUnitId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  executorUnitId: event.target.value,
                  categoryId: "",
                  categoryNote: "",
                }))
              }
              disabled={executorUnits.isPending || submitting}
              invalid={!!errorFor("executor_unit_id")}
            >
              <option value="">{executorUnits.isPending ? "Memuat..." : "Pilih unit pelaksana"}</option>
              {executorUnits.data?.map((unit) => (
                <option key={unit.id} value={String(unit.id)}>
                  {unit.display_name}
                </option>
              ))}
            </Select>
            {executorUnits.isError ? (
              <p className="text-xs text-destructive">{errorMessage(executorUnits.error)}</p>
            ) : null}
          </Field>

          <Field label="Kategori" htmlFor="service_category_id" required error={errorFor("service_category_id")}>
            <Select
              id="service_category_id"
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryId: event.target.value, categoryNote: "" }))
              }
              disabled={!selectedUnit || submitting}
              invalid={!!errorFor("service_category_id")}
            >
              <option value="">{selectedUnit ? "Pilih kategori" : "Pilih unit pelaksana dulu"}</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          {selectedCategory?.requires_note ? (
            <Field
              label="Keterangan kategori"
              htmlFor="category_note"
              required
              error={errorFor("category_note")}
              className="sm:col-span-2"
            >
              <Input
                id="category_note"
                value={form.categoryNote}
                onChange={(event) => update("categoryNote", event.target.value)}
                placeholder="Jelaskan jenis pekerjaan"
                maxLength={255}
                disabled={submitting}
                invalid={!!errorFor("category_note")}
              />
            </Field>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alat &amp; lokasi</CardTitle>
          <CardDescription>Boleh dikosongkan bila pekerjaan tidak terkait alat tertentu.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {form.manualEquipment ? (
              <div className="space-y-3 rounded-lg border border-dashed p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Alat diisi manual</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        manualEquipment: false,
                        equipmentCode: "",
                        equipmentName: "",
                      }))
                    }
                    disabled={submitting}
                  >
                    <Search />
                    Cari dari daftar alat
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                  <Field label="No. alat" htmlFor="equipment_code" error={errorFor("equipment_code")}>
                    <Input
                      id="equipment_code"
                      value={form.equipmentCode}
                      onChange={(event) => update("equipmentCode", event.target.value)}
                      placeholder="Contoh: PRN-01"
                      maxLength={100}
                      disabled={submitting}
                      invalid={!!errorFor("equipment_code")}
                    />
                  </Field>
                  <Field label="Nama alat" htmlFor="equipment_name" error={errorFor("equipment_name")}>
                    <Input
                      id="equipment_name"
                      value={form.equipmentName}
                      onChange={(event) => update("equipmentName", event.target.value)}
                      placeholder="Contoh: Printer Epson L3110"
                      maxLength={255}
                      disabled={submitting}
                      invalid={!!errorFor("equipment_name")}
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <Field
                label="Alat"
                htmlFor="equipment_search"
                error={errorFor("equipment_id")}
                hint="Ketik nomor atau nama alat."
              >
                <AsyncCombobox<EquipmentOption>
                  id="equipment_search"
                  selected={form.equipment}
                  onChange={(equipment) =>
                    setForm((current) => ({
                      ...current,
                      equipment,
                      location: current.location ?? equipment?.location ?? null,
                    }))
                  }
                  queryKey={(q) => queryKeys.equipment(q, executorUnitId)}
                  fetcher={(q, signal) => searchEquipment(q, executorUnitId, signal)}
                  getKey={(item) => item.id}
                  minChars={0}
                  placeholder="Cari alat..."
                  emptyText="Alat tidak ditemukan."
                  disabled={submitting}
                  invalid={!!errorFor("equipment_id")}
                  renderOption={(item) => (
                    <div>
                      <p className="font-medium">
                        {item.code ? <span className="font-mono text-xs">{item.code} &middot; </span> : null}
                        {item.name}
                      </p>
                      {item.location ? <p className="text-xs text-muted-foreground">{item.location.name}</p> : null}
                    </div>
                  )}
                  renderSelected={(item) => (
                    <p className="truncate">
                      {item.code ? <span className="font-mono text-xs">{item.code} &middot; </span> : null}
                      {item.name}
                    </p>
                  )}
                  footer={(close) => (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        setForm((current) => ({ ...current, manualEquipment: true, equipment: null }));
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm font-medium text-primary hover:bg-accent"
                    >
                      <PencilLine className="h-4 w-4" aria-hidden />
                      Alat tidak ada di daftar? Isi manual
                    </button>
                  )}
                />
              </Field>
            )}
          </div>

          <Field label="Lokasi" htmlFor="location_search" error={errorFor("location_id")}>
            <AsyncCombobox<LocationOption>
              id="location_search"
              selected={form.location}
              onChange={(location) => update("location", location)}
              queryKey={(q) => queryKeys.locations(q)}
              fetcher={(q, signal) => searchLocations(q, signal)}
              getKey={(item) => item.id}
              minChars={0}
              placeholder="Cari lokasi..."
              emptyText="Lokasi tidak ditemukan."
              disabled={submitting}
              invalid={!!errorFor("location_id")}
              renderOption={(item) => (
                <p>
                  {item.code ? <span className="font-mono text-xs">{item.code} &middot; </span> : null}
                  {item.name}
                </p>
              )}
              renderSelected={(item) => <p className="truncate">{item.name}</p>}
            />
          </Field>

          <Field
            label="Keterangan lokasi"
            htmlFor="location_note"
            error={errorFor("location_note")}
            hint="Opsional, mis. lantai/ruang/titik tertentu."
          >
            <Input
              id="location_note"
              value={form.locationNote}
              onChange={(event) => update("locationNote", event.target.value)}
              placeholder="Contoh: Ruang server lt. 2"
              maxLength={255}
              disabled={submitting}
              invalid={!!errorFor("location_note")}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permintaan pekerjaan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Prioritas" required error={errorFor("priority")}>
            <PriorityPicker
              value={form.priority}
              onChange={(priority) => update("priority", priority)}
              disabled={submitting}
              invalid={!!errorFor("priority")}
            />
          </Field>

          <Field
            label="Uraian permintaan"
            htmlFor="request_description"
            required
            error={errorFor("request_description")}
          >
            <Textarea
              id="request_description"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Jelaskan kerusakan atau pekerjaan yang diminta..."
              rows={5}
              maxLength={2000}
              disabled={submitting}
              invalid={!!errorFor("request_description")}
            />
          </Field>

          <Field label={isEdit ? "Tambah foto" : "Foto kondisi"}>
            {photoSlots > 0 ? (
              <PhotoPicker files={photos} onChange={setPhotos} max={photoSlots} disabled={submitting} />
            ) : (
              <p className="text-sm text-muted-foreground">Batas {MAX_ATTACHMENTS} lampiran untuk WO ini sudah tercapai.</p>
            )}
          </Field>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t bg-card/95 p-3 backdrop-blur sm:static sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        <Button asChild variant="outline" className="flex-1 sm:flex-none">
          <Link href={workOrder ? `/work-orders/${workOrder.id}` : "/work-orders"} aria-disabled={submitting}>
            Batal
          </Link>
        </Button>
        <Button type="submit" className="flex-[2] sm:flex-none" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
