"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AsyncCombobox } from "@/components/common/async-combobox";
import { searchEquipment } from "@/lib/lookups";
import { getEquipment } from "@/lib/pm-equipment";
import { queryKeys } from "@/lib/query-keys";
import type { EquipmentOption } from "@/types/lookups";

interface EquipmentFilterProps {
  id?: string;
  /** Selected equipment id (as kept in the URL), "" = none. */
  value: string;
  onChange: (equipmentId: string) => void;
  /** Narrows the search to one executor unit. */
  executorUnitId?: number | null;
  placeholder?: string;
}

/** Equipment combobox whose value is just an id (URL state); the label is looked up when needed. */
export function EquipmentFilter({
  id,
  value,
  onChange,
  executorUnitId = null,
  placeholder = "Semua equipment",
}: EquipmentFilterProps) {
  const [picked, setPicked] = React.useState<EquipmentOption | null>(null);
  const numericId = /^\d+$/.test(value) ? Number(value) : null;
  const known = picked && picked.id === numericId ? picked : null;

  // After a reload only the id is known: fetch the equipment once to show its name.
  const detail = useQuery({
    queryKey: queryKeys.equipmentDetail(numericId ?? 0),
    queryFn: ({ signal }) => getEquipment(numericId as number, signal),
    enabled: numericId !== null && !known,
    staleTime: 5 * 60 * 1000,
  });

  const selected: EquipmentOption | null =
    numericId === null
      ? null
      : known ??
        (detail.data
          ? { id: detail.data.id, code: detail.data.code, name: detail.data.name, location: detail.data.location }
          : { id: numericId, code: null, name: detail.isPending ? "Memuat…" : `Equipment #${numericId}`, location: null });

  return (
    <AsyncCombobox<EquipmentOption>
      id={id}
      selected={selected}
      onChange={(equipment) => {
        setPicked(equipment);
        onChange(equipment ? String(equipment.id) : "");
      }}
      queryKey={(q) => queryKeys.equipment(q, executorUnitId)}
      fetcher={(q, signal) => searchEquipment(q, executorUnitId, signal)}
      getKey={(item) => item.id}
      minChars={0}
      placeholder={placeholder}
      emptyText="Equipment tidak ditemukan."
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
    />
  );
}
