"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MapPinPlus } from "lucide-react";
import { AsyncCombobox } from "@/components/common/async-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { errorMessage } from "@/lib/api";
import { searchLocations } from "@/lib/lookups";
import { createLocation } from "@/lib/pm-equipment";
import { queryKeys } from "@/lib/query-keys";
import { firstError, validationErrors } from "@/lib/validation";
import type { LocationOption } from "@/types/lookups";

interface LocationFieldProps {
  id?: string;
  value: LocationOption | null;
  onChange: (location: LocationOption | null) => void;
  disabled?: boolean;
  invalid?: boolean;
}

/** Location combobox (`/locations?q=`) with a tiny inline "Lokasi baru" form (`POST /locations`). */
export function LocationField({ id, value, onChange, disabled, invalid }: LocationFieldProps) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const [clientError, setClientError] = React.useState<string | null>(null);
  const errors = validationErrors(error);

  const save = async () => {
    if (!code.trim() || !name.trim()) {
      setClientError("Kode dan nama lokasi wajib diisi.");
      return;
    }
    setClientError(null);
    setSaving(true);
    setError(null);
    try {
      const location = await createLocation({ code: code.trim(), name: name.trim() });
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      onChange(location);
      toast.success(`Lokasi "${location.name}" ditambahkan.`);
      setCreating(false);
      setCode("");
      setName("");
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  if (creating) {
    const serverMessage =
      firstError(errors, "code", "name") ?? (error && Object.keys(errors).length === 0 ? errorMessage(error) : undefined);
    return (
      <div className="space-y-3 rounded-md border border-dashed bg-surface-2/40 p-3">
        <p className="text-sm font-medium">Lokasi baru</p>
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <Field label="Kode" htmlFor={`${id}-new-code`} required>
            <Input
              id={`${id}-new-code`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Contoh: UTL"
              maxLength={50}
              autoComplete="off"
              spellCheck={false}
              disabled={saving}
              className="font-mono"
              // The sub-form opens from an explicit "Lokasi baru" click, so moving focus here is expected.
              autoFocus
            />
          </Field>
          <Field label="Nama lokasi" htmlFor={`${id}-new-name`} required>
            <Input
              id={`${id}-new-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Utility"
              maxLength={150}
              autoComplete="off"
              disabled={saving}
              onKeyDown={(event) => {
                // Enter must not submit the surrounding equipment form.
                if (event.key === "Enter") {
                  event.preventDefault();
                  void save();
                }
              }}
            />
          </Field>
        </div>
        <FieldError message={clientError ?? serverMessage} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={saving}>
            Batal
          </Button>
          <Button size="sm" onClick={() => void save()} loading={saving}>
            Simpan lokasi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AsyncCombobox<LocationOption>
      id={id}
      selected={value}
      onChange={onChange}
      queryKey={(q) => queryKeys.locations(q)}
      fetcher={(q, signal) => searchLocations(q, signal)}
      getKey={(item) => item.id}
      minChars={0}
      placeholder="Cari lokasi…"
      emptyText="Lokasi tidak ditemukan."
      disabled={disabled}
      invalid={invalid}
      renderOption={(item) => (
        <p>
          {item.code ? <span className="font-mono text-xs">{item.code} &middot; </span> : null}
          {item.name}
        </p>
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
            setCreating(true);
          }}
          className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-primary transition-colors duration-150 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <MapPinPlus className="h-4 w-4" aria-hidden />
          Lokasi baru
        </button>
      )}
    />
  );
}
