"use client";

import * as React from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  formatMinutes,
  fromDateTimeLocalValue,
  minutesBetweenLocal,
  nowDateTimeLocalValue,
  toDateTimeLocalValue,
} from "@/lib/format";
import type { ExecutorStaff } from "@/types/lookups";
import type { LabourInput, WorkOrderDetail } from "@/types/work-order";
import { newRowKey } from "./materials-editor";

export interface LabourRow {
  key: string;
  user_id: number | null;
  /** Free-text worker (not in the staff list). */
  manual: boolean;
  worker_name: string;
  /** `datetime-local` values in Asia/Jakarta */
  started_at: string;
  finished_at: string;
}

export type LabourField = "worker_name" | "started_at" | "finished_at";

const MANUAL = "__manual";

/** Existing labours, or one row per assignee (start = picked_at) as a starting point. */
export function labourRowsFrom(wo: WorkOrderDetail): LabourRow[] {
  if (wo.labours.length) {
    return wo.labours.map((labour) => ({
      key: newRowKey("l"),
      user_id: labour.user_id,
      manual: !labour.user_id,
      worker_name: labour.worker_name,
      started_at: toDateTimeLocalValue(labour.started_at),
      finished_at: toDateTimeLocalValue(labour.finished_at),
    }));
  }
  return wo.assignees.map((assignee) => ({
    key: newRowKey("l"),
    user_id: assignee.id,
    manual: false,
    worker_name: assignee.name,
    started_at: toDateTimeLocalValue(wo.picked_at),
    finished_at: "",
  }));
}

function emptyLabourRow(): LabourRow {
  return { key: newRowKey("l"), user_id: null, manual: false, worker_name: "", started_at: "", finished_at: "" };
}

export function validateLabourRows(rows: LabourRow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  rows.forEach((row, index) => {
    if (!row.worker_name.trim()) errors[`${index}.worker_name`] = "Pilih atau ketik nama pekerja.";
    if (!row.started_at) errors[`${index}.started_at`] = "Jam mulai wajib diisi.";
    if (!row.finished_at) errors[`${index}.finished_at`] = "Jam selesai wajib diisi.";
    const minutes = minutesBetweenLocal(row.started_at, row.finished_at);
    if (minutes !== null && minutes <= 0) errors[`${index}.finished_at`] = "Jam selesai harus setelah jam mulai.";
  });
  return errors;
}

export function toLabourInputs(rows: LabourRow[]): LabourInput[] {
  return rows.map((row) => ({
    user_id: row.manual ? null : row.user_id,
    worker_name: row.worker_name.trim(),
    started_at: fromDateTimeLocalValue(row.started_at) ?? row.started_at,
    finished_at: fromDateTimeLocalValue(row.finished_at) ?? row.finished_at,
  }));
}

export function totalLabourMinutes(rows: LabourRow[]): number {
  return rows.reduce((sum, row) => {
    const minutes = minutesBetweenLocal(row.started_at, row.finished_at);
    return minutes && minutes > 0 ? sum + minutes : sum;
  }, 0);
}

interface LaboursEditorProps {
  rows: LabourRow[];
  onChange: (rows: LabourRow[]) => void;
  staff: ExecutorStaff[];
  staffLoading?: boolean;
  errorAt: (index: number, field: LabourField) => string | undefined;
  disabled?: boolean;
}

/** Worker rows: staff select or free-text name, start/finish (`datetime-local`) and live duration. */
export function LaboursEditor({ rows, onChange, staff, staffLoading, errorAt, disabled }: LaboursEditorProps) {
  const patch = (key: string, values: Partial<LabourRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...values } : row)));

  const onWorkerChange = (row: LabourRow, value: string) => {
    if (value === MANUAL) {
      patch(row.key, { manual: true, user_id: null, worker_name: "" });
      return;
    }
    const person = staff.find((item) => String(item.id) === value);
    patch(row.key, {
      manual: false,
      user_id: person ? person.id : value ? Number(value) : null,
      worker_name: person?.name ?? (value ? row.worker_name : ""),
    });
  };

  const total = totalLabourMinutes(rows);

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          Belum ada pekerja. Tambahkan minimal satu pekerja.
        </p>
      ) : (
        rows.map((row, index) => {
          const minutes = minutesBetweenLocal(row.started_at, row.finished_at);
          const selectValue = row.manual ? MANUAL : row.user_id ? String(row.user_id) : "";
          const knownStaff = row.user_id !== null && staff.some((item) => item.id === row.user_id);
          return (
            <div key={row.key} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Pekerja {index + 1}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium">
                    <Clock className="h-3 w-3" aria-hidden />
                    <span className="sr-only">Durasi </span>
                    {minutes !== null && minutes > 0 ? formatMinutes(minutes) : "-"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-my-1 h-9 w-9 text-muted-foreground hover:bg-danger-soft hover:text-danger-foreground"
                    onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
                    disabled={disabled}
                    aria-label={`Hapus pekerja ${index + 1}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`worker-${row.key}`} className="text-xs">
                    Nama pekerja
                  </Label>
                  <Select
                    id={`worker-${row.key}`}
                    value={selectValue}
                    onChange={(event) => onWorkerChange(row, event.target.value)}
                    disabled={disabled}
                    invalid={!!errorAt(index, "worker_name") && !row.manual}
                  >
                    <option value="">{staffLoading ? "Memuat staf…" : "Pilih pekerja"}</option>
                    {row.user_id !== null && !row.manual && !knownStaff ? (
                      <option value={String(row.user_id)}>{row.worker_name}</option>
                    ) : null}
                    {staff.map((person) => (
                      <option key={person.id} value={String(person.id)}>
                        {person.name}
                      </option>
                    ))}
                    <option value={MANUAL}>Lainnya (ketik nama)</option>
                  </Select>
                  {row.manual ? (
                    <Input
                      aria-label={`Nama pekerja ${index + 1}`}
                      value={row.worker_name}
                      onChange={(event) => patch(row.key, { worker_name: event.target.value })}
                      placeholder="Contoh: Budi (vendor)"
                      maxLength={150}
                      autoComplete="off"
                      disabled={disabled}
                      invalid={!!errorAt(index, "worker_name")}
                      autoFocus
                    />
                  ) : null}
                  <FieldError message={errorAt(index, "worker_name")} />
                </div>

                {(["started_at", "finished_at"] as const).map((field) => (
                  <div key={field} className="space-y-1.5">
                    <div className="flex h-5 items-center justify-between">
                      <Label htmlFor={`${field}-${row.key}`} className="text-xs">
                        {field === "started_at" ? "Mulai" : "Selesai"}
                      </Label>
                      <Button
                        variant="link"
                        size="xs"
                        className="h-7 px-1.5"
                        onClick={() => patch(row.key, { [field]: nowDateTimeLocalValue() })}
                        disabled={disabled}
                        aria-label={`Isi jam ${field === "started_at" ? "mulai" : "selesai"} pekerja ${index + 1} dengan waktu sekarang`}
                      >
                        Sekarang
                      </Button>
                    </div>
                    <Input
                      id={`${field}-${row.key}`}
                      type="datetime-local"
                      className="tabular"
                      value={row[field]}
                      onChange={(event) => patch(row.key, { [field]: event.target.value })}
                      disabled={disabled}
                      invalid={!!errorAt(index, field)}
                    />
                    <FieldError message={errorAt(index, field)} />
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => onChange([...rows, emptyLabourRow()])} disabled={disabled}>
          <Plus />
          Tambah pekerja
        </Button>
        {rows.length > 0 ? (
          <p className="text-sm" aria-live="polite">
            Total durasi: <span className="tabular font-semibold">{formatMinutes(total)}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
