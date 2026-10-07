"use client";

import * as React from "react";
import { AsyncCombobox } from "@/components/common/async-combobox";
import { searchLocations } from "@/lib/lookups";
import { queryKeys } from "@/lib/query-keys";
import type { LocationOption } from "@/types/lookups";

interface LocationFilterProps {
  id?: string;
  /** Selected location id (URL state), "" = none. */
  value: string;
  onChange: (locationId: string) => void;
}

/**
 * Location combobox whose value is an id kept in the URL. There is no "get location by id"
 * endpoint, so after a reload the chip only shows the id until a new location is picked.
 */
export function LocationFilter({ id, value, onChange }: LocationFilterProps) {
  const [picked, setPicked] = React.useState<LocationOption | null>(null);
  const numericId = /^\d+$/.test(value) ? Number(value) : null;
  const selected: LocationOption | null =
    numericId === null
      ? null
      : picked && picked.id === numericId
        ? picked
        : { id: numericId, code: null, name: `Lokasi #${numericId}` };

  return (
    <AsyncCombobox<LocationOption>
      id={id}
      selected={selected}
      onChange={(location) => {
        setPicked(location);
        onChange(location ? String(location.id) : "");
      }}
      queryKey={(q) => queryKeys.locations(q)}
      fetcher={(q, signal) => searchLocations(q, signal)}
      getKey={(item) => item.id}
      minChars={0}
      placeholder="Semua lokasi"
      emptyText="Lokasi tidak ditemukan."
      renderOption={(item) => (
        <p>
          {item.code ? <span className="font-mono text-xs">{item.code} &middot; </span> : null}
          {item.name}
        </p>
      )}
      renderSelected={(item) => <p className="truncate">{item.name}</p>}
    />
  );
}
