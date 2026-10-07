"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api";
import { APP_TIME_ZONE } from "@/lib/format";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import { setWorkProgramActivityStatus } from "@/lib/work-programs";
import type { WorkProgramActivity, WorkProgramActivityStatus } from "@/types/work-program";
import { ACTIVITY_STATUS_OPTIONS, ActivityStatusBadge } from "./program-badges";
import { useWorkProgramCache } from "./use-work-program";

interface ActivityStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: number;
  activity: WorkProgramActivity | null;
}

const FIELD_KEYS = ["status", "notes", "closed_date"];

/** Natural next step from the current status (the user may still pick any other). */
const NEXT_STATUS: Record<WorkProgramActivityStatus, WorkProgramActivityStatus> = {
  open: "on_progress",
  on_progress: "closed",
  closed: "open",
  cancelled: "open",
};

const STATUS_HINTS: Record<WorkProgramActivityStatus, string> = {
  open: "Progres kembali ke 0%.",
  on_progress: "Kegiatan sedang dikerjakan; progres tetap seperti sekarang.",
  closed: "Progres otomatis 100% dan tanggal closed terisi.",
  cancelled: "Kegiatan tidak dihitung dalam progres program; tanggal closed terisi.",
};

function todayJakarta(): string {
  return formatInTimeZone(new Date(), APP_TIME_ZONE, "yyyy-MM-dd");
}

function StatusForm({
  programId,
  activity,
  onDone,
}: {
  programId: number;
  activity: WorkProgramActivity;
  onDone: () => void;
}) {
  const cache = useWorkProgramCache(programId);
  const [status, setStatus] = React.useState<WorkProgramActivityStatus>(NEXT_STATUS[activity.status]);
  const [notes, setNotes] = React.useState("");
  const [closedDate, setClosedDate] = React.useState(() => activity.closed_date ?? todayJakarta());
  const needsClosedDate = status === "closed" || status === "cancelled";

  const mutation = useMutation({
    mutationFn: () =>
      setWorkProgramActivityStatus(activity.id, {
        status,
        notes: notes.trim() || null,
        ...(needsClosedDate && closedDate ? { closed_date: closedDate } : {}),
      }),
    onSuccess: (saved) => {
      cache.applyActivity(saved);
      toast.success("Status kegiatan diubah.");
      onDone();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) return;
      toast.error(errorMessage(error));
    },
  });
  const errors = validationErrors(mutation.error);
  const options = ACTIVITY_STATUS_OPTIONS.filter((option) => option.value !== activity.status);
  const busy = mutation.isPending;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
      noValidate
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status saat ini:</span>
        <ActivityStatusBadge status={activity.status} label={activity.status_label} />
      </div>

      <Field label="Status baru" htmlFor="activity-status" required error={firstError(errors, "status")} hint={STATUS_HINTS[status]}>
        <Select
          id="activity-status"
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as WorkProgramActivityStatus)}
          disabled={busy}
          invalid={!!firstError(errors, "status")}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      {needsClosedDate ? (
        <Field
          label="Tanggal closed"
          htmlFor="activity-closed-date"
          error={firstError(errors, "closed_date")}
          hint="Kosongkan untuk memakai hari ini."
          className="sm:max-w-xs"
        >
          <Input
            id="activity-closed-date"
            name="closed_date"
            type="date"
            value={closedDate}
            onChange={(event) => setClosedDate(event.target.value)}
            disabled={busy}
            invalid={!!firstError(errors, "closed_date")}
            className="tabular"
          />
        </Field>
      ) : null}

      <Field label="Catatan (opsional)" htmlFor="activity-status-notes" error={firstError(errors, "notes")}>
        <Textarea
          id="activity-status-notes"
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Alasan atau hasil yang dicapai…"
          disabled={busy}
          invalid={!!firstError(errors, "notes")}
        />
      </Field>

      <FieldError message={unmatchedValidationMessage(mutation.error, FIELD_KEYS)} />

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" loading={busy}>
          Simpan Status
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Change an activity's status with a note (managers and PICs). */
export function ActivityStatusDialog({ open, onOpenChange, programId, activity }: ActivityStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah Status Kegiatan</DialogTitle>
          {activity ? <DialogDescription className="line-clamp-2">{activity.title}</DialogDescription> : null}
        </DialogHeader>
        {open && activity ? (
          <StatusForm key={activity.id} programId={programId} activity={activity} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
