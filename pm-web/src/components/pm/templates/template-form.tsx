"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api";
import { createChecklistTemplate, updateChecklistTemplate } from "@/lib/pm-templates";
import { queryKeys } from "@/lib/query-keys";
import { firstError } from "@/lib/validation";
import type { ValidationErrors } from "@/types/api";
import type { ChecklistTemplateDetail, ChecklistTemplatePayload } from "@/types/pm";
import { useManageableUnits } from "../use-pm-units";
import {
  ItemsEditor,
  emptyItemRow,
  itemRowsFrom,
  toItemInputs,
  validateItemRows,
  type ItemField,
  type ItemRow,
} from "./items-editor";

interface FormState {
  name: string;
  unitId: string;
  description: string;
  isActive: boolean;
  items: ItemRow[];
}

function initialState(template: ChecklistTemplateDetail | undefined, onlyUnitId: number | null): FormState {
  if (!template) {
    return {
      name: "",
      unitId: onlyUnitId !== null ? String(onlyUnitId) : "",
      description: "",
      isActive: true,
      items: [emptyItemRow()],
    };
  }
  return {
    name: template.name,
    unitId: String(template.executor_unit.id),
    description: template.description ?? "",
    isActive: template.is_active,
    items: itemRowsFrom(template.items),
  };
}

/** Create / edit form of a checklist template (leads of the unit and admins). */
export function TemplateForm({ template }: { template?: ChecklistTemplateDetail }) {
  const isEdit = !!template;
  const router = useRouter();
  const queryClient = useQueryClient();
  const manageable = useManageableUnits();

  const [form, setForm] = React.useState<FormState>(() =>
    initialState(template, manageable.units.length === 1 ? manageable.units[0].id : null),
  );
  const [dirty, setDirty] = React.useState(false);
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = React.useState<ValidationErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const unitOptions = React.useMemo(() => {
    const list = [...manageable.units];
    if (template && !list.some((unit) => unit.id === template.executor_unit.id)) list.unshift(template.executor_unit);
    return list;
  }, [manageable.units, template]);
  // Moving a template that schedules already use to another unit would orphan those schedules.
  const unitLocked = isEdit && (template?.schedules_count ?? 0) > 0;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };
  const errorFor = (key: string) => clientErrors[key] ?? firstError(serverErrors, key);
  const itemError = (index: number, field: ItemField) =>
    clientErrors[`items.${index}.${field}`] ?? firstError(serverErrors, `items.${index}.${field}`);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Nama template wajib diisi.";
    if (!form.unitId) errors.executor_unit_id = "Pilih unit pelaksana.";
    if (form.items.length === 0) errors.items = "Tambahkan minimal satu butir checklist.";
    for (const [key, message] of Object.entries(validateItemRows(form.items))) errors[`items.${key}`] = message;
    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const mutation = useMutation({
    mutationFn: (payload: ChecklistTemplatePayload) =>
      template ? updateChecklistTemplate(template.id, payload) : createChecklistTemplate(payload),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.checklistTemplate(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.checklistTemplates, refetchType: "active" });
      // Tasks not started yet show the template's checklist as a preview.
      void queryClient.invalidateQueries({ queryKey: queryKeys.pmTasks });
      setDirty(false);
      if (isEdit) {
        toast.success("Template disimpan. Berlaku untuk tugas yang belum dimulai.");
        // Take over the server's item ids so new rows are not created twice on the next save.
        setForm(initialState(detail, null));
      } else {
        toast.success("Template checklist dibuat.");
        router.push(`/pm/templates/${detail.id}`);
      }
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) setServerErrors(error.errors);
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
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    mutation.mutate({
      executor_unit_id: Number(form.unitId),
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_active: form.isActive,
      items: toItemInputs(form.items),
    });
  };

  const submitting = mutation.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-24 sm:pb-0" noValidate>
      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger-foreground"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      ) : null}

      {isEdit ? (
        <div className="flex items-start gap-2 rounded-md border border-info/25 bg-info-soft p-3 text-sm text-info-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Perubahan butir berlaku untuk tugas PM yang <strong>belum dimulai</strong>. Tugas yang sedang dikerjakan atau
            sudah selesai tetap memakai butir saat tugas dimulai.
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Template</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama template" htmlFor="template-name" required error={errorFor("name")}>
            <Input
              id="template-name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Contoh: PM Bulanan Kompresor"
              maxLength={150}
              disabled={submitting}
              invalid={!!errorFor("name")}
            />
          </Field>

          <Field
            label="Unit pelaksana"
            htmlFor="template-unit"
            required
            error={errorFor("executor_unit_id")}
            hint={unitLocked ? "Tidak dapat diubah karena template sudah dipakai jadwal." : undefined}
          >
            <Select
              id="template-unit"
              value={form.unitId}
              onChange={(event) => update("unitId", event.target.value)}
              disabled={manageable.isPending || submitting || unitLocked}
              invalid={!!errorFor("executor_unit_id")}
            >
              <option value="">{manageable.isPending ? "Memuat…" : "Pilih unit pelaksana"}</option>
              {unitOptions.map((unit) => (
                <option key={unit.id} value={String(unit.id)}>
                  {unit.display_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Deskripsi"
            htmlFor="template-description"
            error={errorFor("description")}
            className="sm:col-span-2"
          >
            <Textarea
              id="template-description"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Opsional: untuk alat/keperluan apa template ini dipakai"
              disabled={submitting}
              className="min-h-[60px]"
            />
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors duration-150 hover:bg-surface-2/60 sm:col-span-2">
            <Checkbox
              checked={form.isActive}
              onChange={(event) => update("isActive", event.target.checked)}
              disabled={submitting}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium">Template aktif</span>
              <span className="block text-xs text-muted-foreground">
                Hanya template aktif yang dapat dipilih saat membuat jadwal PM.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Butir checklist ({form.items.length})</CardTitle>
          <CardDescription>
            Urutan butir di sini adalah urutan pengisian oleh teknisi. Butir dengan &quot;Bagian&quot; yang sama
            ditampilkan berkelompok.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ItemsEditor
            rows={form.items}
            onChange={(items) => update("items", items)}
            errorAt={itemError}
            disabled={submitting}
          />
          <FieldError message={errorFor("items")} />
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t bg-background/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0">
        {isEdit && dirty ? (
          <span className="hidden text-xs font-medium text-warning-foreground sm:inline" aria-live="polite">
            Ada perubahan belum disimpan
          </span>
        ) : null}
        <Button asChild variant="outline" className="flex-1 sm:flex-none">
          <Link href="/pm/templates" aria-disabled={submitting}>
            {isEdit ? "Kembali" : "Batal"}
          </Link>
        </Button>
        <Button type="submit" className="flex-[2] sm:flex-none" loading={submitting} disabled={isEdit && !dirty}>
          {isEdit ? "Simpan Perubahan" : "Buat Template"}
        </Button>
      </div>
    </form>
  );
}
