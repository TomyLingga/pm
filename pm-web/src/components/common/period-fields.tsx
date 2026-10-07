"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface PeriodFieldsProps {
  idPrefix: string;
  /** Effective values (URL value or the default). */
  from: string;
  to: string;
  onChange: (patch: { from?: string; to?: string }) => void;
  /** Field labels; the default pair describes the date a document ended. */
  labels?: { from: string; to: string };
}

/** "Dari / Sampai tanggal" pair of the list period (see lib/list-period). */
export function PeriodFields({ idPrefix, from, to, onChange, labels }: PeriodFieldsProps) {
  const fromLabel = labels?.from ?? "Berakhir dari";
  const toLabel = labels?.to ?? "Berakhir sampai";
  return (
    <>
      <Field label={fromLabel} htmlFor={`${idPrefix}-from`}>
        <Input id={`${idPrefix}-from`} type="date" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
      </Field>
      <Field label={toLabel} htmlFor={`${idPrefix}-to`}>
        <Input id={`${idPrefix}-to`} type="date" value={to} min={from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
      </Field>
    </>
  );
}

/** One-line explanation under the filter panel. `by` names the date the range applies to. */
export function PeriodHint({
  finished,
  running,
  visible,
  by = "menurut tanggal berakhirnya",
}: {
  finished: string;
  running: string;
  visible: boolean;
  by?: string;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      {visible
        ? `Rentang tanggal hanya menyaring ${finished} (${by}); ${running} selalu ditampilkan semua.`
        : `Status ini masih berjalan, jadi semua ${running} ditampilkan tanpa filter tanggal.`}
    </p>
  );
}
