"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Package, Save } from "lucide-react";
import { Section } from "@/components/common/section";
import { useCurrentUser } from "@/components/layout/current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { toast } from "@/components/ui/sonner";
import {
  MaterialsEditor,
  materialRowsFrom,
  toMaterialInputs,
  validateMaterialRows,
  type MaterialField,
  type MaterialRow,
} from "@/components/work-orders/detail/materials-editor";
import { ApiError } from "@/lib/api";
import { PM_MAX_GENERAL_PHOTOS } from "@/lib/pm-constants";
import { completePmTask, savePmTaskMaterials, uploadPmTaskAttachment } from "@/lib/pm-tasks";
import { queryKeys } from "@/lib/query-keys";
import { firstError, validationErrors } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { PmTaskCompletePayload, PmTaskDetail, PmTaskItem } from "@/types/pm";
import type { Attachment, MaterialInput } from "@/types/work-order";
import { PhotoStrip } from "../../photo-strip";
import { ChecklistItemCard } from "./checklist-item-card";
import {
  answerFromItem,
  effectiveResult,
  groupBySection,
  hasInvalidNumber,
  isAnswered,
  toItemInput,
  type ItemAnswer,
} from "./checklist-model";
import { CompleteDialog } from "./complete-dialog";
import { CreateWoDialog } from "./create-wo-dialog";
import { SaveIndicator } from "./save-indicator";
import { useItemAutosave } from "./use-item-autosave";
import { usePmTaskAction } from "./use-pm-task";

/** `errors["items.{id}"]` (or `items.{id}.field`) of a failed "complete" -> item id -> message. */
function mapItemErrors(errors: Record<string, string[]>, items: PmTaskItem[]): Record<number, string> {
  const ids = new Set(items.map((item) => item.id));
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const mapped: Record<number, string> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const match = key.match(/^items\.(\d+)(?:\.|$)/);
    if (!match || !messages?.[0]) continue;
    const n = Number(match[1]);
    // The contract keys errors by item id; fall back to the array index just in case.
    const id = ids.has(n) ? n : sorted[n]?.id;
    if (id !== undefined && mapped[id] === undefined) mapped[id] = messages[0];
  }
  return mapped;
}

function scrollToItem(itemId: number) {
  document.getElementById(`pm-item-${itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Checklist execution form (task `in_progress`, user may work on it). Answers are kept locally
 * and auto-saved; photos, materials and "Selesaikan" talk to the server directly.
 */
export function TaskWorkForm({ task }: { task: PmTaskDetail }) {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const { can_complete: canComplete, can_create_work_order: canCreateWo } = task.permissions;

  const sortedItems = React.useMemo(() => [...task.items].sort((a, b) => a.sort_order - b.sort_order), [task.items]);
  const groups = React.useMemo(() => groupBySection(task.items), [task.items]);
  const positions = React.useMemo(
    () => new Map(sortedItems.map((item, index) => [item.id, index + 1])),
    [sortedItems],
  );
  const itemsById = React.useMemo(() => new Map(task.items.map((item) => [item.id, item])), [task.items]);

  /* ---------- Answers + auto-save ---------- */

  const [answers, setAnswers] = React.useState<Record<number, ItemAnswer>>(() =>
    Object.fromEntries(task.items.map((item) => [item.id, answerFromItem(item)])),
  );
  const [itemErrors, setItemErrors] = React.useState<Record<number, string>>({});

  // Latest values for the (debounced) save, which runs outside the render cycle.
  const answersRef = React.useRef(answers);
  const itemsRef = React.useRef(itemsById);
  React.useEffect(() => {
    answersRef.current = answers;
    itemsRef.current = itemsById;
  }, [answers, itemsById]);

  const buildInput = React.useCallback((itemId: number) => {
    const item = itemsRef.current.get(itemId);
    const answer = answersRef.current[itemId];
    return item && answer ? toItemInput(item, answer) : null;
  }, []);

  const { state, error, savedAt, markDirty, flush, notifyExternalChange } = useItemAutosave({
    taskId: task.id,
    buildInput,
  });

  const clearItemError = React.useCallback((itemId: number) => {
    setItemErrors((current) => {
      if (!(itemId in current)) return current;
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);

  const handleAnswerChange = React.useCallback(
    (itemId: number, patch: Partial<ItemAnswer>) => {
      setAnswers((current) => {
        const previous = current[itemId];
        if (!previous) return current;
        const next = { ...previous, ...patch };
        const unchanged =
          next.result === previous.result &&
          next.valueNumber === previous.valueNumber &&
          next.valueText === previous.valueText &&
          next.notes === previous.notes;
        return unchanged ? current : { ...current, [itemId]: next };
      });
      clearItemError(itemId);
      markDirty(itemId);
    },
    [clearItemError, markDirty],
  );

  /* ---------- Photos ---------- */

  const refreshTask = React.useCallback(() => {
    notifyExternalChange();
    return queryClient.invalidateQueries({ queryKey: queryKeys.pmTask(task.id) });
  }, [notifyExternalChange, queryClient, task.id]);

  const uploadItemPhoto = React.useCallback(
    (itemId: number, file: File) => uploadPmTaskAttachment(task.id, file, itemId),
    [task.id],
  );
  const uploadGeneralPhoto = React.useCallback((file: File) => uploadPmTaskAttachment(task.id, file), [task.id]);
  const handleItemPhotosChanged = React.useCallback(
    (itemId: number) => {
      clearItemError(itemId);
      return refreshTask();
    },
    [clearItemError, refreshTask],
  );
  const canDeletePhoto = React.useCallback(
    (attachment: Attachment) => attachment.uploaded_by?.id === me.id,
    [me.id],
  );

  /* ---------- Work order from a finding ---------- */

  const [woItemId, setWoItemId] = React.useState<number | null>(null);
  const handleCreateWo = React.useCallback(
    async (itemId: number) => {
      // The server only accepts items already saved as "Tidak OK".
      const saved = await flush();
      if (!saved) {
        toast.error("Jawaban belum tersimpan. Periksa isian yang ditandai merah atau koneksi, lalu coba lagi.");
        return;
      }
      setWoItemId(itemId);
    },
    [flush],
  );
  const woItem = woItemId !== null ? itemsById.get(woItemId) ?? null : null;

  /* ---------- Materials ---------- */

  const [materials, setMaterials] = React.useState<MaterialRow[]>(() => materialRowsFrom(task.materials));
  const [materialsDirty, setMaterialsDirty] = React.useState(false);
  const [materialErrors, setMaterialErrors] = React.useState<Record<string, string>>({});
  const materialsRef = React.useRef<HTMLDivElement>(null);

  const saveMaterials = usePmTaskAction(
    task.id,
    (inputs: MaterialInput[]) => savePmTaskMaterials(task.id, inputs),
    { successMessage: "Material disimpan.", onSuccess: () => setMaterialsDirty(false) },
  );
  const materialServerErrors = validationErrors(saveMaterials.error);
  const materialError = (index: number, field: MaterialField) =>
    materialErrors[`${index}.${field}`] ?? firstError(materialServerErrors, `materials.${index}.${field}`);

  const validateMaterials = (): boolean => {
    const errors = validateMaterialRows(materials);
    setMaterialErrors(errors);
    if (Object.keys(errors).length === 0) return true;
    materialsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.error("Periksa kembali isian material.");
    return false;
  };

  /* ---------- Complete ---------- */

  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [preparing, setPreparing] = React.useState(false);

  const complete = usePmTaskAction(
    task.id,
    (payload: PmTaskCompletePayload) => completePmTask(task.id, payload),
    { successMessage: "Tugas PM selesai." },
  );

  const answeredCount = sortedItems.filter((item) => answers[item.id] && isAnswered(item, answers[item.id])).length;
  const findings = sortedItems.filter(
    (item) => answers[item.id] && effectiveResult(item, answers[item.id]) === "not_ok",
  );
  const progress = sortedItems.length ? Math.round((answeredCount / sortedItems.length) * 100) : 0;

  const showItemErrors = (errors: Record<number, string>) => {
    setItemErrors(errors);
    const first = sortedItems.find((item) => errors[item.id]);
    if (first) scrollToItem(first.id);
  };

  const openComplete = async () => {
    const errors: Record<number, string> = {};
    for (const item of sortedItems) {
      const answer = answers[item.id];
      if (!answer) continue;
      if (hasInvalidNumber(item, answer)) errors[item.id] = "Angka tidak valid.";
      else if (item.is_required && !isAnswered(item, answer)) errors[item.id] = "Butir wajib ini belum diisi.";
    }
    const count = Object.keys(errors).length;
    if (count > 0) {
      showItemErrors(errors);
      toast.error(`${count} butir perlu dilengkapi sebelum tugas diselesaikan.`);
      return;
    }
    if (!validateMaterials()) return;

    setPreparing(true);
    const saved = await flush();
    setPreparing(false);
    if (!saved) {
      toast.error("Jawaban belum tersimpan. Periksa koneksi lalu coba lagi.");
      return;
    }
    complete.reset();
    setCompleteOpen(true);
  };

  const submitComplete = (values: { duration_minutes: number | null; notes: string | null }) => {
    complete.mutate(
      {
        ...values,
        // Unsaved material edits travel with "complete" so nothing typed is lost.
        ...(materialsDirty ? { materials: toMaterialInputs(materials) } : {}),
      },
      {
        onSuccess: () => setCompleteOpen(false),
        onError: (err) => {
          if (!(err instanceof ApiError) || err.status !== 422) return;
          const mapped = mapItemErrors(err.errors, task.items);
          const count = Object.keys(mapped).length;
          if (count === 0) return;
          // Required answers / photos missing: show them on the checklist itself.
          setCompleteOpen(false);
          showItemErrors(mapped);
          toast.error(`${count} butir belum lengkap. ${err.message}`);
        },
      },
    );
  };

  const busy = complete.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Checklist</h2>
          <p className="text-xs text-muted-foreground">
            {task.checklist_template?.name ? `${task.checklist_template.name} · ` : ""}
            <span className="tabular">{sortedItems.length} butir</span> &middot;{" "}
            <span className="text-destructive">*</span> wajib diisi
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Jawaban tersimpan otomatis saat Anda mengisi.</p>
      </div>

      {groups.map((group) => {
        const done = group.items.filter((item) => answers[item.id] && isAnswered(item, answers[item.id])).length;
        return (
          <section key={group.section ?? "__default"} className="space-y-2">
            {group.section || groups.length > 1 ? (
              <div className="flex items-center justify-between gap-2 border-b pb-1.5">
                <h3 className="text-sm font-semibold">{group.section ?? "Umum"}</h3>
                <span className="tabular text-xs text-muted-foreground">
                  {done}/{group.items.length}
                </span>
              </div>
            ) : null}
            <ul className="space-y-3">
              {group.items.map((item) => (
                <ChecklistItemCard
                  key={item.id}
                  item={item}
                  position={positions.get(item.id) ?? 0}
                  answer={answers[item.id] ?? answerFromItem(item)}
                  onChange={handleAnswerChange}
                  error={itemErrors[item.id]}
                  disabled={busy}
                  canCreateWorkOrder={canCreateWo}
                  onCreateWorkOrder={handleCreateWo}
                  uploadPhoto={uploadItemPhoto}
                  onPhotosChanged={handleItemPhotosChanged}
                  canDeletePhoto={canDeletePhoto}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <Section title="Foto Umum" icon={<Camera className="h-4 w-4" aria-hidden />}>
        <PhotoStrip
          label="foto umum tugas"
          size="md"
          attachments={task.attachments}
          max={PM_MAX_GENERAL_PHOTOS}
          canAdd={!busy}
          canDelete={canDeletePhoto}
          upload={uploadGeneralPhoto}
          onChanged={refreshTask}
          allowPdf
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Foto kondisi umum alat/area (bukan per butir). Maks. {PM_MAX_GENERAL_PHOTOS} file, 5 MB per file.
        </p>
      </Section>

      <div ref={materialsRef} className="scroll-mt-24">
        <Section
          title="Material"
          icon={<Package className="h-4 w-4" aria-hidden />}
          actions={materialsDirty ? <Badge variant="warning">Belum disimpan</Badge> : undefined}
        >
          <div className="space-y-3">
            <MaterialsEditor
              rows={materials}
              onChange={(rows) => {
                setMaterials(rows);
                setMaterialsDirty(true);
                setMaterialErrors({});
              }}
              errorAt={materialError}
              disabled={busy || saveMaterials.isPending}
            />
            <FieldError message={firstError(materialServerErrors, "materials")} />
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  if (validateMaterials()) saveMaterials.mutate(toMaterialInputs(materials));
                }}
                loading={saveMaterials.isPending}
                disabled={busy || !materialsDirty}
              >
                {saveMaterials.isPending ? null : <Save />}
                Simpan Material
              </Button>
            </div>
          </div>
        </Section>
      </div>

      {/* Sticky footer: progress, save status and the finish button stay reachable on phones. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_hsl(var(--shadow)/0.25)] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border lg:px-5 lg:py-4 lg:shadow-sm lg:shadow-edge">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="tabular font-medium">
                {answeredCount} dari {sortedItems.length} butir terisi
              </span>
              {findings.length > 0 ? (
                <span className="tabular font-semibold text-danger-foreground">{findings.length} temuan</span>
              ) : null}
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={sortedItems.length}
              aria-valuenow={answeredCount}
              aria-label="Kemajuan pengisian checklist"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300 ease-out-expo",
                  progress === 100 ? "bg-success" : "bg-primary",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <SaveIndicator
              className="mt-1.5"
              state={state}
              error={error}
              savedAt={savedAt}
              onRetry={() => void flush()}
            />
          </div>
          {canComplete ? (
            <Button size="lg" className="shrink-0" onClick={() => void openComplete()} loading={preparing} disabled={busy}>
              {preparing ? null : <CheckCircle2 />}
              Selesaikan
            </Button>
          ) : null}
        </div>
      </div>

      <CreateWoDialog
        task={task}
        item={woItem}
        answer={woItem ? answers[woItem.id] ?? answerFromItem(woItem) : null}
        onOpenChange={(open) => !open && setWoItemId(null)}
      />
      <CompleteDialog
        task={task}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        findingsCount={findings.length}
        findingsWithoutWo={findings.filter((item) => !item.work_order).length}
        loading={complete.isPending}
        error={complete.error}
        onSubmit={submitComplete}
      />
    </div>
  );
}
