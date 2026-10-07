"use client";

import * as React from "react";
import { Camera, FileText, Paperclip, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useObjectUrls } from "@/hooks/use-object-urls";
import { MAX_ATTACHMENT_BYTES, PHOTO_MIME_TYPES } from "@/lib/constants";
import { cn, formatBytes } from "@/lib/utils";

const EXTENSION_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "application/pdf": "PDF",
};

interface FilePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  /** Remaining slots for this document. */
  max: number;
  /** Allowed MIME types (default: photos). */
  accept?: string[];
  disabled?: boolean;
}

/** Multiple file picker (max 5 MB each) with image previews and file tiles for PDFs. */
export function FilePicker({ files, onChange, max, accept = PHOTO_MIME_TYPES, disabled }: FilePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previews = useObjectUrls(files);
  const remaining = Math.max(0, max - files.length);
  const photosOnly = accept.every((type) => type.startsWith("image/"));
  const formats = accept.map((type) => EXTENSION_LABELS[type] ?? type).join("/");
  const noun = photosOnly ? "foto" : "file";

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(list)) {
      if (!accept.includes(file.type)) {
        rejected.push(`${file.name}: format harus ${formats}`);
      } else if (file.size > MAX_ATTACHMENT_BYTES) {
        rejected.push(`${file.name}: ukuran ${formatBytes(file.size)} melebihi 5 MB`);
      } else if (accepted.length >= remaining) {
        rejected.push(`${file.name}: melebihi batas ${max} ${noun}`);
      } else {
        accepted.push(file);
      }
    }
    if (accepted.length) onChange([...files, ...accepted]);
    if (rejected.length) {
      toast.warning(`Sebagian ${noun} tidak ditambahkan`, {
        description: (
          <ul className="list-disc space-y-0.5 pl-4">
            {rejected.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ),
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {files.map((file, index) => {
          const isImage = file.type.startsWith("image/");
          return (
            <figure
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="relative aspect-square overflow-hidden rounded-lg border bg-surface-2"
            >
              {isImage && previews[index] ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img
                  src={previews[index]}
                  alt={file.name}
                  width={240}
                  height={240}
                  className="h-full w-full object-cover"
                />
              ) : !isImage ? (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
                  <FileText className="h-7 w-7 text-muted-foreground" aria-hidden />
                  <span className="line-clamp-2 break-all text-[11px]">{file.name}</span>
                </span>
              ) : null}
              <figcaption className="tabular absolute inset-x-0 bottom-0 truncate border-t bg-background/85 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
                {formatBytes(file.size)}
              </figcaption>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                disabled={disabled}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-colors duration-150 hover:border-danger hover:bg-danger hover:text-danger-on-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                aria-label={`Hapus ${file.name}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </figure>
          );
        })}

        {remaining > 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-surface-2/40 text-muted-foreground transition-colors duration-150 hover:border-primary/60 hover:bg-primary-soft/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {photosOnly ? <Camera className="h-6 w-6" aria-hidden /> : <Paperclip className="h-6 w-6" aria-hidden />}
            <span className="text-xs font-medium">Tambah {noun}</span>
          </button>
        ) : null}
      </div>
      <p className="tabular text-xs text-muted-foreground" aria-live="polite">
        {formats}, maks. 5&nbsp;MB per {noun}. {files.length}/{max} {noun} dipilih.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(",")}
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
