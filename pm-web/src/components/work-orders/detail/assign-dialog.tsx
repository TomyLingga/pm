"use client";

import * as React from "react";
import { Crown } from "lucide-react";
import { ErrorState } from "@/components/common/states";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox, Radio } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useExecutorStaff } from "@/hooks/use-lookups";
import { errorMessage } from "@/lib/api";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { receiveWorkOrder, updateAssignees } from "@/lib/work-orders";
import type { WorkOrderDetail, WorkOrderPriority } from "@/types/work-order";
import {
  firstError,
  unmatchedValidationMessage,
  useWorkOrderAction,
  validationErrors,
} from "./use-work-order-action";

type AssignMode = "receive" | "reassign";

interface AssignDialogProps {
  wo: WorkOrderDetail;
  mode: AssignMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AssignVariables {
  assignee_ids: number[];
  lead_id: number;
  priority?: WorkOrderPriority;
}

/** Skeleton shaped like the staff rows below. */
function StaffSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Memuat staf…</span>
      <ul className="divide-y rounded-md border" aria-hidden>
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40 max-w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-4 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssignForm({ wo, mode, onDone }: { wo: WorkOrderDetail; mode: AssignMode; onDone: () => void }) {
  const staff = useExecutorStaff(wo.executor_unit.id);
  const [selected, setSelected] = React.useState<number[]>(() =>
    mode === "reassign" ? wo.assignees.map((a) => a.id) : [],
  );
  const [leadId, setLeadId] = React.useState<number | null>(() =>
    mode === "reassign" ? wo.assignees.find((a) => a.is_lead)?.id ?? wo.assignees[0]?.id ?? null : null,
  );
  const [priority, setPriority] = React.useState<"" | WorkOrderPriority>("");
  const [clientError, setClientError] = React.useState<string | null>(null);

  const mutation = useWorkOrderAction(
    wo.id,
    (vars: AssignVariables) =>
      mode === "receive"
        ? receiveWorkOrder(wo.id, vars)
        : updateAssignees(wo.id, { assignee_ids: vars.assignee_ids, lead_id: vars.lead_id }),
    {
      successMessage: mode === "receive" ? "WO diterima dan teknisi ditugaskan." : "Teknisi diperbarui.",
      onSuccess: onDone,
    },
  );
  const errors = validationErrors(mutation.error);

  const toggle = (id: number, checked: boolean) => {
    const next = checked ? [...selected, id] : selected.filter((value) => value !== id);
    setSelected(next);
    if (checked && leadId === null) setLeadId(id);
    else if (!checked && leadId === id) setLeadId(next[0] ?? null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) {
      setClientError("Pilih minimal satu teknisi.");
      return;
    }
    if (leadId === null || !selected.includes(leadId)) {
      setClientError("Tentukan ketua (lead) dari teknisi yang dipilih.");
      return;
    }
    setClientError(null);
    mutation.mutate({
      assignee_ids: selected,
      lead_id: leadId,
      ...(mode === "receive" && priority ? { priority } : {}),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Staf {wo.executor_unit.display_name}
            {selected.length > 0 ? <span className="tabular"> ({selected.length} dipilih)</span> : null}
          </span>
          <span>Ketua</span>
        </div>
        {staff.isPending ? (
          <StaffSkeleton />
        ) : staff.isError ? (
          <ErrorState title="Gagal memuat staf" message={errorMessage(staff.error)} onRetry={() => staff.refetch()} />
        ) : staff.data.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Unit ini belum memiliki staf.
          </p>
        ) : (
          <ul className="max-h-[45dvh] divide-y overflow-y-auto overscroll-contain rounded-md border">
            {staff.data.map((person) => {
              const checked = selected.includes(person.id);
              const isLead = leadId === person.id;
              return (
                <li
                  key={person.id}
                  className={cn(
                    "flex items-center gap-2 pl-3 pr-1 transition-colors duration-150",
                    checked ? "bg-primary-soft/50" : "hover:bg-surface-2/60",
                  )}
                >
                  <label className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2">
                    <Checkbox
                      checked={checked}
                      onChange={(event) => toggle(person.id, event.target.checked)}
                      aria-label={`Pilih ${person.name}`}
                    />
                    <UserAvatar name={person.name} photoUrl={person.photo_url} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{person.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[person.grade_code, person.position].filter(Boolean).join(" - ")}
                        {person.is_lead ? " (Pimpinan)" : ""}
                      </span>
                    </span>
                  </label>
                  <label
                    className={cn(
                      "flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md",
                      !checked && "cursor-not-allowed",
                    )}
                  >
                    <Radio
                      name="lead"
                      checked={isLead}
                      disabled={!checked}
                      onChange={() => setLeadId(person.id)}
                      aria-label={`Jadikan ${person.name} ketua`}
                    />
                    <Crown
                      className={cn("h-3.5 w-3.5", isLead ? "text-warning" : "text-transparent")}
                      aria-hidden
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <FieldError
          className="mt-2"
          message={clientError ?? firstError(errors, "assignee_ids", "assignee_ids.*", "lead_id")}
        />
      </div>

      {mode === "receive" ? (
        <Field
          label="Ubah prioritas (opsional)"
          htmlFor="receive-priority"
          error={firstError(errors, "priority")}
        >
          <Select
            id="receive-priority"
            name="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as "" | WorkOrderPriority)}
          >
            <option value="">Tetap ({wo.priority_label})</option>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <FieldError
        message={unmatchedValidationMessage(mutation.error, ["assignee_ids", "assignee_ids.*", "lead_id", "priority"])}
      />

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Batal
        </Button>
        <Button type="submit" loading={mutation.isPending} disabled={staff.isPending}>
          {mode === "receive" ? "Terima & Tugaskan" : "Simpan Teknisi"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AssignDialog({ wo, mode, open, onOpenChange }: AssignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "receive" ? "Terima & Tugaskan" : "Ubah Teknisi"}</DialogTitle>
          <DialogDescription>
            {mode === "receive"
              ? "Pilih teknisi yang akan mengerjakan WO ini dan tentukan ketuanya."
              : "Perbarui daftar teknisi dan ketua untuk WO ini."}
          </DialogDescription>
        </DialogHeader>
        {open ? <AssignForm wo={wo} mode={mode} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
