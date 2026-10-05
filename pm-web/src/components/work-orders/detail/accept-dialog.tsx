"use client";

import * as React from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
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
import { Segmented } from "@/components/ui/segmented";
import { Textarea } from "@/components/ui/textarea";
import { CLEARANCE_LABELS, DEFAULT_CLEARANCE_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { acceptWorkOrder } from "@/lib/work-orders";
import type { AcceptPayload, ClearanceResult, WorkOrderDetail } from "@/types/work-order";
import {
  firstError,
  unmatchedValidationMessage,
  useWorkOrderAction,
  validationErrors,
} from "./use-work-order-action";

export const CLEARANCE_SEGMENTS = [
  { value: "ok" as const, label: "OK", activeClassName: "bg-emerald-600 text-white" },
  { value: "not_ok" as const, label: "TDK", activeClassName: "bg-red-600 text-white" },
];

interface AcceptDialogProps {
  wo: WorkOrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AcceptForm({ wo, onDone }: { wo: WorkOrderDetail; onDone: () => void }) {
  const items = wo.clearances.length
    ? [...wo.clearances].sort((a, b) => a.item_no - b.item_no)
    : DEFAULT_CLEARANCE_ITEMS.map((item) => ({ ...item, mtc_result: null }));

  const [acceptance, setAcceptance] = React.useState<"yes" | "no" | null>(null);
  const [clearance, setClearance] = React.useState<Record<number, ClearanceResult | undefined>>({});
  const [breakdown, setBreakdown] = React.useState(
    wo.total_breakdown_hours !== null ? String(wo.total_breakdown_hours) : "",
  );
  const [remarks, setRemarks] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});

  const mutation = useWorkOrderAction(wo.id, (payload: AcceptPayload) => acceptWorkOrder(wo.id, payload), {
    successMessage:
      acceptance === "no" ? "WO dikembalikan ke teknisi untuk dikerjakan ulang." : "Penerimaan dikonfirmasi. WO ditutup.",
    onSuccess: onDone,
  });
  const serverErrors = validationErrors(mutation.error);
  const errorFor = (...keys: string[]) => keys.map((k) => clientErrors[k]).find(Boolean) ?? firstError(serverErrors, ...keys);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!acceptance) errors.acceptance = "Pilih Ya atau Tidak.";
    if (acceptance === "no" && !reason.trim()) errors.reason = "Alasan wajib diisi bila pekerjaan tidak diterima.";
    if (acceptance === "yes") {
      if (items.some((item) => !clearance[item.item_no])) errors.clearance = "Isi semua item clearance (OK/TDK).";
      if (breakdown.trim() && (!Number.isFinite(Number(breakdown)) || Number(breakdown) < 0)) {
        errors.total_breakdown_hours = "Total breakdown harus berupa angka jam yang valid.";
      }
    }
    setClientErrors(errors);
    if (Object.keys(errors).length || !acceptance) return;

    const payload: AcceptPayload =
      acceptance === "no"
        ? { acceptance: "no", reason: reason.trim() }
        : {
            acceptance: "yes",
            clearance: items.map((item) => ({ item_no: item.item_no, result: clearance[item.item_no] as ClearanceResult })),
            total_breakdown_hours: breakdown.trim() ? Number(breakdown) : null,
            remarks: remarks.trim() || null,
          };
    mutation.mutate(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <p className="mb-2 text-sm font-medium">Apakah pekerjaan sudah selesai dan dapat diterima?</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "yes", label: "Ya, diterima", icon: ThumbsUp, active: "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600" },
              { value: "no", label: "Tidak", icon: ThumbsDown, active: "border-red-600 bg-red-50 text-red-800 ring-1 ring-red-600" },
            ] as const
          ).map((option) => {
            const Icon = option.icon;
            const checked = acceptance === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-lg border bg-card p-3 text-sm font-semibold shadow-sm focus-within:ring-2 focus-within:ring-ring hover:bg-muted/50",
                  checked && option.active,
                )}
              >
                <input
                  type="radio"
                  name="acceptance"
                  value={option.value}
                  checked={checked}
                  onChange={() => setAcceptance(option.value)}
                  className="sr-only"
                />
                <Icon className="h-4 w-4" aria-hidden />
                {option.label}
              </label>
            );
          })}
        </div>
        <FieldError className="mt-1.5" message={errorFor("acceptance")} />
      </div>

      {acceptance === "yes" ? (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">Maintenance clearance (konfirmasi user)</p>
            <ul className="divide-y rounded-md border">
              {items.map((item) => (
                <li key={item.item_no} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {item.item_no}. {item.item_label}
                    </p>
                    {item.mtc_result ? (
                      <p className="text-xs text-muted-foreground">MTC: {CLEARANCE_LABELS[item.mtc_result]}</p>
                    ) : null}
                  </div>
                  <Segmented
                    name={`user-clearance-${item.item_no}`}
                    aria-label={item.item_label}
                    value={clearance[item.item_no]}
                    options={CLEARANCE_SEGMENTS}
                    onChange={(value) => setClearance((current) => ({ ...current, [item.item_no]: value }))}
                  />
                </li>
              ))}
            </ul>
            <FieldError message={errorFor("clearance", "clearance.*")} />
          </div>

          <Field
            label="Total breakdown (jam)"
            htmlFor="breakdown-hours"
            hint="Opsional. Lama alat/pekerjaan terganggu, contoh 1,5 = 1 jam 30 menit."
            error={errorFor("total_breakdown_hours")}
          >
            <Input
              id="breakdown-hours"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.25"
              value={breakdown}
              onChange={(event) => setBreakdown(event.target.value)}
              invalid={!!errorFor("total_breakdown_hours")}
            />
          </Field>

          <Field label="Remarks" htmlFor="accept-remarks" error={errorFor("remarks")}>
            <Textarea
              id="accept-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Catatan tambahan (opsional)"
            />
          </Field>
        </>
      ) : null}

      {acceptance === "no" ? (
        <Field label="Alasan tidak diterima" htmlFor="reject-reason" required error={errorFor("reason")}>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Jelaskan apa yang belum sesuai. WO akan dikembalikan ke teknisi."
            invalid={!!errorFor("reason")}
          />
        </Field>
      ) : null}

      <FieldError
        message={unmatchedValidationMessage(mutation.error, [
          "acceptance",
          "reason",
          "clearance",
          "clearance.*",
          "total_breakdown_hours",
          "remarks",
        ])}
      />

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Batal
        </Button>
        <Button
          type="submit"
          variant={acceptance === "no" ? "destructive" : "default"}
          loading={mutation.isPending}
          disabled={!acceptance}
        >
          {acceptance === "no" ? "Kembalikan ke Teknisi" : "Konfirmasi Penerimaan"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AcceptDialog({ wo, open, onOpenChange }: AcceptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Konfirmasi Penerimaan</DialogTitle>
          <DialogDescription>
            Periksa hasil pekerjaan {wo.wo_number} sebelum memberikan konfirmasi.
          </DialogDescription>
        </DialogHeader>
        {open ? <AcceptForm wo={wo} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
