"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api";
import { DAILY_ACTIVITY_LIST_PREFIX, setDailyActivityStatus } from "@/lib/daily-activities";
import { ACTIVITY_NEXT_STATUS, ACTIVITY_STATUS_LABELS, ACTIVITY_STATUS_OPTIONS } from "@/lib/daily-activity-constants";
import { queryKeys } from "@/lib/query-keys";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import type { DailyActivity, DailyActivityDetail, DailyActivityStatus } from "@/types/daily-activity";
import { ActivityStatusBadge } from "./activity-badges";

interface ActivityStatusDialogProps {
  activity: DailyActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (detail: DailyActivityDetail) => void;
}

const FIELD_KEYS = ["status", "notes"];

function StatusForm({
  activity,
  onDone,
  onSaved,
}: {
  activity: DailyActivity;
  onDone: () => void;
  onSaved?: (detail: DailyActivityDetail) => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<DailyActivityStatus>(ACTIVITY_NEXT_STATUS[activity.status] ?? "on_progress");
  const [notes, setNotes] = React.useState("");
  const [clientError, setClientError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => setDailyActivityStatus(activity.id, { status, notes: notes.trim() || null }),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.dailyActivity(detail.id), detail);
      void queryClient.invalidateQueries({ queryKey: DAILY_ACTIVITY_LIST_PREFIX });
      toast.success(`Status diperbarui menjadi ${ACTIVITY_STATUS_LABELS[detail.status] ?? detail.status_label}.`);
      onSaved?.(detail);
      onDone();
    },
  });

  const serverErrors = validationErrors(mutation.error);
  const statusError = clientError ?? firstError(serverErrors, "status");
  const notesError = firstError(serverErrors, "notes");
  const isValidationError = mutation.error instanceof ApiError && mutation.error.status === 422;
  const generalError = mutation.error
    ? isValidationError
      ? unmatchedValidationMessage(mutation.error, FIELD_KEYS)
      : errorMessage(mutation.error, "Gagal memperbarui status.")
    : undefined;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (status === activity.status) {
      setClientError("Pilih status yang berbeda dari status saat ini.");
      return;
    }
    setClientError(null);
    mutation.mutate();
  };

  const pending = mutation.isPending;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Status baru" htmlFor="activity-status-next" required error={statusError}>
        <Select
          id="activity-status-next"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as DailyActivityStatus);
            setClientError(null);
          }}
          disabled={pending}
          invalid={!!statusError}
          autoFocus
        >
          {ACTIVITY_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} disabled={option.value === activity.status}>
              {option.label} ({option.description}){option.value === activity.status ? ", status saat ini" : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Catatan" htmlFor="activity-status-notes" error={notesError} hint="Opsional, tercatat di riwayat.">
        <Textarea
          id="activity-status-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Contoh: pekerjaan selesai, menunggu konfirmasi user"
          disabled={pending}
          invalid={!!notesError}
        />
      </Field>

      <FieldError message={generalError} />

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={pending}>
          Batal
        </Button>
        <Button type="submit" loading={pending}>
          Simpan Status
        </Button>
      </DialogFooter>
    </form>
  );
}

/** `POST /daily-activities/{id}/status`: pick the new status and an optional note. */
export function ActivityStatusDialog({ activity, open, onOpenChange, onSaved }: ActivityStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Status</DialogTitle>
          {activity ? (
            <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="line-clamp-1 break-words">{activity.title}</span>
              <span className="inline-flex items-center gap-1.5">
                <span>Status saat ini:</span>
                <ActivityStatusBadge status={activity.status} label={activity.status_label} />
              </span>
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {open && activity ? (
          <StatusForm key={activity.id} activity={activity} onDone={() => onOpenChange(false)} onSaved={onSaved} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
