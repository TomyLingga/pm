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
import { cancelWorkOrder } from "@/lib/work-orders";
import type { WorkOrderDetail } from "@/types/work-order";
import {
  firstError,
  unmatchedValidationMessage,
  useWorkOrderAction,
  validationErrors,
} from "./use-work-order-action";

interface CancelDialogProps {
  wo: WorkOrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CancelForm({ wo, onDone }: { wo: WorkOrderDetail; onDone: () => void }) {
  const [reason, setReason] = React.useState("");
  const [clientError, setClientError] = React.useState<string | null>(null);
  const mutation = useWorkOrderAction(wo.id, (value: string) => cancelWorkOrder(wo.id, value), {
    successMessage: "WO dibatalkan.",
    onSuccess: onDone,
  });
  const serverError = firstError(validationErrors(mutation.error), "reason");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) {
      setClientError("Alasan pembatalan wajib diisi.");
      return;
    }
    setClientError(null);
    mutation.mutate(reason.trim());
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Alasan pembatalan" htmlFor="cancel-reason" required error={clientError ?? serverError}>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Contoh: masalah sudah teratasi sendiri"
          rows={4}
          maxLength={1000}
          autoFocus
          invalid={!!(clientError ?? serverError)}
        />
      </Field>
      <FieldError message={unmatchedValidationMessage(mutation.error, ["reason"])} />
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Kembali
        </Button>
        <Button type="submit" variant="destructive" loading={mutation.isPending}>
          Batalkan WO
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CancelDialog({ wo, open, onOpenChange }: CancelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan WO {wo.wo_number}?</DialogTitle>
          <DialogDescription>WO yang dibatalkan tidak dapat diproses lagi oleh unit pelaksana.</DialogDescription>
        </DialogHeader>
        {open ? <CancelForm wo={wo} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
