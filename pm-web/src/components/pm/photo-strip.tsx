"use client";

import * as React from "react";
import { Camera, FileText, ImagePlus, Loader2, X } from "lucide-react";
import { sameOriginUrl } from "@/components/common/attachments-panel";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { errorMessage } from "@/lib/api";
import { deleteAttachment } from "@/lib/attachments";
import { ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_BYTES, PHOTO_MIME_TYPES } from "@/lib/constants";
import { compressImage } from "@/lib/image";
import { cn, formatBytes } from "@/lib/utils";
import type { Attachment } from "@/types/work-order";

interface PhotoStripProps {
  attachments: Attachment[];
  /** Maximum number of files for this slot (10 general, 5 per checklist item). */
  max: number;
  /** Show the camera / gallery buttons. */
  canAdd: boolean;
  canDelete?: (attachment: Attachment) => boolean;
  upload?: (file: File) => Promise<unknown>;
  /** Called after uploads/deletes so the parent can refresh the task. */
  onChanged?: () => Promise<unknown> | void;
  /** Also accept PDF from the file picker (general task attachments). */
  allowPdf?: boolean;
  /** Text shown when there is nothing and nothing can be added. */
  emptyText?: string;
  /** Thumbnail size. */
  size?: "sm" | "md";
  /** Accessible name of the slot, e.g. the checklist item. */
  label: string;
  className?: string;
}

const THUMB = { sm: "h-16 w-16", md: "h-20 w-20 sm:h-24 sm:w-24" };
/** Intrinsic size hint for the `<img>` (largest rendered size); CSS scales it to the slot. */
const THUMB_PX = { sm: 64, md: 96 };

/**
 * Photo thumbnails + "Foto" (opens the camera on phones via `capture`) and "Galeri" buttons.
 * Large photos are downscaled before upload so camera shots stay below the 5 MB limit.
 */
export function PhotoStrip({
  attachments,
  max,
  canAdd,
  canDelete,
  upload,
  onChanged,
  allowPdf = false,
  emptyText,
  size = "sm",
  label,
  className,
}: PhotoStripProps) {
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState<{ done: number; total: number } | null>(null);
  const [toDelete, setToDelete] = React.useState<Attachment | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const accepted = allowPdf ? ATTACHMENT_MIME_TYPES : PHOTO_MIME_TYPES;
  const remaining = Math.max(0, max - attachments.length);
  const addable = canAdd && !!upload && remaining > 0;

  const onFiles = async (list: FileList | null) => {
    if (!list?.length || !upload) return;
    const files = Array.from(list);
    const rejected: string[] = [];
    let uploaded = 0;

    for (let index = 0; index < files.length; index += 1) {
      setUploading({ done: index, total: files.length });
      const original = files[index];
      if (uploaded >= remaining) {
        rejected.push(`${original.name}: melebihi batas ${max} file`);
        continue;
      }
      // Camera files sometimes come without a MIME type; treat images leniently, the server validates.
      if (original.type && !accepted.includes(original.type) && !original.type.startsWith("image/")) {
        rejected.push(`${original.name}: format tidak didukung`);
        continue;
      }
      const file = await compressImage(original);
      if (file.size > MAX_ATTACHMENT_BYTES) {
        rejected.push(`${original.name}: ukuran ${formatBytes(file.size)} melebihi 5 MB`);
        continue;
      }
      try {
        await upload(file);
        uploaded += 1;
      } catch (error) {
        rejected.push(`${original.name}: ${errorMessage(error)}`);
      }
    }
    setUploading(null);

    if (uploaded > 0) await onChanged?.();
    if (rejected.length) {
      toast.error("Sebagian file gagal diunggah", {
        description: (
          <ul className="list-disc space-y-0.5 pl-4">
            {rejected.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ),
        duration: 10000,
      });
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteAttachment(toDelete.id);
      setToDelete(null);
      await onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  if (attachments.length === 0 && !canAdd) {
    return emptyText ? <p className={cn("text-xs text-muted-foreground", className)}>{emptyText}</p> : null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {attachments.length > 0 || uploading ? (
        <ul className="flex flex-wrap gap-2" aria-label={`Foto ${label}`}>
          {attachments.map((attachment) => {
            const url = sameOriginUrl(attachment.url);
            const isImage = attachment.mime_type?.startsWith("image/");
            return (
              <li
                key={attachment.id}
                className={cn("relative overflow-hidden rounded-md border bg-surface-2", THUMB[size])}
              >
                <a
                  href={url}
                  target="_blank"
                  rel="noopener"
                  className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  title={attachment.original_name}
                  aria-label={`Buka ${attachment.original_name}`}
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin file
                    <img
                      src={url}
                      alt={`Foto ${label}: ${attachment.original_name}`}
                      width={THUMB_PX[size]}
                      height={THUMB_PX[size]}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center">
                      <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
                      <span className="line-clamp-2 break-all text-[9px] leading-tight">{attachment.original_name}</span>
                    </span>
                  )}
                </a>
                {canDelete?.(attachment) ? (
                  <button
                    type="button"
                    onClick={() => setToDelete(attachment)}
                    className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/70 text-background shadow-sm transition-colors duration-150 hover:bg-danger hover:text-danger-on-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Hapus ${attachment.original_name}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
          {uploading ? (
            <li
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-surface-2 text-muted-foreground",
                THUMB[size],
              )}
              role="status"
              aria-label={`Mengunggah foto ${uploading.done + 1} dari ${uploading.total}`}
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span className="tabular text-[10px]">
                {uploading.done + 1}/{uploading.total}
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}

      {canAdd ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => cameraRef.current?.click()}
            disabled={!addable || !!uploading}
            aria-label={`Ambil foto untuk ${label}`}
          >
            <Camera />
            Foto
          </Button>
          <Button
            variant="ghost"
            onClick={() => galleryRef.current?.click()}
            disabled={!addable || !!uploading}
            aria-label={`Pilih file dari galeri untuk ${label}`}
          >
            <ImagePlus />
            Galeri
          </Button>
          <span className="tabular text-[11px] text-muted-foreground">
            {attachments.length}/{max}
          </span>
          {/* `capture` opens the rear camera directly on phones; desktop browsers show the file picker. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              void onFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept={accepted.join(",")}
            multiple
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              void onFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Hapus foto?"
        description={toDelete ? `"${toDelete.original_name}" akan dihapus permanen.` : undefined}
        confirmLabel="Hapus Foto"
        confirmVariant="destructive"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
