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
import { Textarea } from "@/components/ui/textarea";
import { changeSuperior, submitServiceRequest } from "@/lib/service-requests";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import type { SuperiorCandidate } from "@/types/lookups";
import type { ServiceRequestDetail } from "@/types/service-request";
import { SuperiorCombobox } from "../superior-combobox";
import { useRequestAction } from "../use-request-action";

type Mode = "submit" | "change";

interface SuperiorDialogProps {
  request: ServiceRequestDetail;
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SuperiorForm({ request, mode, onDone }: { request: ServiceRequestDetail; mode: Mode; onDone: () => void }) {
  const [superior, setSuperior] = React.useState<SuperiorCandidate | null>(request.superior);
  const [reason, setReason] = React.useState("");
  const [clientError, setClientError] = React.useState<string | null>(null);

  const mutation = useRequestAction(
    request.id,
    (vars: { superiorId: number | null; reason: string }) =>
      mode === "submit"
        ? submitServiceRequest(request.id, vars.superiorId)
        : changeSuperior(request.id, vars.superiorId as number, vars.reason),
    {
      successMessage: mode === "submit" ? "Form Request diajukan." : "Atasan penyetuju diganti.",
      onSuccess: onDone,
    },
  );
  const errors = validationErrors(mutation.error);
  const superiorError = clientError ?? firstError(errors, "superior_id");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "change" && !superior) {
      setClientError("Pilih atasan pengganti.");
      return;
    }
    if (mode === "change" && superior?.id === request.superior?.id) {
      setClientError("Pilih atasan yang berbeda dari atasan saat ini.");
      return;
    }
    setClientError(null);
    mutation.mutate({ superiorId: superior?.id ?? null, reason: reason.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field
        label={mode === "submit" ? "Atasan YBS" : "Atasan pengganti"}
        htmlFor="dialog-superior"
        required={mode === "change"}
        error={superiorError}
        hint={
          mode === "submit" && !superior
            ? "Bila dikosongkan, dipakai atasan dari Portal; bila tidak ada, langkah atasan dilewati."
            : undefined
        }
      >
        <SuperiorCombobox
          id="dialog-superior"
          selected={superior}
          onChange={setSuperior}
          invalid={!!superiorError}
          disabled={mutation.isPending}
        />
      </Field>
      {mode === "change" ? (
        <Field label="Alasan (opsional)" htmlFor="change-superior-reason" error={firstError(errors, "reason")}>
          <Textarea
            id="change-superior-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Contoh: atasan sedang cuti"
          />
        </Field>
      ) : null}
      <FieldError message={unmatchedValidationMessage(mutation.error, ["superior_id", "reason"])} />
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Batal
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {mode === "submit" ? "Ajukan" : "Ganti Atasan"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** "Ajukan" (choose/confirm superior) and "Ganti Atasan" dialogs. */
export function SuperiorDialog({ request, mode, open, onOpenChange }: SuperiorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "submit" ? "Ajukan Form Request" : "Ganti Atasan Penyetuju"}</DialogTitle>
          <DialogDescription>
            {mode === "submit"
              ? "Form Request akan dikirim ke atasan untuk disetujui, lalu ke pimpinan unit pelaksana."
              : "Persetujuan atasan akan dialihkan ke pejabat yang Anda pilih."}
          </DialogDescription>
        </DialogHeader>
        {open ? <SuperiorForm request={request} mode={mode} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
