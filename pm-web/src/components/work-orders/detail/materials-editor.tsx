"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { SuggestInput } from "@/components/common/suggest-input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchMaterials } from "@/lib/lookups";
import { queryKeys } from "@/lib/query-keys";
import type { MaterialOption } from "@/types/lookups";
import type { WorkOrderMaterial } from "@/types/work-order";

export interface MaterialRow {
  key: string;
  material_id: number | null;
  material_name: string;
  quantity: string;
  unit: string;
}

export type MaterialField = "material_name" | "quantity" | "unit";

let rowSeq = 0;
/** Stable client-side key for editable rows. */
export const newRowKey = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(rowSeq += 1)}`;

export function materialRowsFrom(materials: WorkOrderMaterial[]): MaterialRow[] {
  return materials.map((material) => ({
    key: newRowKey("m"),
    material_id: material.material_id,
    material_name: material.material_name,
    quantity: String(Number(material.quantity)),
    unit: material.unit ?? "",
  }));
}

export function emptyMaterialRow(): MaterialRow {
  return { key: newRowKey("m"), material_id: null, material_name: "", quantity: "1", unit: "" };
}

/** Client-side validation; returns `index.field -> message`. */
export function validateMaterialRows(rows: MaterialRow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  rows.forEach((row, index) => {
    if (!row.material_name.trim()) errors[`${index}.material_name`] = "Nama material wajib diisi.";
    const qty = Number(row.quantity);
    if (!row.quantity.trim() || !Number.isFinite(qty) || qty <= 0) {
      errors[`${index}.quantity`] = "Jumlah harus lebih dari 0.";
    }
  });
  return errors;
}

interface MaterialsEditorProps {
  rows: MaterialRow[];
  onChange: (rows: MaterialRow[]) => void;
  errorAt: (index: number, field: MaterialField) => string | undefined;
  disabled?: boolean;
}

/** Editable material rows: pick from master (`/materials?q=`) or keep a free-text name. */
export function MaterialsEditor({ rows, onChange, errorAt, disabled }: MaterialsEditorProps) {
  const patch = (key: string, values: Partial<MaterialRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...values } : row)));
  const remove = (key: string) => onChange(rows.filter((row) => row.key !== key));

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          Tidak ada material. Tambahkan bila ada material/sparepart yang dipakai.
        </p>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem_2.5rem] gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Material</span>
            <span>Jumlah</span>
            <span>Satuan</span>
            <span className="sr-only">Aksi</span>
          </div>
          {rows.map((row, index) => (
            <div key={row.key} className="rounded-md border p-3 sm:border-0 sm:p-0">
              <div className="mb-2 flex items-center justify-between sm:hidden">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Material {index + 1}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(row.key)}
                  disabled={disabled}
                  aria-label={`Hapus material ${index + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_2.5rem] sm:items-start">
                <div className="col-span-2 space-y-1 sm:col-span-1">
                  <Label htmlFor={`material-name-${row.key}`} className="sr-only">
                    Nama material {index + 1}
                  </Label>
                  <SuggestInput<MaterialOption>
                    id={`material-name-${row.key}`}
                    value={row.material_name}
                    onValueChange={(value) => patch(row.key, { material_name: value, material_id: null })}
                    onSelect={(material) =>
                      patch(row.key, {
                        material_id: material.id,
                        material_name: material.name,
                        unit: material.unit ?? row.unit,
                      })
                    }
                    queryKey={(q) => queryKeys.materials(q)}
                    fetcher={(q, signal) => searchMaterials(q, signal)}
                    getKey={(item) => item.id}
                    minChars={2}
                    placeholder="Cari atau ketik nama material"
                    emptyText="Tidak ada di master; nama yang diketik tetap dipakai."
                    showSearchIcon={false}
                    disabled={disabled}
                    invalid={!!errorAt(index, "material_name")}
                    renderOption={(item) => (
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {item.code ? <span className="font-mono text-xs">{item.code} &middot; </span> : null}
                          {item.name}
                        </span>
                        {item.unit ? <span className="text-xs text-muted-foreground">{item.unit}</span> : null}
                      </div>
                    )}
                  />
                  {row.material_id ? (
                    <p className="text-[11px] text-muted-foreground">Dari master material</p>
                  ) : null}
                  <FieldError message={errorAt(index, "material_name")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`material-qty-${row.key}`} className="text-xs sm:sr-only">
                    Jumlah
                  </Label>
                  <Input
                    id={`material-qty-${row.key}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={row.quantity}
                    onChange={(event) => patch(row.key, { quantity: event.target.value })}
                    disabled={disabled}
                    invalid={!!errorAt(index, "quantity")}
                  />
                  <FieldError message={errorAt(index, "quantity")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`material-unit-${row.key}`} className="text-xs sm:sr-only">
                    Satuan
                  </Label>
                  <Input
                    id={`material-unit-${row.key}`}
                    value={row.unit}
                    onChange={(event) => patch(row.key, { unit: event.target.value })}
                    placeholder="pcs, m, ltr"
                    maxLength={30}
                    disabled={disabled}
                    invalid={!!errorAt(index, "unit")}
                  />
                  <FieldError message={errorAt(index, "unit")} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden text-muted-foreground hover:text-destructive sm:inline-flex"
                  onClick={() => remove(row.key)}
                  disabled={disabled}
                  aria-label={`Hapus material ${index + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </>
      )}
      <Button variant="outline" size="sm" onClick={() => onChange([...rows, emptyMaterialRow()])} disabled={disabled}>
        <Plus />
        Tambah material
      </Button>
    </div>
  );
}
