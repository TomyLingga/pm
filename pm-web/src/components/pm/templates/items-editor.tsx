"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { newRowKey } from "@/components/work-orders/detail/materials-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INPUT_TYPE_OPTIONS } from "@/lib/pm-constants";
import type { ChecklistInputType, ChecklistItemDef, ChecklistItemInput } from "@/types/pm";

export interface ItemRow {
  key: string;
  /** Existing item id (kept so the server updates instead of recreating). */
  id?: number;
  section: string;
  description: string;
  inputType: ChecklistInputType;
  unit: string;
  min: string;
  max: string;
  isRequired: boolean;
  photoRequired: boolean;
}

export type ItemField = "section" | "description" | "input_type" | "unit" | "min_value" | "max_value";

const numberText = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? "" : String(Number(value));

export function itemRowsFrom(items: ChecklistItemDef[]): ItemRow[] {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      key: newRowKey("i"),
      id: item.id,
      section: item.section ?? "",
      description: item.description,
      inputType: item.input_type,
      unit: item.unit ?? "",
      min: numberText(item.min_value),
      max: numberText(item.max_value),
      isRequired: item.is_required,
      photoRequired: item.photo_required,
    }));
}

export function emptyItemRow(section = ""): ItemRow {
  return {
    key: newRowKey("i"),
    section,
    description: "",
    inputType: "ok_nok_na",
    unit: "",
    min: "",
    max: "",
    isRequired: true,
    photoRequired: false,
  };
}

const parseLimit = (raw: string): number | null | undefined => {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
};

/** Client-side validation; returns `index.field -> message`. */
export function validateItemRows(rows: ItemRow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  rows.forEach((row, index) => {
    if (!row.description.trim()) errors[`${index}.description`] = "Uraian butir wajib diisi.";
    if (row.inputType === "number") {
      const min = parseLimit(row.min);
      const max = parseLimit(row.max);
      if (min === undefined) errors[`${index}.min_value`] = "Angka tidak valid.";
      if (max === undefined) errors[`${index}.max_value`] = "Angka tidak valid.";
      if (typeof min === "number" && typeof max === "number" && min > max) {
        errors[`${index}.max_value`] = "Maks. harus lebih besar atau sama dengan min.";
      }
    }
  });
  return errors;
}

/** Rows -> `items` payload (array order = checklist order). */
export function toItemInputs(rows: ItemRow[]): ChecklistItemInput[] {
  return rows.map((row) => {
    const isNumber = row.inputType === "number";
    return {
      ...(row.id ? { id: row.id } : {}),
      section: row.section.trim() || null,
      description: row.description.trim(),
      input_type: row.inputType,
      unit: isNumber ? row.unit.trim() || null : null,
      min_value: isNumber ? parseLimit(row.min) ?? null : null,
      max_value: isNumber ? parseLimit(row.max) ?? null : null,
      is_required: row.isRequired,
      photo_required: row.photoRequired,
    };
  });
}

interface ItemsEditorProps {
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  errorAt: (index: number, field: ItemField) => string | undefined;
  disabled?: boolean;
}

const checkboxRowClassName =
  "flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm transition-colors duration-150 hover:bg-surface-2/60";

/** Checklist item rows: add / remove / move up / move down. */
export function ItemsEditor({ rows, onChange, errorAt, disabled }: ItemsEditorProps) {
  const listId = React.useId();
  const sections = Array.from(new Set(rows.map((row) => row.section.trim()).filter(Boolean)));

  const patch = (key: string, values: Partial<ItemRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...values } : row)));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <datalist id={listId}>
        {sections.map((section) => (
          <option key={section} value={section} />
        ))}
      </datalist>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed bg-surface-2/40 px-3 py-6 text-center text-sm text-muted-foreground">
          Belum ada butir. Template membutuhkan minimal satu butir checklist.
        </p>
      ) : (
        <ol className="divide-y overflow-hidden rounded-md border">
          {rows.map((row, index) => (
            <li key={row.key} className="bg-card p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-2 px-1 text-[11px]">
                    {index + 1}
                  </span>
                  Butir {index + 1}
                  {row.id ? null : <span className="font-medium normal-case tracking-normal text-primary">(baru)</span>}
                </span>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(index, -1)}
                    disabled={disabled || index === 0}
                    aria-label={`Naikkan butir ${index + 1}`}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(index, 1)}
                    disabled={disabled || index === rows.length - 1}
                    aria-label={`Turunkan butir ${index + 1}`}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:bg-danger-soft hover:text-danger-foreground"
                    onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
                    disabled={disabled}
                    aria-label={`Hapus butir ${index + 1}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
                <Field
                  label="Uraian pemeriksaan"
                  htmlFor={`item-description-${row.key}`}
                  required
                  error={errorAt(index, "description")}
                  className="sm:col-span-2"
                >
                  <Textarea
                    id={`item-description-${row.key}`}
                    value={row.description}
                    onChange={(event) => patch(row.key, { description: event.target.value })}
                    placeholder="Contoh: Cek tegangan panel"
                    rows={2}
                    maxLength={500}
                    disabled={disabled}
                    invalid={!!errorAt(index, "description")}
                    className="min-h-[60px]"
                  />
                </Field>

                <Field
                  label="Bagian / kelompok"
                  htmlFor={`item-section-${row.key}`}
                  error={errorAt(index, "section")}
                  hint="Opsional. Butir dengan bagian yang sama ditampilkan berkelompok."
                >
                  <Input
                    id={`item-section-${row.key}`}
                    list={listId}
                    value={row.section}
                    onChange={(event) => patch(row.key, { section: event.target.value })}
                    placeholder="Contoh: Kelistrikan"
                    maxLength={100}
                    autoComplete="off"
                    disabled={disabled}
                    invalid={!!errorAt(index, "section")}
                  />
                </Field>

                <Field
                  label="Jenis isian"
                  htmlFor={`item-type-${row.key}`}
                  required
                  error={errorAt(index, "input_type")}
                >
                  <Select
                    id={`item-type-${row.key}`}
                    value={row.inputType}
                    onChange={(event) => patch(row.key, { inputType: event.target.value as ChecklistInputType })}
                    disabled={disabled}
                    invalid={!!errorAt(index, "input_type")}
                  >
                    {INPUT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                {row.inputType === "number" ? (
                  <div className="grid grid-cols-3 gap-2 rounded-md border border-dashed bg-surface-2/40 p-3 sm:col-span-2">
                    <Field label="Satuan" htmlFor={`item-unit-${row.key}`} error={errorAt(index, "unit")}>
                      <Input
                        id={`item-unit-${row.key}`}
                        value={row.unit}
                        onChange={(event) => patch(row.key, { unit: event.target.value })}
                        placeholder="V, bar, °C"
                        maxLength={20}
                        autoComplete="off"
                        disabled={disabled}
                        invalid={!!errorAt(index, "unit")}
                      />
                    </Field>
                    <Field label="Min." htmlFor={`item-min-${row.key}`} error={errorAt(index, "min_value")}>
                      <Input
                        id={`item-min-${row.key}`}
                        type="text"
                        inputMode="decimal"
                        value={row.min}
                        onChange={(event) => patch(row.key, { min: event.target.value })}
                        placeholder="370"
                        autoComplete="off"
                        disabled={disabled}
                        invalid={!!errorAt(index, "min_value")}
                        className="tabular"
                      />
                    </Field>
                    <Field label="Maks." htmlFor={`item-max-${row.key}`} error={errorAt(index, "max_value")}>
                      <Input
                        id={`item-max-${row.key}`}
                        type="text"
                        inputMode="decimal"
                        value={row.max}
                        onChange={(event) => patch(row.key, { max: event.target.value })}
                        placeholder="400"
                        autoComplete="off"
                        disabled={disabled}
                        invalid={!!errorAt(index, "max_value")}
                        className="tabular"
                      />
                    </Field>
                    <p className="col-span-3 text-xs text-muted-foreground">
                      Nilai di dalam rentang dinilai OK, di luar rentang Tidak OK. Kosongkan batas bila tidak ada.
                    </p>
                  </div>
                ) : null}

                <div className="-mx-2 flex flex-wrap gap-x-4 gap-y-1 sm:col-span-2">
                  <label className={checkboxRowClassName}>
                    <Checkbox
                      checked={row.isRequired}
                      onChange={(event) => patch(row.key, { isRequired: event.target.checked })}
                      disabled={disabled}
                    />
                    Wajib diisi
                  </label>
                  <label className={checkboxRowClassName}>
                    <Checkbox
                      checked={row.photoRequired}
                      onChange={(event) => patch(row.key, { photoRequired: event.target.checked })}
                      disabled={disabled}
                    />
                    Foto wajib
                  </label>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Button
        variant="outline"
        onClick={() => onChange([...rows, emptyItemRow(rows[rows.length - 1]?.section ?? "")])}
        disabled={disabled}
      >
        <Plus />
        Tambah butir
      </Button>
    </div>
  );
}
