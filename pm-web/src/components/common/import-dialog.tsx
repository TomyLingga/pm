"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Download, FileSpreadsheet, Upload } from "lucide-react";
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
import { toast } from "@/components/ui/sonner";
import { ApiError, api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Per-row messages the importers return as `errors["rows.<n>"]`. */
export interface ImportRowError {
  row: number;
  messages: string[];
}

export interface ImportResult {
  created?: number;
  updated?: number;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What the file is for, e.g. "laporan aktivitas harian". */
  description?: React.ReactNode;
  /** Absolute API path of the template download, e.g. `${API_PREFIX}/daily-activities/import-template`. */
  templateUrl: string;
  /** API path (without the prefix) the file is posted to, e.g. "/daily-activities/import". */
  uploadPath: string;
  /** Extra hints shown above the file input (one line each). */
  hints?: string[];
  /** Called after a successful import (the dialog closes itself). */
  onImported?: (result: ImportResult) => void;
  idPrefix?: string;
}

const ACCEPT = ".xlsx,.xls,.csv";
const MAX_BYTES = 5 * 1024 * 1024;

function parseRowErrors(errors: Record<string, string[]>): ImportRowError[] {
  return Object.entries(errors)
    .map(([key, messages]) => {
      const match = /^rows\.(\d+)$/.exec(key);
      return match ? { row: Number(match[1]), messages } : null;
    })
    .filter((entry): entry is ImportRowError => entry !== null)
    .sort((a, b) => a.row - b.row);
}

function summarize(result: ImportResult): string {
  const parts: string[] = [];
  if (result.created) parts.push(`${result.created} ditambahkan`);
  if (result.updated) parts.push(`${result.updated} diperbarui`);
  return parts.length > 0 ? parts.join(", ") : "Tidak ada perubahan";
}

function ImportForm({
  templateUrl,
  uploadPath,
  hints,
  onImported,
  onDone,
  idPrefix,
}: Pick<ImportDialogProps, "templateUrl" | "uploadPath" | "hints" | "onImported"> & { onDone: () => void; idPrefix: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [clientError, setClientError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (selected: File) => {
      const form = new FormData();
      form.append("file", selected);
      const res = await api.post<{ data: ImportResult }>(uploadPath, form);
      return res.data;
    },
    onSuccess: (result) => {
      toast.success(`Import selesai: ${summarize(result)}.`);
      onImported?.(result);
      onDone();
    },
  });

  const serverErrors = mutation.error instanceof ApiError ? mutation.error.errors : {};
  const rowErrors = parseRowErrors(serverErrors);
  const fileError = clientError ?? serverErrors.file?.[0];
  const generalError =
    mutation.error && !fileError && rowErrors.length === 0 ? errorMessage(mutation.error, "Import gagal.") : undefined;
  const pending = mutation.isPending;

  const choose = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    mutation.reset();
    if (selected && selected.size > MAX_BYTES) {
      setClientError("Ukuran file maksimal 5 MB.");
      setFile(null);
      return;
    }
    setClientError(null);
    setFile(selected);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!file) {
      setClientError("Pilih file Excel yang sudah diisi.");
      return;
    }
    mutation.mutate(file);
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <ol className="space-y-3 text-sm">
        <li className="flex items-start gap-3">
          <span className="tabular mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            1
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p>Unduh template, isi sheet <span className="font-medium">Data</span> mulai baris 2 (lihat sheet Contoh dan Petunjuk).</p>
            <Button asChild variant="outline" size="sm">
              <a href={templateUrl} download>
                <Download />
                Unduh template Excel
              </a>
            </Button>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="tabular mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            2
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p>Unggah file yang sudah diisi. Semua baris diperiksa dulu; bila ada yang bermasalah, tidak ada data yang diimpor.</p>
            {hints?.length ? (
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            ) : null}
            <Field label="File Excel" htmlFor={`${idPrefix}-file`} required error={fileError}>
              <input
                ref={inputRef}
                id={`${idPrefix}-file`}
                type="file"
                accept={ACCEPT}
                onChange={choose}
                disabled={pending}
                aria-invalid={!!fileError}
                className={cn(
                  "block w-full rounded-md border border-border bg-surface-1 text-sm text-foreground file:mr-3 file:rounded-l-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  fileError && "border-danger",
                )}
              />
            </Field>
            {file ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
                <span className="truncate">{file.name}</span>
                <span className="tabular shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
              </p>
            ) : null}
          </div>
        </li>
      </ol>

      {rowErrors.length > 0 ? (
        <div role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {rowErrors.length} baris bermasalah, tidak ada data yang diimpor
          </p>
          <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto text-xs">
            {rowErrors.map((entry) => (
              <li key={entry.row} className="rounded-sm bg-background/60 p-2">
                <span className="tabular font-semibold">Baris {entry.row}:</span>{" "}
                {entry.messages.join(" ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <FieldError message={generalError} />

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={pending}>
          Batal
        </Button>
        <Button type="submit" loading={pending} disabled={!file}>
          <Upload />
          Import
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Two-step Excel import used by the equipment master and Aktivitas Harian:
 * download the template, upload the filled file, show per-row errors from `errors["rows.<n>"]`.
 */
export function ImportDialog({
  open,
  onOpenChange,
  title,
  description,
  templateUrl,
  uploadPath,
  hints,
  onImported,
  idPrefix = "import",
}: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {open ? (
          <ImportForm
            templateUrl={templateUrl}
            uploadPath={uploadPath}
            hints={hints}
            onImported={onImported}
            onDone={() => onOpenChange(false)}
            idPrefix={idPrefix}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
