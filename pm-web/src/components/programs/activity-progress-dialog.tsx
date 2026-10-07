"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
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
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import { updateWorkProgramActivity } from "@/lib/work-programs";
import type { WorkProgramActivity } from "@/types/work-program";
import { ActivityStatusBadge, ProgressBar } from "./program-badges";
import { useWorkProgramCache } from "./use-work-program";

interface ActivityProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: number;
  activity: WorkProgramActivity | null;
}

const FIELD_KEYS = ["progress_pct", "remarks"];
const QUICK_STEPS = [0, 25, 50, 75, 100];

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ProgressForm({
  programId,
  activity,
  onDone,
}: {
  programId: number;
  activity: WorkProgramActivity;
  onDone: () => void;
}) {
  const cache = useWorkProgramCache(programId);
  const [progress, setProgress] = React.useState(String(activity.progress_pct));
  const [remarks, setRemarks] = React.useState(activity.remarks ?? "");
  const [clientError, setClientError] = React.useState<string | null>(null);
  const value = clampPct(Number(progress));

  const mutation = useMutation({
    mutationFn: () => updateWorkProgramActivity(activity.id, { progress_pct: value, remarks: remarks.trim() || null }),
    onSuccess: (saved) => {
      cache.applyActivity(saved);
      toast.success("Progres kegiatan disimpan.");
      onDone();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) return;
      toast.error(errorMessage(error));
    },
  });
  const errors = validationErrors(mutation.error);
  const progressError = clientError ?? firstError(errors, "progress_pct");
  const busy = mutation.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const raw = Number(progress);
    if (progress.trim() === "" || !Number.isInteger(raw) || raw < 0 || raw > 100) {
      setClientError("Progres harus bilangan bulat 0 sampai 100.");
      return;
    }
    setClientError(null);
    mutation.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status:</span>
        <ActivityStatusBadge status={activity.status} label={activity.status_label} />
        <span className="tabular ml-auto text-xs text-muted-foreground">Sekarang {activity.progress_pct}%</span>
      </div>

      <Field
        label="Progres (%)"
        htmlFor="activity-progress"
        required
        error={progressError}
        hint={
          activity.status === "open"
            ? "Mengisi progres di atas 0% otomatis mengubah status menjadi On Progress."
            : "Untuk menandai selesai, ubah status menjadi Closed (progres otomatis 100%)."
        }
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(event) => setProgress(event.target.value)}
            disabled={busy}
            aria-label="Geser progres"
            className="h-2 min-w-0 flex-1 cursor-pointer accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Input
            id="activity-progress"
            name="progress_pct"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={progress}
            onChange={(event) => setProgress(event.target.value)}
            disabled={busy}
            invalid={!!progressError}
            className="tabular w-24 text-right"
          />
        </div>
      </Field>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilihan cepat progres">
        {QUICK_STEPS.map((step) => (
          <Button
            key={step}
            type="button"
            size="xs"
            variant={value === step ? "soft" : "outline"}
            onClick={() => setProgress(String(step))}
            disabled={busy}
            className={cn("tabular min-w-[3rem]")}
          >
            {step}%
          </Button>
        ))}
      </div>
      <ProgressBar value={value} label="Pratinjau progres" trackClassName="h-2" />

      <Field label="Remarks" htmlFor="activity-progress-remarks" error={firstError(errors, "remarks")}>
        <Textarea
          id="activity-progress-remarks"
          name="remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          rows={3}
          placeholder="Perkembangan terakhir, kendala, atau rencana berikutnya…"
          disabled={busy}
          invalid={!!firstError(errors, "remarks")}
        />
      </Field>

      <FieldError message={unmatchedValidationMessage(mutation.error, FIELD_KEYS)} />

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" loading={busy}>
          Simpan Progres
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Progress + remarks update: the only fields a PIC may change directly. */
export function ActivityProgressDialog({ open, onOpenChange, programId, activity }: ActivityProgressDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Progres</DialogTitle>
          {activity ? <DialogDescription className="line-clamp-2">{activity.title}</DialogDescription> : null}
        </DialogHeader>
        {open && activity ? (
          <ProgressForm key={activity.id} programId={programId} activity={activity} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
