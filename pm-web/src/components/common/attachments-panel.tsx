"use client";

import * as React from "react";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { errorMessage } from "@/lib/api";
import { ATTACHMENT_COLLECTION_LABELS, ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { formatBytes } from "@/lib/utils";
import { deleteAttachment } from "@/lib/attachments";
import type { Attachment, AttachmentCollection } from "@/types/work-order";
import { Section } from "./section";

/**
 * Attachment URLs are expected to be relative (`/api/v1/attachments/{id}`). If the backend
 * ever returns an absolute URL to its own host, rewrite it to the same-origin proxy path so
 * the session cookie is sent.
 */
export function sameOriginUrl(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin && parsed.pathname.startsWith("/api/")) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // keep as is
  }
  return url;
}

interface AttachmentsPanelProps {
  attachments: Attachment[];
  canUpload: boolean;
  /** Whether the current user may delete this attachment. */
  canDelete: (attachment: Attachment) => boolean;
  upload: (file: File, collection: AttachmentCollection) => Promise<unknown>;
  /** Called after uploads/deletes so the parent can refetch. */
  onChanged: () => Promise<unknown> | void;
  /** Collections shown (in this order). */
  collections: AttachmentCollection[];
  collectionLabels?: Partial<Record<AttachmentCollection, string>>;
  /** Picks the collection per file; when set, no collection selector is shown. */
  collectionFor?: (file: File) => AttachmentCollection;
  defaultCollection?: AttachmentCollection;
  /** Maximum number of attachments for the document (omit for no client-side cap). */
  maxFiles?: number;
}

export function AttachmentsPanel({
  attachments,
  canUpload,
  canDelete,
  upload,
  onChanged,
  collections,
  collectionLabels,
  collectionFor,
  defaultCollection,
  maxFiles,
}: AttachmentsPanelProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [collection, setCollection] = React.useState<AttachmentCollection>(defaultCollection ?? collections[0]);
  const [uploading, setUploading] = React.useState<{ done: number; total: number } | null>(null);
  const [toDelete, setToDelete] = React.useState<Attachment | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const labelOf = (key: AttachmentCollection) => collectionLabels?.[key] ?? ATTACHMENT_COLLECTION_LABELS[key];
  const remaining = maxFiles === undefined ? Infinity : maxFiles - attachments.length;

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const rejected: string[] = [];
    const accepted: File[] = [];
    for (const file of Array.from(list)) {
      if (!ATTACHMENT_MIME_TYPES.includes(file.type)) rejected.push(`${file.name}: format tidak didukung`);
      else if (file.size > MAX_ATTACHMENT_BYTES) rejected.push(`${file.name}: melebihi 5 MB`);
      else if (accepted.length >= remaining) rejected.push(`${file.name}: melebihi batas ${maxFiles} lampiran`);
      else accepted.push(file);
    }

    let failed = 0;
    for (let index = 0; index < accepted.length; index += 1) {
      setUploading({ done: index, total: accepted.length });
      const file = accepted[index];
      const target = collectionFor
        ? collectionFor(file)
        : file.type === "application/pdf" && collections.includes("document")
          ? "document"
          : collection;
      try {
        await upload(file, target);
      } catch (error) {
        failed += 1;
        rejected.push(`${file.name}: ${errorMessage(error)}`);
      }
    }
    setUploading(null);

    if (accepted.length - failed > 0) {
      toast.success(`${accepted.length - failed} lampiran berhasil diunggah.`);
      await onChanged();
    }
    if (rejected.length) {
      toast.error("Sebagian lampiran gagal", {
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
      toast.success("Lampiran dihapus.");
      setToDelete(null);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const known = new Set(collections);
  const groups = [
    ...collections.map((key) => ({ key, label: labelOf(key), items: attachments.filter((a) => a.collection === key) })),
    {
      key: "other" as const,
      label: "Lainnya",
      items: attachments.filter((a) => !known.has(a.collection)),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <Section title="Lampiran" icon={<Paperclip className="h-4 w-4" aria-hidden />}>
      <div className="space-y-4">
        {canUpload ? (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-surface-2/40 p-3 sm:flex-row sm:items-center">
            {collectionFor ? null : (
              <Select
                aria-label="Jenis lampiran"
                value={collection}
                onChange={(event) => setCollection(event.target.value as AttachmentCollection)}
                disabled={!!uploading}
                wrapperClassName="sm:w-48"
              >
                {collections.map((key) => (
                  <option key={key} value={key}>
                    {labelOf(key)}
                  </option>
                ))}
              </Select>
            )}
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={remaining <= 0}
              loading={!!uploading}
            >
              {uploading ? null : <Upload aria-hidden />}
              {uploading ? `Mengunggah ${uploading.done + 1}/${uploading.total}…` : "Unggah lampiran"}
            </Button>
            <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
              {remaining <= 0
                ? `Batas ${maxFiles} lampiran tercapai.`
                : `JPG/PNG/WEBP/PDF, maks. 5 MB${Number.isFinite(remaining) ? `. Sisa ${remaining} dari ${maxFiles}` : ""}.`}
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ATTACHMENT_MIME_TYPES.join(",")}
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

        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada lampiran.</p>
        ) : (
          groups.map((group) => (
            <div key={group.key}>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{group.label}</p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.items.map((attachment) => {
                  const url = sameOriginUrl(attachment.url);
                  return (
                    <li key={attachment.id} className="relative min-w-0 overflow-hidden rounded-lg border bg-card">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener"
                        className="block bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        {attachment.mime_type.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin file
                          <img
                            src={url}
                            alt={attachment.original_name}
                            loading="lazy"
                            width={320}
                            height={320}
                            className="aspect-square h-auto w-full object-cover"
                          />
                        ) : (
                          <span className="flex aspect-square w-full flex-col items-center justify-center gap-2 p-2 text-center">
                            <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
                            <span className="line-clamp-2 break-all text-xs">{attachment.original_name}</span>
                          </span>
                        )}
                      </a>
                      <div className="space-y-0.5 border-t p-2">
                        <p className="truncate text-xs font-medium" title={attachment.original_name}>
                          {attachment.original_name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {formatBytes(attachment.size_bytes)} &middot; {attachment.uploaded_by?.name}
                        </p>
                        <p className="tabular text-[11px] text-muted-foreground">{formatDateTime(attachment.created_at)}</p>
                      </div>
                      {canDelete(attachment) ? (
                        <button
                          type="button"
                          onClick={() => setToDelete(attachment)}
                          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-colors duration-150 hover:border-danger hover:bg-danger hover:text-danger-on-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Hapus ${attachment.original_name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Hapus lampiran?"
        description={toDelete ? `"${toDelete.original_name}" akan dihapus permanen.` : undefined}
        confirmLabel="Hapus"
        confirmVariant="destructive"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </Section>
  );
}
