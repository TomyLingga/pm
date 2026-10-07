"use client";

import * as React from "react";
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
import { Select } from "@/components/ui/select";
import { useExecutorStaff } from "@/hooks/use-lookups";
import { errorMessage } from "@/lib/api";
import { reassignPmTask } from "@/lib/pm-tasks";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import type { PmTaskDetail } from "@/types/pm";
import { usePmTaskAction } from "./use-pm-task";

interface ReassignDialogProps {
  task: PmTaskDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ReassignForm({ task, onDone }: { task: PmTaskDetail; onDone: () => void }) {
  const staff = useExecutorStaff(task.executor_unit.id);
  const [picId, setPicId] = React.useState(task.pic ? String(task.pic.id) : "");
  const [clientError, setClientError] = React.useState<string | null>(null);

  const mutation = usePmTaskAction(task.id, (id: number) => reassignPmTask(task.id, id), {
    successMessage: "PIC tugas diganti.",
    onSuccess: onDone,
  });
  const fieldError = clientError ?? firstError(validationErrors(mutation.error), "pic_user_id");
  // Keep the current PIC selectable even if he is no longer in the staff list.
  const currentMissing = task.pic && staff.data && !staff.data.some((person) => person.id === task.pic?.id);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!picId) {
      setClientError("Pilih PIC.");
      return;
    }
    if (task.pic && Number(picId) === task.pic.id) {
      setClientError("Pilih PIC yang berbeda dari PIC saat ini.");
      return;
    }
    setClientError(null);
    mutation.mutate(Number(picId));
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field
        label="PIC baru"
        htmlFor="pm-reassign-pic"
        required
        error={fieldError}
        hint={staff.isError ? errorMessage(staff.error) : `Staf ${task.executor_unit.display_name}`}
      >
        <Select
          id="pm-reassign-pic"
          value={picId}
          onChange={(event) => setPicId(event.target.value)}
          disabled={staff.isPending || mutation.isPending}
          invalid={!!fieldError}
        >
          <option value="">{staff.isPending ? "Memuat staf…" : "Pilih PIC"}</option>
          {currentMissing && task.pic ? <option value={String(task.pic.id)}>{task.pic.name}</option> : null}
          {staff.data?.map((person) => (
            <option key={person.id} value={String(person.id)}>
              {person.name}
              {person.grade_code ? ` (${person.grade_code})` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <FieldError message={unmatchedValidationMessage(mutation.error, ["pic_user_id"])} />
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Batal
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Ganti PIC
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ReassignDialog({ task, open, onOpenChange }: ReassignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ganti PIC</DialogTitle>
          <DialogDescription>
            PIC baru akan menerima notifikasi dan tugas {task.number} pindah ke daftar tugasnya.
          </DialogDescription>
        </DialogHeader>
        {open ? <ReassignForm task={task} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
