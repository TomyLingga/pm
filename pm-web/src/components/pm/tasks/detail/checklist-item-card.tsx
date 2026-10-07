"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Camera, Check, MessageSquarePlus, Minus, Wrench, X, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";
import { Textarea } from "@/components/ui/textarea";
import { PM_MAX_ITEM_PHOTOS } from "@/lib/pm-constants";
import { cn } from "@/lib/utils";
import type { ItemResult, PmTaskItem } from "@/types/pm";
import type { Attachment } from "@/types/work-order";
import { PhotoStrip } from "../../photo-strip";
import { effectiveResult, parseNumberInput, rangeHint, rangeState, type ItemAnswer } from "./checklist-model";

/** Solid semantic fill of the selected result: OK = success, Tidak OK = danger, N/A = neutral. */
const RESULT_ACTIVE: Record<ItemResult, string> = {
  ok: "bg-success text-success-on-solid shadow-sm",
  not_ok: "bg-danger text-danger-on-solid shadow-sm",
  na: "bg-muted-foreground text-background shadow-sm",
};

function ResultLabel({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-4 w-4" aria-hidden />
      {text}
    </span>
  );
}

const RESULT_OPTIONS: Array<SegmentedOption<ItemResult>> = [
  { value: "ok", label: <ResultLabel icon={Check} text="OK" />, activeClassName: RESULT_ACTIVE.ok },
  { value: "not_ok", label: <ResultLabel icon={X} text="Tidak OK" />, activeClassName: RESULT_ACTIVE.not_ok },
  { value: "na", label: <ResultLabel icon={Minus} text="N/A" />, activeClassName: RESULT_ACTIVE.na },
];

/** Left accent (and tint for findings) once the item has a result. */
const CARD_TONE: Record<ItemResult, string> = {
  ok: "border-l-success",
  not_ok: "border-l-danger bg-danger-soft/40",
  na: "border-l-muted-foreground/50",
};

/** The position bubble takes the result tone so answered items stand out while scrolling. */
const POSITION_TONE: Record<ItemResult, string> = {
  ok: "bg-success-soft text-success-foreground",
  not_ok: "bg-danger text-danger-on-solid",
  na: "bg-surface-3 text-muted-foreground",
};

const naToggleClassName =
  "w-14 shrink-0 rounded-md border text-sm font-semibold shadow-sm transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const findingBoxClassName = "mt-3 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger-foreground";

export interface ChecklistItemCardProps {
  item: PmTaskItem;
  /** 1-based position in the whole checklist. */
  position: number;
  answer: ItemAnswer;
  onChange: (itemId: number, patch: Partial<ItemAnswer>) => void;
  /** Validation message (required item / photo missing), e.g. from the 422 of "complete". */
  error?: string;
  disabled?: boolean;
  canCreateWorkOrder: boolean;
  onCreateWorkOrder: (itemId: number) => void;
  uploadPhoto: (itemId: number, file: File) => Promise<unknown>;
  onPhotosChanged: (itemId: number) => Promise<unknown> | void;
  canDeletePhoto: (attachment: Attachment) => boolean;
}

/** One checklist item with large, touch-friendly controls (technicians fill this in on phones). */
export const ChecklistItemCard = React.memo(function ChecklistItemCard({
  item,
  position,
  answer,
  onChange,
  error,
  disabled,
  canCreateWorkOrder,
  onCreateWorkOrder,
  uploadPhoto,
  onPhotosChanged,
  canDeletePhoto,
}: ChecklistItemCardProps) {
  const result = effectiveResult(item, answer);
  const isNa = answer.result === "na";
  const [notesOpen, setNotesOpen] = React.useState(() => !!answer.notes || result === "not_ok");

  // A finding needs an explanation: open the notes field as soon as the result turns "Tidak OK".
  React.useEffect(() => {
    if (result === "not_ok") setNotesOpen(true);
  }, [result]);

  const parsed = item.input_type === "number" ? parseNumberInput(answer.valueNumber) : null;
  const range = item.input_type === "number" ? rangeState(item, parsed) : null;
  const hint = item.input_type === "number" ? rangeHint(item) : null;
  const upload = React.useCallback((file: File) => uploadPhoto(item.id, file), [item.id, uploadPhoto]);
  const photosChanged = React.useCallback(() => onPhotosChanged(item.id), [item.id, onPhotosChanged]);
  const photoMissing = item.photo_required && item.attachments.length === 0;

  return (
    <li
      id={`pm-item-${item.id}`}
      className={cn(
        "scroll-mt-24 rounded-xl border border-l-4 bg-card p-4 shadow-sm shadow-edge sm:p-5",
        result ? CARD_TONE[result] : "border-l-border",
        error && "ring-2 ring-danger ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "tabular mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
            result ? POSITION_TONE[result] : "bg-surface-2 text-muted-foreground",
          )}
        >
          {position}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-snug">
            {item.description}
            {item.is_required ? (
              <span className="ml-1 text-destructive" title="Wajib diisi" aria-hidden>
                *
              </span>
            ) : null}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-medium text-muted-foreground">
              {item.is_required ? "Wajib" : "Opsional"}
            </span>
            {item.photo_required ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium",
                  photoMissing ? "bg-warning-soft text-warning-foreground" : "bg-success-soft text-success-foreground",
                )}
              >
                <Camera className="h-3 w-3" aria-hidden />
                Foto wajib
              </span>
            ) : null}
            {hint ? <span className="tabular text-muted-foreground">{hint}</span> : null}
          </div>
        </div>
      </div>

      {/* ---- Answer controls ---- */}
      <div className="mt-3">
        {item.input_type === "ok_nok_na" ? (
          <Segmented
            name={`pm-item-${item.id}-result`}
            value={answer.result}
            options={RESULT_OPTIONS}
            onChange={(value) => onChange(item.id, { result: value })}
            disabled={disabled}
            aria-label={item.description}
            className="grid w-full grid-cols-3 [&_label]:h-12 [&_label]:font-semibold"
          />
        ) : (
          <div className="flex items-stretch gap-2">
            <div className="min-w-0 flex-1">
              {item.input_type === "number" ? (
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    value={isNa ? "" : answer.valueNumber}
                    onChange={(event) => onChange(item.id, { valueNumber: event.target.value })}
                    placeholder={isNa ? "Ditandai N/A" : "Masukkan angka…"}
                    disabled={disabled || isNa}
                    invalid={parsed === undefined && !isNa}
                    aria-label={`${item.description}${item.unit ? ` (${item.unit})` : ""}`}
                    className={cn("tabular h-12 text-lg sm:text-lg", item.unit && "pr-16")}
                  />
                  {item.unit ? (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                      {item.unit}
                    </span>
                  ) : null}
                </div>
              ) : (
                <Textarea
                  value={isNa ? "" : answer.valueText}
                  onChange={(event) => onChange(item.id, { valueText: event.target.value })}
                  placeholder={isNa ? "Ditandai N/A" : "Tulis hasil pemeriksaan…"}
                  disabled={disabled || isNa}
                  rows={2}
                  maxLength={2000}
                  aria-label={item.description}
                  className="min-h-[72px]"
                />
              )}
            </div>
            <button
              type="button"
              aria-pressed={isNa}
              disabled={disabled}
              onClick={() => onChange(item.id, { result: isNa ? null : "na" })}
              className={cn(
                naToggleClassName,
                isNa
                  ? "border-muted-foreground bg-muted-foreground text-background"
                  : "border-input bg-card text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                item.input_type === "number" ? "h-12" : "min-h-[72px]",
              )}
              title="Tandai tidak berlaku (N/A)"
            >
              N/A
            </button>
          </div>
        )}

        {item.input_type === "number" && !isNa ? (
          <p
            className={cn(
              "mt-1.5 text-xs font-medium",
              parsed === undefined || range === "out"
                ? "text-danger-foreground"
                : range === "in"
                  ? "text-success-foreground"
                  : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {parsed === undefined
              ? "Angka tidak valid. Gunakan angka, mis. 385,5"
              : range === "out"
                ? "Di luar rentang (Tidak OK)"
                : range === "in"
                  ? hint
                    ? "Dalam rentang (OK)"
                    : "Terisi (OK)"
                  : " "}
          </p>
        ) : null}
      </div>

      {/* ---- Notes ---- */}
      <div className="mt-3">
        {notesOpen ? (
          <Textarea
            value={answer.notes}
            onChange={(event) => onChange(item.id, { notes: event.target.value })}
            placeholder={
              result === "not_ok" ? "Jelaskan temuan atau kondisi yang tidak sesuai…" : "Tulis catatan (opsional)…"
            }
            rows={2}
            maxLength={2000}
            disabled={disabled}
            aria-label={`Catatan untuk ${item.description}`}
            className="min-h-[64px]"
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-10 px-2 text-primary hover:text-primary"
            onClick={() => setNotesOpen(true)}
            disabled={disabled}
          >
            <MessageSquarePlus />
            Tambah catatan
          </Button>
        )}
      </div>

      {/* ---- Photos ---- */}
      <PhotoStrip
        className="mt-3"
        label={item.description}
        attachments={item.attachments}
        max={PM_MAX_ITEM_PHOTOS}
        canAdd={!disabled}
        canDelete={canDeletePhoto}
        upload={upload}
        onChanged={photosChanged}
      />

      {/* ---- Finding -> work order ---- */}
      {item.work_order ? (
        <div className={cn(findingBoxClassName, "flex flex-wrap items-center gap-2")}>
          <Wrench className="h-4 w-4 shrink-0" aria-hidden />
          <span>WO dari temuan:</span>
          <Link
            href={`/work-orders/${item.work_order.id}`}
            className="rounded-sm font-mono text-xs font-semibold underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.work_order.wo_number}
          </Link>
          <StatusBadge status={item.work_order.status} label={item.work_order.status_label} />
        </div>
      ) : result === "not_ok" && canCreateWorkOrder ? (
        <div className={cn(findingBoxClassName, "flex flex-wrap items-center justify-between gap-2")}>
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
            Temuan
          </span>
          <Button
            variant="outline"
            className="border-danger/40 text-danger-foreground hover:text-danger-foreground"
            onClick={() => onCreateWorkOrder(item.id)}
            disabled={disabled}
          >
            <Wrench />
            Buat WO dari temuan
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm font-medium text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </li>
  );
});
