"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { SuggestInput } from "@/components/common/suggest-input";
import { searchEquipment } from "@/lib/lookups";
import { queryKeys } from "@/lib/query-keys";
import type { EquipmentOption } from "@/types/lookups";

export interface EquipmentRef {
  id: number;
  code: string | null;
  name: string;
}

interface EquipmentMultiSelectProps {
  id?: string;
  value: EquipmentRef[];
  onChange: (value: EquipmentRef[]) => void;
  /** Search is limited to this executor unit; null disables the field. */
  executorUnitId: number | null;
  disabled?: boolean;
  invalid?: boolean;
}

/** Search-and-add equipment picker; the selection is shown as removable chips. */
export function EquipmentMultiSelect({
  id,
  value,
  onChange,
  executorUnitId,
  disabled,
  invalid,
}: EquipmentMultiSelectProps) {
  const [text, setText] = React.useState("");
  const selectedIds = new Set(value.map((item) => item.id));

  return (
    <div className="space-y-2">
      <SuggestInput<EquipmentOption>
        id={id}
        value={text}
        onValueChange={setText}
        onSelect={(item) => {
          if (!selectedIds.has(item.id)) onChange([...value, { id: item.id, code: item.code, name: item.name }]);
          setText("");
        }}
        queryKey={(q) => queryKeys.equipment(q, executorUnitId)}
        fetcher={(q, signal) => searchEquipment(q, executorUnitId, signal)}
        getKey={(item) => item.id}
        minChars={0}
        placeholder={executorUnitId === null ? "Pilih unit pelaksana dulu" : "Cari kode atau nama equipment…"}
        emptyText="Equipment tidak ditemukan untuk unit ini."
        disabled={disabled || executorUnitId === null}
        invalid={invalid}
        renderOption={(item) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {item.code ? <span className="font-mono text-xs">{item.code} &middot; </span> : null}
                {item.name}
              </p>
              {item.location ? <p className="truncate text-xs text-muted-foreground">{item.location.name}</p> : null}
            </div>
            {selectedIds.has(item.id) ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Dipilih
              </span>
            ) : null}
          </div>
        )}
      />

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Equipment terpilih">
          {value.map((item) => (
            <li
              key={item.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary-soft py-1 pl-2.5 pr-1 text-xs font-medium text-primary-soft-foreground"
            >
              <span className="truncate">
                {item.code ? <span className="font-mono">{item.code} &middot; </span> : null}
                {item.name}
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}
                disabled={disabled}
                className="shrink-0 rounded-full p-0.5 text-primary-soft-foreground/70 transition-colors duration-150 hover:bg-primary/15 hover:text-primary-soft-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                aria-label={`Hapus ${item.name}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Belum ada equipment dipilih. Satu tugas dibuat per equipment.</p>
      )}
    </div>
  );
}
