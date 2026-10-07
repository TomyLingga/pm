"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState } from "@/components/common/states";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import {
  WORK_PROGRAM_LISTS_KEY,
  createWorkProgram,
  getWorkProgramUnits,
  updateWorkProgram,
} from "@/lib/work-programs";
import type { WorkProgramDetail, WorkProgramListItem } from "@/types/work-program";

interface ProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode (year and unit are fixed by the API). */
  program?: WorkProgramListItem | WorkProgramDetail;
  /** Year preselected on create (the list's current year). */
  defaultYear?: number;
  onSaved?: (detail: WorkProgramDetail) => void;
}

const FIELD_KEYS = ["year", "code", "title", "description", "org_unit_id"];

function unitLabel(unit: { code: string | null; name: string; type?: string | null }): string {
  return unit.code ? `${unit.name} (${unit.code})` : unit.name;
}

function ProgramForm({
  program,
  defaultYear,
  onSaved,
  onCancel,
}: Omit<ProgramFormDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const queryClient = useQueryClient();
  const editing = !!program;
  const currentYear = new Date().getFullYear();

  const [year, setYear] = React.useState(String(program?.year ?? defaultYear ?? currentYear));
  const [code, setCode] = React.useState(program?.code ?? "");
  const [title, setTitle] = React.useState(program?.title ?? "");
  const [description, setDescription] = React.useState(program?.description ?? "");
  const [orgUnitId, setOrgUnitId] = React.useState(program?.org_unit ? String(program.org_unit.id) : "");
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});

  const units = useQuery({
    queryKey: queryKeys.workProgramUnits,
    queryFn: ({ signal }) => getWorkProgramUnits(signal),
    enabled: !editing,
    staleTime: 5 * 60 * 1000,
  });

  // Single manageable unit: preselect it.
  React.useEffect(() => {
    if (!editing && !orgUnitId && units.data?.length === 1) setOrgUnitId(String(units.data[0].id));
  }, [editing, orgUnitId, units.data]);

  const mutation = useMutation({
    mutationFn: () => {
      const base = { code: code.trim(), title: title.trim(), description: description.trim() || null };
      return editing
        ? updateWorkProgram(program.id, base)
        : createWorkProgram({ ...base, year: Number(year), org_unit_id: Number(orgUnitId) });
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.workProgram(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workProgram(detail.id) });
      void queryClient.invalidateQueries({ queryKey: WORK_PROGRAM_LISTS_KEY });
      toast.success(editing ? "Program disimpan." : `Program ${detail.code} dibuat.`);
      onSaved?.(detail);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) return;
      toast.error(errorMessage(error));
    },
  });
  const errors = validationErrors(mutation.error);
  const errorFor = (key: string) => clientErrors[key] ?? firstError(errors, key);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const yearNumber = Number(year);
    if (!editing && (!Number.isInteger(yearNumber) || yearNumber < 2000 || yearNumber > 2100)) {
      next.year = "Tahun harus antara 2000 dan 2100.";
    }
    if (!code.trim()) next.code = "Kode program wajib diisi.";
    if (!title.trim()) next.title = "Judul program wajib diisi.";
    if (!editing && !orgUnitId) next.org_unit_id = "Pilih unit pemilik program.";
    setClientErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  const busy = mutation.isPending;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <Field label="Tahun" htmlFor="program-year" required error={errorFor("year")}>
          <Input
            id="program-year"
            name="year"
            type="number"
            inputMode="numeric"
            min={2000}
            max={2100}
            value={year}
            onChange={(event) => setYear(event.target.value)}
            disabled={busy || editing}
            invalid={!!errorFor("year")}
            className="tabular"
          />
        </Field>
        <Field
          label="Kode program"
          htmlFor="program-code"
          required
          error={errorFor("code")}
          hint="Unik per unit dalam satu tahun, contoh: A, B, C."
        >
          <Input
            id="program-code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={10}
            placeholder="A"
            autoComplete="off"
            disabled={busy}
            invalid={!!errorFor("code")}
            className="font-mono uppercase"
          />
        </Field>
      </div>

      <Field label="Judul program" htmlFor="program-title" required error={errorFor("title")}>
        <Input
          id="program-title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="Contoh: Enabling Digital and Reliable Operation"
          autoComplete="off"
          disabled={busy}
          invalid={!!errorFor("title")}
        />
      </Field>

      {editing ? (
        <Field label="Unit pemilik" htmlFor="program-unit-fixed" hint="Unit dan tahun tidak dapat diubah setelah program dibuat.">
          <Input id="program-unit-fixed" value={program.org_unit ? unitLabel(program.org_unit) : "-"} readOnly disabled />
        </Field>
      ) : units.isError ? (
        <ErrorState title="Gagal memuat unit" message={errorMessage(units.error)} onRetry={() => units.refetch()} />
      ) : (
        <Field
          label="Unit pemilik"
          htmlFor="program-unit"
          required
          error={errorFor("org_unit_id")}
          hint={units.data && units.data.length === 0 ? "Anda bukan pimpinan unit mana pun, program tidak bisa dibuat." : undefined}
        >
          {units.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              id="program-unit"
              name="org_unit_id"
              value={orgUnitId}
              onChange={(event) => setOrgUnitId(event.target.value)}
              disabled={busy || units.data.length === 0}
              invalid={!!errorFor("org_unit_id")}
            >
              <option value="">Pilih unit…</option>
              {units.data.map((unit) => (
                <option key={unit.id} value={String(unit.id)}>
                  {unitLabel(unit)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      <Field label="Deskripsi (opsional)" htmlFor="program-description" error={errorFor("description")}>
        <Textarea
          id="program-description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Sasaran atau ruang lingkup program…"
          disabled={busy}
          invalid={!!errorFor("description")}
        />
      </Field>

      <FieldError message={unmatchedValidationMessage(mutation.error, FIELD_KEYS)} />

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" loading={busy} disabled={!editing && units.isPending}>
          {editing ? "Simpan Program" : "Buat Program"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create / edit a programme (year + unit only on create; the API fixes them afterwards). */
export function ProgramFormDialog({ open, onOpenChange, program, defaultYear, onSaved }: ProgramFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{program ? "Ubah Program" : "Buat Program Kerja"}</DialogTitle>
          <DialogDescription>
            {program
              ? "Perbarui kode, judul, atau deskripsi program."
              : "Program kerja dimiliki satu unit organisasi dan berisi sub-item serta kegiatan."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ProgramForm
            program={program}
            defaultYear={defaultYear}
            onSaved={(detail) => {
              onOpenChange(false);
              onSaved?.(detail);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
