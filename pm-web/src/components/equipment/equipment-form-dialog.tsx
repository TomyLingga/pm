"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/layout/current-user";
import { useManageableUnits } from "@/components/pm/use-pm-units";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { ApiError, errorMessage } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { EQUIPMENT_STATUS_OPTIONS } from "@/lib/pm-constants";
import { createEquipment, updateEquipment } from "@/lib/pm-equipment";
import { queryKeys } from "@/lib/query-keys";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import type { LocationOption } from "@/types/lookups";
import type { EquipmentDetail, EquipmentPayload, EquipmentStatus } from "@/types/pm";
import { LocationField } from "./location-field";

interface EquipmentFormDialogProps {
  /** Equipment to edit; omit to create a new one. */
  equipment?: EquipmentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (equipment: EquipmentDetail) => void;
}

const FIELD_KEYS = ["code", "name", "location_id", "executor_unit_id", "brand", "model", "serial_number", "status"];

function EquipmentForm({
  equipment,
  onDone,
  onSaved,
}: {
  equipment?: EquipmentDetail;
  onDone: () => void;
  onSaved?: (equipment: EquipmentDetail) => void;
}) {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const manageable = useManageableUnits();
  const admin = isAdmin(me);

  const [code, setCode] = React.useState(equipment?.code ?? "");
  const [name, setName] = React.useState(equipment?.name ?? "");
  const [location, setLocation] = React.useState<LocationOption | null>(equipment?.location ?? null);
  const [unitId, setUnitId] = React.useState(() =>
    equipment?.executor_unit
      ? String(equipment.executor_unit.id)
      : !equipment && manageable.units.length === 1
        ? String(manageable.units[0].id)
        : "",
  );
  const [brand, setBrand] = React.useState(equipment?.brand ?? "");
  const [model, setModel] = React.useState(equipment?.model ?? "");
  const [serial, setSerial] = React.useState(equipment?.serial_number ?? "");
  const [status, setStatus] = React.useState<EquipmentStatus>(equipment?.status ?? "active");
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});

  const unitOptions = React.useMemo(() => {
    const list = [...manageable.units];
    const current = equipment?.executor_unit;
    if (current && !list.some((unit) => unit.id === current.id)) list.unshift(current);
    return list;
  }, [equipment?.executor_unit, manageable.units]);

  const mutation = useMutation({
    mutationFn: (payload: EquipmentPayload) =>
      equipment ? updateEquipment(equipment.id, payload) : createEquipment(payload),
    onSuccess: (detail) => {
      // Lookups, lists and history all hang under the "equipment" prefix.
      void queryClient.invalidateQueries({ queryKey: queryKeys.equipmentAll });
      queryClient.setQueryData(queryKeys.equipmentDetail(detail.id), detail);
      toast.success(equipment ? "Data equipment disimpan." : `Equipment ${detail.code ?? detail.name} ditambahkan.`);
      onSaved?.(detail);
      onDone();
    },
  });
  const serverErrors = validationErrors(mutation.error);
  const errorFor = (key: string) => clientErrors[key] ?? firstError(serverErrors, key);
  // Non-field problems: a 422 on an unknown field, or any other failure (403, 409, 5xx, network).
  const isValidationError = mutation.error instanceof ApiError && mutation.error.status === 422;
  const generalError = mutation.error
    ? isValidationError
      ? unmatchedValidationMessage(mutation.error, FIELD_KEYS)
      : errorMessage(mutation.error, "Gagal menyimpan equipment.")
    : undefined;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const errors: Record<string, string> = {};
    if (!code.trim()) errors.code = "Kode / nomor alat wajib diisi.";
    if (!name.trim()) errors.name = "Nama equipment wajib diisi.";
    // Leads may only register equipment for a unit they lead.
    if (!admin && !unitId) errors.executor_unit_id = "Pilih unit pelaksana.";
    setClientErrors(errors);
    if (Object.keys(errors).length) return;
    mutation.mutate({
      code: code.trim(),
      name: name.trim(),
      location_id: location?.id ?? null,
      executor_unit_id: unitId ? Number(unitId) : null,
      brand: brand.trim() || null,
      model: model.trim() || null,
      serial_number: serial.trim() || null,
      status,
    });
  };

  const pending = mutation.isPending;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label="Kode / no. alat" htmlFor="equipment-code" required error={errorFor("code")}>
          <Input
            id="equipment-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Contoh: CMP-01"
            maxLength={50}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            invalid={!!errorFor("code")}
            className="font-mono"
          />
        </Field>
        <Field label="Nama equipment" htmlFor="equipment-name" required error={errorFor("name")}>
          <Input
            id="equipment-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Contoh: Kompresor Atlas Copco GA37"
            maxLength={200}
            autoComplete="off"
            disabled={pending}
            invalid={!!errorFor("name")}
          />
        </Field>
      </div>

      <Field label="Lokasi" htmlFor="equipment-location" error={errorFor("location_id")}>
        <LocationField
          id="equipment-location"
          value={location}
          onChange={setLocation}
          disabled={pending}
          invalid={!!errorFor("location_id")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Unit pelaksana (penanggung jawab)"
          htmlFor="equipment-unit"
          required={!admin}
          error={errorFor("executor_unit_id")}
        >
          <Select
            id="equipment-unit"
            value={unitId}
            onChange={(event) => setUnitId(event.target.value)}
            disabled={manageable.isPending || pending}
            invalid={!!errorFor("executor_unit_id")}
          >
            <option value="">{manageable.isPending ? "Memuat…" : admin ? "Tanpa unit" : "Pilih unit pelaksana"}</option>
            {unitOptions.map((unit) => (
              <option key={unit.id} value={String(unit.id)}>
                {unit.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="equipment-status" error={errorFor("status")}>
          <Select
            id="equipment-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as EquipmentStatus)}
            disabled={pending}
            invalid={!!errorFor("status")}
          >
            {EQUIPMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Merk" htmlFor="equipment-brand" error={errorFor("brand")}>
          <Input
            id="equipment-brand"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            placeholder="Contoh: Atlas Copco"
            maxLength={100}
            autoComplete="off"
            disabled={pending}
          />
        </Field>
        <Field label="Model / tipe" htmlFor="equipment-model" error={errorFor("model")}>
          <Input
            id="equipment-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="Contoh: GA37"
            maxLength={100}
            autoComplete="off"
            disabled={pending}
          />
        </Field>
        <Field label="No. seri" htmlFor="equipment-serial" error={errorFor("serial_number")}>
          <Input
            id="equipment-serial"
            value={serial}
            onChange={(event) => setSerial(event.target.value)}
            placeholder="Contoh: SN-0012345"
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            className="font-mono"
          />
        </Field>
      </div>

      <FieldError message={generalError} />

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={pending}>
          Batal
        </Button>
        <Button type="submit" loading={pending}>
          {equipment ? "Simpan" : "Tambah Equipment"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EquipmentFormDialog({ equipment, open, onOpenChange, onSaved }: EquipmentFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{equipment ? "Ubah Equipment" : "Tambah Equipment"}</DialogTitle>
          <DialogDescription>
            Master alat/aset yang dirawat. Dipakai di Work Order, jadwal PM, dan riwayat maintenance.
          </DialogDescription>
        </DialogHeader>
        {open ? <EquipmentForm equipment={equipment} onDone={() => onOpenChange(false)} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  );
}
