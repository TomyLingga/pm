"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PriorityPicker } from "@/components/work-orders/priority-picker";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useExecutorUnits } from "@/hooks/use-lookups";
import { errorMessage } from "@/lib/api";
import { createWorkOrderFromItem } from "@/lib/pm-tasks";
import { queryKeys } from "@/lib/query-keys";
import { formatNumber } from "@/lib/utils";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";
import type { PmTaskDetail, PmTaskItem, PmTaskWorkOrderPayload } from "@/types/pm";
import type { WorkOrderPriority } from "@/types/work-order";
import { parseNumberInput, rangeHint, type ItemAnswer } from "./checklist-model";
import { usePmTaskAction } from "./use-pm-task";

interface CreateWoDialogProps {
  task: PmTaskDetail;
  /** The `not_ok` item the work order is created from (null = closed). */
  item: PmTaskItem | null;
  /** Current (local) answer of that item; used to prefill the description. */
  answer: ItemAnswer | null;
  onOpenChange: (open: boolean) => void;
}

/** "Temuan PM {number}: {item description}, {measurement / notes}", built from the current answer. */
function defaultDescription(task: PmTaskDetail, item: PmTaskItem, answer: ItemAnswer): string {
  const details: string[] = [];
  if (item.input_type === "number") {
    const value = parseNumberInput(answer.valueNumber);
    if (typeof value === "number") {
      const hint = rangeHint(item);
      const measured = `${formatNumber(value, 4)}${item.unit ? ` ${item.unit}` : ""}`;
      details.push(`terukur ${measured}${hint ? ` (${hint.toLowerCase()})` : ""}`);
    }
  }
  if (item.input_type === "text" && answer.valueText.trim()) details.push(answer.valueText.trim());
  if (answer.notes.trim()) details.push(answer.notes.trim());
  const base = `Temuan PM ${task.number}: ${item.description}`;
  return details.length ? `${base}, ${details.join(". ")}` : base;
}

function CreateWoForm({
  task,
  item,
  answer,
  onDone,
}: {
  task: PmTaskDetail;
  item: PmTaskItem;
  answer: ItemAnswer;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const units = useExecutorUnits("work_order");
  const [unitId, setUnitId] = React.useState(String(task.executor_unit.id));
  const [categoryId, setCategoryId] = React.useState("");
  const [priority, setPriority] = React.useState<WorkOrderPriority>("medium");
  const [description, setDescription] = React.useState(() => defaultDescription(task, item, answer));
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});

  const selectedUnit = units.data?.find((unit) => String(unit.id) === unitId);
  const categories = selectedUnit?.categories ?? [];
  // The task's own unit must always be selectable, even if the lookup does not list it.
  const unitOptions = React.useMemo(() => {
    const list = units.data?.map((unit) => ({ id: unit.id, display_name: unit.display_name })) ?? [];
    if (!list.some((unit) => unit.id === task.executor_unit.id)) {
      list.unshift({ id: task.executor_unit.id, display_name: task.executor_unit.display_name });
    }
    return list;
  }, [task.executor_unit, units.data]);

  const mutation = usePmTaskAction(
    task.id,
    (payload: PmTaskWorkOrderPayload) => createWorkOrderFromItem(task.id, item.id, payload),
    {
      successMessage: "Work Order dibuat dari temuan.",
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workOrderLists });
        onDone();
      },
    },
  );
  const serverErrors = validationErrors(mutation.error);
  const errorFor = (key: string) => clientErrors[key] ?? firstError(serverErrors, key);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!categoryId) errors.service_category_id = "Pilih kategori pekerjaan.";
    if (!description.trim()) errors.request_description = "Uraian permintaan wajib diisi.";
    setClientErrors(errors);
    if (Object.keys(errors).length) return;
    mutation.mutate({
      service_category_id: Number(categoryId),
      priority,
      executor_unit_id: Number(unitId),
      request_description: description.trim(),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="rounded-lg border bg-surface-2 p-3 text-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Butir checklist</p>
        <p className="mt-0.5 font-medium">{item.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Alat dan lokasi WO diisi otomatis dari tugas ({task.equipment.code ? `${task.equipment.code} - ` : ""}
          {task.equipment.name}).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Unit pelaksana" htmlFor="pm-wo-unit" required error={errorFor("executor_unit_id")}>
          <Select
            id="pm-wo-unit"
            value={unitId}
            onChange={(event) => {
              setUnitId(event.target.value);
              setCategoryId("");
            }}
            disabled={mutation.isPending}
            invalid={!!errorFor("executor_unit_id")}
          >
            {unitOptions.map((unit) => (
              <option key={unit.id} value={String(unit.id)}>
                {unit.display_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Kategori"
          htmlFor="pm-wo-category"
          required
          error={errorFor("service_category_id")}
          hint={units.isError ? errorMessage(units.error) : undefined}
        >
          <Select
            id="pm-wo-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={units.isPending || mutation.isPending}
            invalid={!!errorFor("service_category_id")}
          >
            <option value="">{units.isPending ? "Memuat…" : "Pilih kategori"}</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Prioritas" required error={errorFor("priority")}>
        <PriorityPicker
          name="pm-wo-priority"
          value={priority}
          onChange={setPriority}
          disabled={mutation.isPending}
          compact
        />
      </Field>

      <Field
        label="Uraian permintaan"
        htmlFor="pm-wo-description"
        required
        error={errorFor("request_description")}
      >
        <Textarea
          id="pm-wo-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          maxLength={2000}
          disabled={mutation.isPending}
          invalid={!!errorFor("request_description")}
        />
      </Field>

      <FieldError
        message={unmatchedValidationMessage(mutation.error, [
          "service_category_id",
          "priority",
          "executor_unit_id",
          "request_description",
        ])}
      />

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Batal
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Buat Work Order
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CreateWoDialog({ task, item, answer, onOpenChange }: CreateWoDialogProps) {
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Buat WO dari temuan</DialogTitle>
          <DialogDescription>
            Work Order perbaikan dibuat untuk butir yang &quot;Tidak OK&quot;. Satu butir hanya dapat dibuatkan satu WO.
          </DialogDescription>
        </DialogHeader>
        {item && answer ? (
          <CreateWoForm key={item.id} task={task} item={item} answer={answer} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
