"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useExecutorStaff } from "@/hooks/use-lookups";
import { useChecklistTemplates } from "@/hooks/use-pm";
import { ApiError, errorMessage } from "@/lib/api";
import { fromDateTimeLocalValue, minutesBetweenLocal, nowDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/format";
import { FREQUENCY_OPTIONS, frequencyOption } from "@/lib/pm-constants";
import { createPmSchedule, updatePmSchedule } from "@/lib/pm-schedules";
import { queryKeys } from "@/lib/query-keys";
import { firstError } from "@/lib/validation";
import type { ValidationErrors } from "@/types/api";
import type { FrequencyType, PmScheduleDetail, PmSchedulePayload, PmSchedulePreviewPayload } from "@/types/pm";
import { useManageableUnits } from "../use-pm-units";
import { EquipmentMultiSelect, type EquipmentRef } from "./equipment-multi-select";
import { SchedulePreview } from "./schedule-preview";

type DurationUnit = "hours" | "days";

const UNIT_OPTIONS = [
  { value: "hours" as const, label: "Jam" },
  { value: "days" as const, label: "Hari" },
];

interface FormState {
  name: string;
  unitId: string;
  templateId: string;
  equipment: EquipmentRef[];
  frequencyType: FrequencyType;
  interval: string;
  startAt: string;
  endAt: string;
  toleranceValue: string;
  toleranceUnit: DurationUnit;
  windowValue: string;
  windowUnit: DurationUnit;
  estimatedMinutes: string;
  picId: string;
  isActive: boolean;
}

type FieldKey = keyof PmSchedulePayload;

/** Hours -> value + unit, preferring whole days. */
function splitHours(hours: number | null | undefined): { value: string; unit: DurationUnit } {
  if (hours === null || hours === undefined) return { value: "", unit: "days" };
  if (hours >= 24 && hours % 24 === 0) return { value: String(hours / 24), unit: "days" };
  return { value: String(hours), unit: "hours" };
}

function toHours(value: string, unit: DurationUnit): number {
  return Math.round(Number(value) * (unit === "days" ? 24 : 1));
}

/** Tomorrow 08:00 (Asia/Jakarta) as a sensible first occurrence. */
function defaultStart(): string {
  const [date] = nowDateTimeLocalValue().split("T");
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return `${next.toISOString().slice(0, 10)}T08:00`;
}

function initialState(schedule: PmScheduleDetail | undefined, onlyUnitId: number | null): FormState {
  if (!schedule) {
    return {
      name: "",
      unitId: onlyUnitId !== null ? String(onlyUnitId) : "",
      templateId: "",
      equipment: [],
      frequencyType: "monthly",
      interval: "1",
      startAt: defaultStart(),
      endAt: "",
      toleranceValue: "3",
      toleranceUnit: "days",
      windowValue: "",
      windowUnit: "days",
      estimatedMinutes: "",
      picId: "",
      isActive: true,
    };
  }
  const tolerance = splitHours(schedule.tolerance_hours);
  const dueWindow = splitHours(schedule.due_window_hours);
  return {
    name: schedule.name,
    unitId: String(schedule.executor_unit.id),
    templateId: String(schedule.checklist_template.id),
    equipment: schedule.equipment.map((item) => ({ id: item.id, code: item.code, name: item.name })),
    frequencyType: schedule.frequency_type,
    interval: String(schedule.frequency_interval ?? 1),
    startAt: toDateTimeLocalValue(schedule.start_at),
    endAt: toDateTimeLocalValue(schedule.end_at),
    toleranceValue: tolerance.value,
    toleranceUnit: tolerance.unit,
    windowValue: dueWindow.value,
    windowUnit: dueWindow.unit,
    estimatedMinutes: schedule.estimated_minutes ? String(schedule.estimated_minutes) : "",
    picId: schedule.pic ? String(schedule.pic.id) : "",
    isActive: schedule.is_active,
  };
}

export function ScheduleForm({ schedule }: { schedule?: PmScheduleDetail }) {
  const isEdit = !!schedule;
  const router = useRouter();
  const queryClient = useQueryClient();
  const manageable = useManageableUnits();

  const [form, setForm] = React.useState<FormState>(() =>
    initialState(schedule, manageable.units.length === 1 ? manageable.units[0].id : null),
  );
  const [clientErrors, setClientErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [serverErrors, setServerErrors] = React.useState<ValidationErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const unitId = form.unitId ? Number(form.unitId) : null;
  const frequency = frequencyOption(form.frequencyType);
  const intervalNumber = form.frequencyType === "daily" ? 1 : Number(form.interval);
  const intervalValid =
    Number.isInteger(intervalNumber) && intervalNumber >= frequency.min && intervalNumber <= frequency.max;

  // The schedule's own unit must stay selectable while editing.
  const unitOptions = React.useMemo(() => {
    const list = [...manageable.units];
    if (schedule && !list.some((unit) => unit.id === schedule.executor_unit.id)) list.unshift(schedule.executor_unit);
    return list;
  }, [manageable.units, schedule]);

  const templates = useChecklistTemplates({ executor_unit_id: form.unitId, active: "1" }, !!form.unitId);
  const templateOptions = React.useMemo(() => {
    const list = (templates.data ?? []).map((template) => ({ id: template.id, name: template.name }));
    // An inactive template that is already in use is not in the "active" list.
    if (
      schedule &&
      String(schedule.executor_unit.id) === form.unitId &&
      !list.some((template) => template.id === schedule.checklist_template.id)
    ) {
      list.unshift(schedule.checklist_template);
    }
    return list;
  }, [form.unitId, schedule, templates.data]);

  const staff = useExecutorStaff(unitId);
  const picMissing =
    schedule?.pic &&
    String(schedule.executor_unit.id) === form.unitId &&
    staff.data &&
    !staff.data.some((person) => person.id === schedule.pic?.id);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const errorFor = (key: FieldKey, ...more: string[]) => clientErrors[key] ?? firstError(serverErrors, key, ...more);

  const startIso = fromDateTimeLocalValue(form.startAt);
  const endIso = form.endAt ? fromDateTimeLocalValue(form.endAt) : null;
  const previewPayload: PmSchedulePreviewPayload | null =
    startIso && intervalValid
      ? {
          frequency_type: form.frequencyType,
          frequency_interval: intervalNumber,
          start_at: startIso,
          ...(endIso ? { end_at: endIso } : {}),
          count: 8,
        }
      : null;

  const validate = (): boolean => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!form.name.trim()) errors.name = "Nama jadwal wajib diisi.";
    if (!form.unitId) errors.executor_unit_id = "Pilih unit pelaksana.";
    if (!form.templateId) errors.checklist_template_id = "Pilih template checklist.";
    if (form.equipment.length === 0) errors.equipment_ids = "Pilih minimal satu equipment.";
    if (!intervalValid) errors.frequency_interval = `Isi angka ${frequency.min} sampai ${frequency.max}.`;
    if (!startIso) errors.start_at = "Tanggal & jam mulai wajib diisi.";
    if (form.endAt) {
      const minutes = minutesBetweenLocal(form.startAt, form.endAt);
      if (!endIso || minutes === null || minutes <= 0) errors.end_at = "Tanggal berakhir harus setelah tanggal mulai.";
    }
    const tolerance = Number(form.toleranceValue);
    if (!form.toleranceValue.trim() || !Number.isFinite(tolerance) || tolerance < 0) {
      errors.tolerance_hours = "Isi toleransi (angka 0 atau lebih).";
    }
    if (form.windowValue.trim()) {
      const dueWindow = Number(form.windowValue);
      if (!Number.isFinite(dueWindow) || dueWindow <= 0) errors.due_window_hours = "Isi angka lebih dari 0, atau kosongkan.";
    }
    if (form.estimatedMinutes.trim()) {
      const estimate = Number(form.estimatedMinutes);
      if (!Number.isInteger(estimate) || estimate < 1) errors.estimated_minutes = "Isi menit (bilangan bulat), atau kosongkan.";
    }
    if (!form.picId) errors.pic_user_id = "Pilih PIC.";
    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildPayload = (): PmSchedulePayload => ({
    name: form.name.trim(),
    executor_unit_id: Number(form.unitId),
    checklist_template_id: Number(form.templateId),
    equipment_ids: form.equipment.map((item) => item.id),
    frequency_type: form.frequencyType,
    frequency_interval: intervalNumber,
    start_at: startIso as string,
    end_at: endIso,
    tolerance_hours: toHours(form.toleranceValue, form.toleranceUnit),
    due_window_hours: form.windowValue.trim() ? toHours(form.windowValue, form.windowUnit) : null,
    estimated_minutes: form.estimatedMinutes.trim() ? Number(form.estimatedMinutes) : null,
    pic_user_id: Number(form.picId),
    is_active: form.isActive,
  });

  const mutation = useMutation({
    mutationFn: (payload: PmSchedulePayload) =>
      schedule ? updatePmSchedule(schedule.id, payload) : createPmSchedule(payload),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.pmSchedule(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.pmScheduleLists });
      // Tasks were (re)generated.
      void queryClient.invalidateQueries({ queryKey: queryKeys.pmTasks });
      toast.success(isEdit ? "Jadwal PM diperbarui. Tugas TERJADWAL digenerate ulang." : "Jadwal PM dibuat. Tugas digenerate.");
      router.push(`/pm/schedules/${detail.id}`);
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
    mutation.mutate(buildPayload());
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
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Menyimpan perubahan akan <strong>menghapus dan men-generate ulang tugas yang masih TERJADWAL</strong>. Tugas
            yang sudah jatuh tempo, sedang dikerjakan, selesai, atau dilewati tidak berubah.
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Jadwal</CardTitle>
          <CardDescription>Apa yang dirawat, oleh unit mana, dan dengan checklist apa.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama jadwal" htmlFor="schedule-name" required error={errorFor("name")} className="sm:col-span-2">
            <Input
              id="schedule-name"
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
            htmlFor="schedule-unit"
            required
            error={errorFor("executor_unit_id")}
            hint={unitOptions.length === 0 && !manageable.isPending ? "Anda bukan pimpinan unit pelaksana mana pun." : undefined}
          >
            <Select
              id="schedule-unit"
              value={form.unitId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  unitId: event.target.value,
                  templateId: "",
                  equipment: [],
                  picId: "",
                }))
              }
              disabled={manageable.isPending || submitting}
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
            label="Template checklist"
            htmlFor="schedule-template"
            required
            error={errorFor("checklist_template_id")}
            hint={
              form.unitId && templates.isSuccess && templateOptions.length === 0 ? (
                <>
                  Belum ada template aktif untuk unit ini.{" "}
                  <Link
                    href="/pm/templates/new"
                    className="rounded-sm font-medium text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Buat template
                  </Link>
                </>
              ) : undefined
            }
          >
            <Select
              id="schedule-template"
              value={form.templateId}
              onChange={(event) => update("templateId", event.target.value)}
              disabled={!form.unitId || templates.isPending || submitting}
              invalid={!!errorFor("checklist_template_id")}
            >
              <option value="">
                {!form.unitId ? "Pilih unit pelaksana dulu" : templates.isPending ? "Memuat…" : "Pilih template"}
              </option>
              {templateOptions.map((template) => (
                <option key={template.id} value={String(template.id)}>
                  {template.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Equipment"
            htmlFor="schedule-equipment"
            required
            error={errorFor("equipment_ids", "equipment_ids.*")}
            className="sm:col-span-2"
          >
            <EquipmentMultiSelect
              id="schedule-equipment"
              value={form.equipment}
              onChange={(equipment) => update("equipment", equipment)}
              executorUnitId={unitId}
              disabled={submitting}
              invalid={!!errorFor("equipment_ids", "equipment_ids.*")}
            />
          </Field>

          <Field
            label="PIC (penanggung jawab)"
            htmlFor="schedule-pic"
            required
            error={errorFor("pic_user_id")}
            hint={staff.isError ? errorMessage(staff.error) : "Staf unit pelaksana yang menerima tugas & notifikasi."}
          >
            <Select
              id="schedule-pic"
              value={form.picId}
              onChange={(event) => update("picId", event.target.value)}
              disabled={!form.unitId || staff.isPending || submitting}
              invalid={!!errorFor("pic_user_id")}
            >
              <option value="">
                {!form.unitId ? "Pilih unit pelaksana dulu" : staff.isPending ? "Memuat staf…" : "Pilih PIC"}
              </option>
              {picMissing && schedule?.pic ? <option value={String(schedule.pic.id)}>{schedule.pic.name}</option> : null}
              {staff.data?.filter((person) => person.assignable).map((person) => (
                <option key={person.id} value={String(person.id)}>
                  {person.name}
                  {person.grade_code ? ` (${person.grade_code})` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Estimasi durasi (menit)"
            htmlFor="schedule-estimate"
            error={errorFor("estimated_minutes")}
            hint="Opsional."
          >
            <Input
              id="schedule-estimate"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={form.estimatedMinutes}
              onChange={(event) => update("estimatedMinutes", event.target.value)}
              placeholder="60"
              disabled={submitting}
              invalid={!!errorFor("estimated_minutes")}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frekuensi &amp; waktu</CardTitle>
          <CardDescription>Waktu dalam WIB. Tugas digenerate otomatis sampai 60 hari ke depan (7 hari untuk per jam).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Frekuensi" htmlFor="schedule-frequency" required error={errorFor("frequency_type")}>
            <Select
              id="schedule-frequency"
              value={form.frequencyType}
              onChange={(event) => {
                const next = frequencyOption(event.target.value as FrequencyType);
                setForm((current) => ({
                  ...current,
                  frequencyType: next.value,
                  // Keep the interval when it still fits, otherwise start at the minimum.
                  interval:
                    Number(current.interval) >= next.min && Number(current.interval) <= next.max
                      ? current.interval
                      : String(next.min),
                }));
              }}
              disabled={submitting}
              invalid={!!errorFor("frequency_type")}
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          {frequency.unit ? (
            <Field
              label={`Setiap berapa ${frequency.unit}`}
              htmlFor="schedule-interval"
              required
              error={errorFor("frequency_interval")}
              hint={`Rentang ${frequency.min} sampai ${frequency.max} ${frequency.unit}.`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Setiap</span>
                <Input
                  id="schedule-interval"
                  type="number"
                  inputMode="numeric"
                  min={frequency.min}
                  max={frequency.max}
                  step={1}
                  value={form.interval}
                  onChange={(event) => update("interval", event.target.value)}
                  disabled={submitting}
                  invalid={!!errorFor("frequency_interval")}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">{frequency.unit}</span>
              </div>
            </Field>
          ) : (
            <div className="hidden sm:block" aria-hidden />
          )}

          <Field
            label="Mulai (kejadian pertama)"
            htmlFor="schedule-start"
            required
            error={errorFor("start_at")}
            hint="Tanggal + jam jatuh tempo tugas pertama."
          >
            <Input
              id="schedule-start"
              type="datetime-local"
              value={form.startAt}
              onChange={(event) => update("startAt", event.target.value)}
              disabled={submitting}
              invalid={!!errorFor("start_at")}
            />
          </Field>

          <Field label="Berakhir" htmlFor="schedule-end" error={errorFor("end_at")} hint="Opsional. Kosongkan bila tanpa batas.">
            <Input
              id="schedule-end"
              type="datetime-local"
              value={form.endAt}
              min={form.startAt || undefined}
              onChange={(event) => update("endAt", event.target.value)}
              disabled={submitting}
              invalid={!!errorFor("end_at")}
            />
          </Field>

          <Field
            label="Toleransi keterlambatan"
            htmlFor="schedule-tolerance"
            required
            error={errorFor("tolerance_hours")}
            hint="Setelah jatuh tempo + toleransi, tugas menjadi TERLAMBAT."
          >
            <div className="flex items-center gap-2">
              <Input
                id="schedule-tolerance"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.toleranceValue}
                onChange={(event) => update("toleranceValue", event.target.value)}
                disabled={submitting}
                invalid={!!errorFor("tolerance_hours")}
                className="w-24"
              />
              <Segmented
                name="tolerance-unit"
                aria-label="Satuan toleransi"
                value={form.toleranceUnit}
                options={UNIT_OPTIONS}
                onChange={(value) => update("toleranceUnit", value)}
                disabled={submitting}
              />
            </div>
          </Field>

          <Field
            label="Jendela jatuh tempo"
            htmlFor="schedule-window"
            error={errorFor("due_window_hours")}
            hint="Opsional. Berapa lama sebelum jatuh tempo tugas boleh mulai dikerjakan. Default H-2 (48 jam)."
          >
            <div className="flex items-center gap-2">
              <Input
                id="schedule-window"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.windowValue}
                onChange={(event) => update("windowValue", event.target.value)}
                placeholder="2"
                disabled={submitting}
                invalid={!!errorFor("due_window_hours")}
                className="w-24"
              />
              <Segmented
                name="window-unit"
                aria-label="Satuan jendela jatuh tempo"
                value={form.windowUnit}
                options={UNIT_OPTIONS}
                onChange={(value) => update("windowUnit", value)}
                disabled={submitting}
              />
            </div>
          </Field>

          <div className="sm:col-span-2">
            <SchedulePreview payload={previewPayload} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors duration-150 hover:bg-surface-2/60 sm:col-span-2">
            <Checkbox
              checked={form.isActive}
              onChange={(event) => update("isActive", event.target.checked)}
              disabled={submitting}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium">Jadwal aktif</span>
              <span className="block text-xs text-muted-foreground">
                Jadwal nonaktif tidak men-generate tugas baru.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t bg-background/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0">
        <Button asChild variant="outline" className="flex-1 sm:flex-none">
          <Link href={schedule ? `/pm/schedules/${schedule.id}` : "/pm/schedules"} aria-disabled={submitting}>
            Batal
          </Link>
        </Button>
        <Button type="submit" className="flex-[2] sm:flex-none" loading={submitting}>
          {isEdit ? "Simpan Perubahan" : "Buat Jadwal"}
        </Button>
      </div>
    </form>
  );
}
