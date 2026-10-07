"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useExecutorStaff } from "@/hooks/use-lookups";
import { errorMessage } from "@/lib/api";
import { approveServiceRequest } from "@/lib/service-requests";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import type { ApprovePayload, ServiceRequestDetail } from "@/types/service-request";
import { useRequestAction } from "../use-request-action";

interface ApproveDialogProps {
  request: ServiceRequestDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ApproveForm({ request, onDone }: { request: ServiceRequestDetail; onDone: () => void }) {
  const isLeadStep =
    request.current_step?.key === "executor_lead" ||
    request.approval_steps.some((step) => step.status === "pending" && step.key === "executor_lead");
  const staff = useExecutorStaff(request.executor_unit.id, isLeadStep);
  const [notes, setNotes] = React.useState("");
  const [executorId, setExecutorId] = React.useState("");

  const mutation = useRequestAction(request.id, (payload: ApprovePayload) => approveServiceRequest(request.id, payload), {
    successMessage: isLeadStep ? "Disetujui. Form Request diteruskan ke pelaksana." : "Form Request disetujui.",
    onSuccess: onDone,
  });
  const errors = validationErrors(mutation.error);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    mutation.mutate({
      notes: notes.trim() || null,
      ...(isLeadStep && executorId ? { assigned_executor_id: Number(executorId) } : {}),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {isLeadStep ? (
        <Field
          label="Tunjuk pelaksana (opsional)"
          htmlFor="assigned_executor_id"
          error={firstError(errors, "assigned_executor_id")}
          hint={
            staff.isError
              ? errorMessage(staff.error)
              : "Bila tidak dipilih, siapa pun staf unit pelaksana dapat menyelesaikan."
          }
        >
          <Select
            id="assigned_executor_id"
            name="assigned_executor_id"
            value={executorId}
            onChange={(event) => setExecutorId(event.target.value)}
            disabled={staff.isPending || mutation.isPending}
            invalid={!!firstError(errors, "assigned_executor_id")}
          >
            <option value="">{staff.isPending ? "Memuat staf…" : "Tidak ditunjuk"}</option>
            {staff.data?.map((person) => (
              <option key={person.id} value={String(person.id)}>
                {person.name}
                {person.grade_code ? ` (${person.grade_code})` : ""}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field
        label="Catatan (opsional)"
        htmlFor="approve-notes"
        error={firstError(errors, "notes")}
        hint="Tampil di blok Pengesahan dan dibaca pemohon serta pelaksana."
      >
        <Textarea
          id="approve-notes"
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Contoh: setuju, gunakan vendor yang sudah ada…"
          disabled={mutation.isPending}
          invalid={!!firstError(errors, "notes")}
        />
      </Field>
      <FieldError message={unmatchedValidationMessage(mutation.error, ["notes", "assigned_executor_id"])} />
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Batal
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {mutation.isPending ? null : <CheckCircle2 aria-hidden />}
          {isLeadStep ? "Setujui & Teruskan" : "Setujui Form Request"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ApproveDialog({ request, open, onOpenChange }: ApproveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setujui Form Request</DialogTitle>
          <DialogDescription>
            {request.current_step
              ? `Anda menyetujui sebagai ${request.current_step.label}.`
              : "Setujui langkah persetujuan yang sedang aktif."}
          </DialogDescription>
        </DialogHeader>
        {open ? <ApproveForm request={request} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
