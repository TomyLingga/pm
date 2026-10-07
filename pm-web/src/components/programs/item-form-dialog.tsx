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
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import { addWorkProgramItem, updateWorkProgramItem } from "@/lib/work-programs";
import type { WorkProgramDetail, WorkProgramItem } from "@/types/work-program";
import { useWorkProgramCache } from "./use-work-program";

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: number;
  /** Programme code, used to suggest the next sub-item code ("A.3"). */
  programCode: string;
  existingCodes: string[];
  /** Present = edit mode. */
  item?: WorkProgramItem;
  /** Receives the fresh detail and the id of the created / edited sub-item. */
  onSaved?: (detail: WorkProgramDetail, itemId: number | null) => void;
}

const FIELD_KEYS = ["code", "title", "description"];

/** "A.1", "A.2" taken -> "A.3". */
function suggestCode(programCode: string, existing: string[]): string {
  const prefix = `${programCode}.`;
  const used = new Set(existing.map((code) => code.toUpperCase()));
  for (let n = 1; n < 100; n += 1) {
    const candidate = `${prefix}${n}`;
    if (!used.has(candidate.toUpperCase())) return candidate;
  }
  return "";
}

function ItemForm({
  programId,
  programCode,
  existingCodes,
  item,
  onSaved,
  onCancel,
}: Omit<ItemFormDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const cache = useWorkProgramCache(programId);
  const editing = !!item;
  const [code, setCode] = React.useState(() => item?.code ?? suggestCode(programCode, existingCodes));
  const [title, setTitle] = React.useState(item?.title ?? "");
  const [description, setDescription] = React.useState(item?.description ?? "");
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { code: code.trim(), title: title.trim(), description: description.trim() || null };
      return editing ? updateWorkProgramItem(item.id, payload) : addWorkProgramItem(programId, payload);
    },
    onSuccess: (detail) => {
      cache.applyDetail(detail);
      const saved = editing
        ? detail.items.find((candidate) => candidate.id === item.id)
        : detail.items.find((candidate) => candidate.code.toUpperCase() === code.trim().toUpperCase());
      toast.success(editing ? "Sub-item disimpan." : `Sub-item ${code.trim()} ditambahkan.`);
      onSaved?.(detail, saved?.id ?? null);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) return;
      toast.error(errorMessage(error));
    },
  });
  const errors = validationErrors(mutation.error);
  const errorFor = (key: string) => clientErrors[key] ?? firstError(errors, key);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const trimmed = code.trim();
    if (!trimmed) next.code = "Kode sub-item wajib diisi.";
    else if (
      existingCodes.some((existing) => existing.toUpperCase() === trimmed.toUpperCase() && existing !== item?.code)
    ) {
      next.code = "Kode sudah dipakai sub-item lain di program ini.";
    }
    if (!title.trim()) next.title = "Judul sub-item wajib diisi.";
    setClientErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  const busy = mutation.isPending;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Field label="Kode" htmlFor="item-code" required error={errorFor("code")} hint="Unik dalam program.">
          <Input
            id="item-code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={15}
            placeholder={`${programCode}.1`}
            autoComplete="off"
            disabled={busy}
            invalid={!!errorFor("code")}
            className="font-mono uppercase"
          />
        </Field>
        <Field label="Judul sub-item" htmlFor="item-title" required error={errorFor("title")}>
          <Input
            id="item-title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder="Contoh: IT Development"
            autoComplete="off"
            disabled={busy}
            invalid={!!errorFor("title")}
          />
        </Field>
      </div>

      <Field label="Deskripsi (opsional)" htmlFor="item-description" error={errorFor("description")}>
        <Textarea
          id="item-description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Ruang lingkup sub-item…"
          disabled={busy}
          invalid={!!errorFor("description")}
        />
      </Field>

      <FieldError message={unmatchedValidationMessage(mutation.error, FIELD_KEYS)} />

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" loading={busy}>
          {editing ? "Simpan Sub-Item" : "Tambah Sub-Item"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Add / edit a sub-item (A.1, A.2, ...) of a programme. */
export function ItemFormDialog({ open, onOpenChange, item, onSaved, ...formProps }: ItemFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? `Ubah Sub-Item ${item.code}` : "Tambah Sub-Item"}</DialogTitle>
          <DialogDescription>
            {item ? "Perbarui kode, judul, atau deskripsi sub-item." : "Sub-item mengelompokkan kegiatan di dalam program."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ItemForm
            {...formProps}
            item={item}
            onSaved={(detail, itemId) => {
              onOpenChange(false);
              onSaved?.(detail, itemId);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
