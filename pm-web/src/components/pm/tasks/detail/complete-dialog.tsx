"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { formatMinutes } from "@/lib/format";
import { firstError, validationErrors } from "@/lib/validation";
import type { PmTaskDetail } from "@/types/pm";

interface CompleteDialogProps {
  task: PmTaskDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Items currently answered "Tidak OK". */
  findingsCount: number;
  /** Findings that have no work order yet. */
  findingsWithoutWo: number;
  loading?: boolean;
  /** Error of the last "complete" call (422 field errors are shown inline). */
  error?: unknown;
  onSubmit: (values: { duration_minutes: number | null; notes: string | null }) => void;
}

/** Minutes since the task was started (at least 1), or the schedule's estimate. */
function defaultDuration(task: PmTaskDetail): string {
  if (task.started_at) {
    const started = new Date(task.started_at).getTime();
    if (Number.isFinite(started)) return String(Math.max(1, Math.round((Date.now() - started) / 60000)));
  }
  return task.estimated_minutes ? String(task.estimated_minutes) : "";
}

function CompleteForm({
  task,
  findingsCount,
  findingsWithoutWo,
  loading,
  error,
  onSubmit,
  onCancel,
}: Omit<CompleteDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const [duration, setDuration] = React.useState(() => defaultDuration(task));
  const [notes, setNotes] = React.useState(task.notes ?? "");
  const [clientError, setClientError] = React.useState<string | null>(null);
  const errors = validationErrors(error);
  const durationError = clientError ?? firstError(errors, "duration_minutes");
  const minutes = Number(duration);

  // Field errors other than the per-item ones (those are shown on the checklist itself).
  const otherError = Object.keys(errors).find(
    (key) => key !== "duration_minutes" && key !== "notes" && !key.startsWith("items"),
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (duration.trim() && (!Number.isInteger(minutes) || minutes < 1)) {
      setClientError("Durasi harus berupa bilangan bulat menit (minimal 1).");
      return;
    }
    setClientError(null);
    onSubmit({ duration_minutes: duration.trim() ? minutes : null, notes: notes.trim() || null });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {findingsCount > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft p-3 text-sm text-danger-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <span>
            Ada <strong>{findingsCount} temuan</strong> (Tidak OK)
            {findingsWithoutWo > 0
              ? `, ${findingsWithoutWo} di antaranya belum dibuatkan Work Order. WO masih dapat dibuat dari butir temuan.`
              : ". Semua temuan sudah dibuatkan Work Order."}
          </span>
        </div>
      ) : null}

      <Field
        label="Durasi pengerjaan (menit)"
        htmlFor="pm-duration"
        error={durationError}
        hint={
          [
            duration.trim() && Number.isFinite(minutes) && minutes > 0 ? `= ${formatMinutes(minutes)}` : null,
            task.estimated_minutes ? `Estimasi jadwal: ${formatMinutes(task.estimated_minutes)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Dihitung dari waktu mulai; koreksi bila perlu."
        }
      >
        <Input
          id="pm-duration"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
          disabled={loading}
          invalid={!!durationError}
          className="tabular h-12 text-lg sm:text-lg"
        />
      </Field>

      <Field label="Catatan (opsional)" htmlFor="pm-complete-notes" error={firstError(errors, "notes")}>
        <Textarea
          id="pm-complete-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Ringkasan pekerjaan atau hal yang perlu ditindaklanjuti…"
          disabled={loading}
        />
      </Field>

      {otherError ? <FieldError message={errors[otherError]?.[0]} /> : null}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Batal
        </Button>
        <Button type="submit" loading={loading}>
          Selesaikan Tugas
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CompleteDialog({ open, onOpenChange, ...formProps }: CompleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !formProps.loading && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selesaikan tugas {formProps.task.number}?</DialogTitle>
          <DialogDescription>
            Setelah diselesaikan, jawaban checklist, foto, dan material tidak dapat diubah lagi.
          </DialogDescription>
        </DialogHeader>
        {open ? <CompleteForm {...formProps} onCancel={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
