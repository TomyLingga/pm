"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/layout/current-user";
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
import {
  DAILY_ACTIVITY_LIST_PREFIX,
  createDailyActivity,
  listDailyActivityPeople,
  updateDailyActivity,
} from "@/lib/daily-activities";
import { ACTIVITY_STATUS_OPTIONS, todayIso } from "@/lib/daily-activity-constants";
import { queryKeys } from "@/lib/query-keys";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import type {
  DailyActivity,
  DailyActivityDetail,
  DailyActivityPayload,
  DailyActivityStatus,
  DailyActivityUpdatePayload,
} from "@/types/daily-activity";

interface ActivityFormDialogProps {
  /** Report to edit; omit to create a new one. */
  activity?: DailyActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `meta.can_report_for_others`: offers the PIC select on create. */
  canReportForOthers?: boolean;
  onSaved?: (activity: DailyActivity) => void;
}

const FIELD_KEYS = ["activity_date", "title", "description", "follow_up", "obstacles", "status", "user_id"];

function ActivityForm({
  activity,
  canReportForOthers,
  onDone,
  onSaved,
}: {
  activity?: DailyActivity | null;
  canReportForOthers: boolean;
  onDone: () => void;
  onSaved?: (activity: DailyActivity) => void;
}) {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const editing = !!activity;
  const showPeople = !editing && canReportForOthers;

  const people = useQuery({
    queryKey: queryKeys.dailyActivityPeople(""),
    queryFn: ({ signal }) => listDailyActivityPeople("", signal),
    enabled: showPeople,
    staleTime: 5 * 60 * 1000,
  });

  const [activityDate, setActivityDate] = React.useState(activity?.activity_date ?? todayIso());
  const [title, setTitle] = React.useState(activity?.title ?? "");
  const [description, setDescription] = React.useState(activity?.description ?? "");
  const [followUp, setFollowUp] = React.useState(activity?.follow_up ?? "");
  const [obstacles, setObstacles] = React.useState(activity?.obstacles ?? "");
  const [status, setStatus] = React.useState<DailyActivityStatus>("open");
  /** "" = on my own behalf. */
  const [userId, setUserId] = React.useState("");
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: DailyActivityPayload | DailyActivityUpdatePayload) =>
      activity
        ? updateDailyActivity(activity.id, payload as DailyActivityUpdatePayload)
        : createDailyActivity(payload as DailyActivityPayload),
    onSuccess: (saved: DailyActivity | DailyActivityDetail) => {
      void queryClient.invalidateQueries({ queryKey: DAILY_ACTIVITY_LIST_PREFIX });
      if (activity) {
        // PUT answers with the detail (logs + permissions); keep it when it is one.
        if ("permissions" in saved) queryClient.setQueryData(queryKeys.dailyActivity(saved.id), saved);
        else void queryClient.invalidateQueries({ queryKey: queryKeys.dailyActivity(saved.id) });
      }
      toast.success(activity ? "Laporan aktivitas disimpan." : "Laporan aktivitas ditambahkan.");
      onSaved?.(saved);
      onDone();
    },
  });

  const serverErrors = validationErrors(mutation.error);
  const errorFor = (key: string) => clientErrors[key] ?? firstError(serverErrors, key);
  const isValidationError = mutation.error instanceof ApiError && mutation.error.status === 422;
  const generalError = mutation.error
    ? isValidationError
      ? unmatchedValidationMessage(mutation.error, FIELD_KEYS)
      : errorMessage(mutation.error, "Gagal menyimpan laporan aktivitas.")
    : undefined;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const errors: Record<string, string> = {};
    if (!activityDate) errors.activity_date = "Tanggal aktivitas wajib diisi.";
    if (!title.trim()) errors.title = "Judul laporan wajib diisi.";
    if (!description.trim()) errors.description = "Uraian kegiatan wajib diisi.";
    setClientErrors(errors);
    if (Object.keys(errors).length) return;

    const common = {
      activity_date: activityDate,
      title: title.trim(),
      description: description.trim(),
      follow_up: followUp.trim() || null,
      obstacles: obstacles.trim() || null,
    };
    if (activity) {
      mutation.mutate(common satisfies DailyActivityUpdatePayload);
      return;
    }
    const payload: DailyActivityPayload = { ...common, status };
    if (showPeople && userId) payload.user_id = Number(userId);
    mutation.mutate(payload);
  };

  const pending = mutation.isPending;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <Field label="Tanggal aktivitas" htmlFor="activity-date" required error={errorFor("activity_date")}>
          <Input
            id="activity-date"
            type="date"
            value={activityDate}
            onChange={(event) => setActivityDate(event.target.value)}
            disabled={pending}
            invalid={!!errorFor("activity_date")}
            className="tabular"
          />
        </Field>
        <Field label="Judul laporan" htmlFor="activity-title" required error={errorFor("title")}>
          <Input
            id="activity-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Contoh: Pengecekan jaringan lantai 2"
            maxLength={250}
            autoComplete="off"
            disabled={pending}
            invalid={!!errorFor("title")}
          />
        </Field>
      </div>

      <Field
        label="Uraian kegiatan"
        htmlFor="activity-description"
        required
        error={errorFor("description")}
        hint="Apa yang dikerjakan hari ini, cukup ringkas dan jelas."
      >
        <Textarea
          id="activity-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          maxLength={4000}
          disabled={pending}
          invalid={!!errorFor("description")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tindak lanjut" htmlFor="activity-follow-up" error={errorFor("follow_up")}>
          <Textarea
            id="activity-follow-up"
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Langkah berikutnya (opsional)"
            disabled={pending}
            invalid={!!errorFor("follow_up")}
            className="min-h-[80px]"
          />
        </Field>
        <Field label="Kendala" htmlFor="activity-obstacles" error={errorFor("obstacles")}>
          <Textarea
            id="activity-obstacles"
            value={obstacles}
            onChange={(event) => setObstacles(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Hambatan yang ditemui (opsional)"
            disabled={pending}
            invalid={!!errorFor("obstacles")}
            className="min-h-[80px]"
          />
        </Field>
      </div>

      {!editing ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status awal" htmlFor="activity-status" error={errorFor("status")}>
            <Select
              id="activity-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as DailyActivityStatus)}
              disabled={pending}
              invalid={!!errorFor("status")}
            >
              {ACTIVITY_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.description})
                </option>
              ))}
            </Select>
          </Field>
          {showPeople ? (
            <Field
              label="Penanggung jawab (PIC)"
              htmlFor="activity-user"
              error={errorFor("user_id")}
              hint="Kosongkan bila laporan ini atas nama Anda sendiri."
            >
              <Select
                id="activity-user"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                disabled={pending || people.isPending}
                invalid={!!errorFor("user_id")}
              >
                <option value="">{people.isPending ? "Memuat…" : `${me.name} (saya sendiri)`}</option>
                {people.data
                  ?.filter((person) => person.id !== me.id)
                  .map((person) => (
                    <option key={person.id} value={String(person.id)}>
                      {person.name}
                      {person.org_unit?.name ? ` (${person.org_unit.name})` : ""}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : null}
        </div>
      ) : null}

      <FieldError message={generalError} />

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={pending}>
          Batal
        </Button>
        <Button type="submit" loading={pending}>
          {editing ? "Simpan Perubahan" : "Simpan Aktivitas"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create or edit a daily-activity report. Status and PIC can only be set on create (see contract, PUT). */
export function ActivityFormDialog({ activity, open, onOpenChange, canReportForOthers = false, onSaved }: ActivityFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{activity ? "Ubah Laporan Aktivitas" : "Tambah Aktivitas"}</DialogTitle>
          <DialogDescription>
            {activity
              ? "Perbarui isi laporan. Status diubah lewat tombol Update Status."
              : "Catat kegiatan harian: apa yang dikerjakan, tindak lanjut, dan kendalanya."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ActivityForm
            activity={activity}
            canReportForOthers={canReportForOthers}
            onDone={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
