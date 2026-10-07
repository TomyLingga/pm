"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Crown, X } from "lucide-react";
import { SuggestInput } from "@/components/common/suggest-input";
import { UserAvatar } from "@/components/common/user-avatar";
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
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import { addWorkProgramActivity, searchWorkProgramPeople, updateWorkProgramActivity } from "@/lib/work-programs";
import type { WorkProgramActivity, WorkProgramPerson, WorkProgramPicRole } from "@/types/work-program";
import { useWorkProgramCache } from "./use-work-program";

interface ActivityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: number;
  itemId: number;
  /** "A.1 IT Development", shown in the description. */
  itemLabel: string;
  /** Present = edit mode (managers only; PICs use the progress / status dialogs). */
  activity?: WorkProgramActivity;
  onSaved?: () => void;
}

interface PickedPic {
  id: number;
  name: string;
  photo_url: string | null;
  meta: string;
  role: WorkProgramPicRole;
}

const FIELD_KEYS = ["title", "action_plan", "target_date", "remarks", "pics", "pics.*"];

const ROLE_OPTIONS: Array<{ value: WorkProgramPicRole; label: React.ReactNode }> = [
  {
    value: "utama",
    label: (
      <span className="inline-flex items-center gap-1">
        <Crown className="h-3 w-3" aria-hidden />
        Utama
      </span>
    ),
  },
  { value: "pendukung", label: "Pendukung" },
];

function personMeta(person: WorkProgramPerson): string {
  return [person.grade_code, person.position, person.org_unit?.name].filter(Boolean).join(" · ");
}

function ActivityForm({
  programId,
  itemId,
  activity,
  onSaved,
  onCancel,
}: Omit<ActivityFormDialogProps, "open" | "onOpenChange" | "itemLabel"> & { onCancel: () => void }) {
  const cache = useWorkProgramCache(programId);
  const editing = !!activity;

  const [title, setTitle] = React.useState(activity?.title ?? "");
  const [actionPlan, setActionPlan] = React.useState(activity?.action_plan ?? "");
  const [targetDate, setTargetDate] = React.useState(activity?.target_date ?? "");
  const [remarks, setRemarks] = React.useState(activity?.remarks ?? "");
  const [pics, setPics] = React.useState<PickedPic[]>(() =>
    (activity?.pics ?? []).map((pic) => ({
      id: pic.id,
      name: pic.name,
      photo_url: pic.photo_url,
      meta: pic.position ?? "",
      role: pic.role,
    })),
  );
  const [search, setSearch] = React.useState("");
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        action_plan: actionPlan.trim() || null,
        target_date: targetDate || null,
        remarks: remarks.trim() || null,
        pics: pics.map((pic) => ({ user_id: pic.id, role: pic.role })),
      };
      return editing ? updateWorkProgramActivity(activity.id, payload) : addWorkProgramActivity(itemId, payload);
    },
    onSuccess: () => {
      if (activity) cache.invalidateActivity(activity.id);
      else cache.invalidate();
      toast.success(editing ? "Kegiatan disimpan." : "Kegiatan ditambahkan. PIC baru mendapat notifikasi.");
      onSaved?.();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) return;
      toast.error(errorMessage(error));
    },
  });
  const errors = validationErrors(mutation.error);
  const errorFor = (key: string) => clientErrors[key] ?? firstError(errors, key);

  const addPic = (person: WorkProgramPerson) => {
    setPics((current) => {
      if (current.some((pic) => pic.id === person.id)) return current;
      const hasUtama = current.some((pic) => pic.role === "utama");
      return [
        ...current,
        { id: person.id, name: person.name, photo_url: person.photo_url, meta: personMeta(person), role: hasUtama ? "pendukung" : "utama" },
      ];
    });
  };

  /** At most one "utama": promoting someone demotes the previous one. */
  const setRole = (id: number, role: WorkProgramPicRole) => {
    setPics((current) =>
      current.map((pic) => {
        if (pic.id === id) return { ...pic, role };
        return role === "utama" && pic.role === "utama" ? { ...pic, role: "pendukung" } : pic;
      }),
    );
  };

  const removePic = (id: number) => setPics((current) => current.filter((pic) => pic.id !== id));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Nama kegiatan wajib diisi.";
    if (pics.filter((pic) => pic.role === "utama").length > 1) next.pics = "Hanya boleh satu PIC utama.";
    setClientErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  const busy = mutation.isPending;
  const picked = new Set(pics.map((pic) => pic.id));

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Project / Kegiatan" htmlFor="activity-title" required error={errorFor("title")}>
        <Input
          id="activity-title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={250}
          placeholder="Contoh: Implementasi e-Form Request"
          autoComplete="off"
          disabled={busy}
          invalid={!!errorFor("title")}
        />
      </Field>

      <Field
        label="Action to be taken"
        htmlFor="activity-action-plan"
        error={errorFor("action_plan")}
        hint="Langkah-langkah yang akan dilakukan; satu langkah per baris."
      >
        <Textarea
          id="activity-action-plan"
          name="action_plan"
          value={actionPlan}
          onChange={(event) => setActionPlan(event.target.value)}
          rows={4}
          placeholder={"1. Analisis kebutuhan\n2. Pengembangan\n3. Uji coba"}
          disabled={busy}
          invalid={!!errorFor("action_plan")}
        />
      </Field>

      <Field label="Target date" htmlFor="activity-target-date" error={errorFor("target_date")} className="sm:max-w-xs">
        <Input
          id="activity-target-date"
          name="target_date"
          type="date"
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
          disabled={busy}
          invalid={!!errorFor("target_date")}
          className="tabular"
        />
      </Field>

      <div className="space-y-2">
        <Label htmlFor="activity-pic-search">PIC (utama & pendukung)</Label>
        <SuggestInput<WorkProgramPerson>
          id="activity-pic-search"
          value={search}
          onValueChange={setSearch}
          onSelect={(person) => {
            addPic(person);
            setSearch("");
          }}
          queryKey={(q) => queryKeys.workProgramPeople(q)}
          fetcher={searchWorkProgramPeople}
          getKey={(person) => person.id}
          minChars={0}
          placeholder="Cari nama atau NRK…"
          emptyText="Tidak ada orang yang cocok."
          disabled={busy}
          invalid={!!errorFor("pics")}
          aria-label="Cari PIC"
          renderOption={(person) => (
            <span className={cn("flex items-center gap-3", picked.has(person.id) && "opacity-50")}>
              <UserAvatar name={person.name} photoUrl={person.photo_url} className="h-7 w-7 text-[10px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{person.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{personMeta(person) || person.nrk || ""}</span>
              </span>
              {picked.has(person.id) ? <span className="text-xs text-muted-foreground">Sudah dipilih</span> : null}
            </span>
          )}
        />
        {pics.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
            Belum ada PIC. Orang pertama yang dipilih menjadi PIC utama.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {pics.map((pic) => (
              <li key={pic.id} className="flex flex-wrap items-center gap-2 py-2 pl-3 pr-1 sm:flex-nowrap">
                <UserAvatar name={pic.name} photoUrl={pic.photo_url} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{pic.name}</span>
                  {pic.meta ? <span className="block truncate text-xs text-muted-foreground">{pic.meta}</span> : null}
                </span>
                <Segmented<WorkProgramPicRole>
                  name={`pic-role-${pic.id}`}
                  value={pic.role}
                  options={ROLE_OPTIONS}
                  onChange={(role) => setRole(pic.id, role)}
                  size="sm"
                  disabled={busy}
                  aria-label={`Peran ${pic.name}`}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => removePic(pic.id)}
                  disabled={busy}
                  aria-label={`Hapus ${pic.name} dari PIC`}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <FieldError message={errorFor("pics") ?? firstError(errors, "pics.*")} />
      </div>

      <Field label="Remarks (opsional)" htmlFor="activity-remarks" error={errorFor("remarks")}>
        <Textarea
          id="activity-remarks"
          name="remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          rows={2}
          placeholder="Catatan singkat…"
          disabled={busy}
          invalid={!!errorFor("remarks")}
        />
      </Field>

      <FieldError message={unmatchedValidationMessage(mutation.error, FIELD_KEYS)} />

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" loading={busy}>
          {editing ? "Simpan Kegiatan" : "Tambah Kegiatan"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Add / edit an activity of a sub-item, including its PICs (managers only). */
export function ActivityFormDialog({ open, onOpenChange, itemLabel, activity, onSaved, ...formProps }: ActivityFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{activity ? "Ubah Kegiatan" : "Tambah Kegiatan"}</DialogTitle>
          <DialogDescription>
            {activity ? `Kegiatan no. ${activity.sequence} pada sub-item ${itemLabel}.` : `Kegiatan baru pada sub-item ${itemLabel}.`}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ActivityForm
            {...formProps}
            activity={activity}
            onSaved={() => {
              onOpenChange(false);
              onSaved?.();
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
