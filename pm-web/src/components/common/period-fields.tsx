"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface PeriodFieldsProps {
  idPrefix: string;
  /** Effective values (URL value or the default). */
  from: string;
  to: string;
  onChange: (patch: { from?: string; to?: string }) => void;
}

/** "Dari / Sampai tanggal" pair of the list period (see lib/list-period). */
export function PeriodFields({ idPrefix, from, to, onChange }: PeriodFieldsProps) {
  return (
    <>
      <Field label="Berakhir dari" htmlFor={`${idPrefix}-from`}>
        <Input id={`${idPrefix}-from`} type="date" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
      </Field>
      <Field label="Berakhir sampai" htmlFor={`${idPrefix}-to`}>
        <Input id={`${idPrefix}-to`} type="date" value={to} min={from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
      </Field>
    </>
  );
}

/** One-line explanation under the filter panel. */
export function PeriodHint({ finished, running, visible }: { finished: string; running: string; visible: boolean }) {
  return (
    <p className="text-xs text-muted-foreground">
      {visible
        ? `Rentang tanggal hanya menyaring ${finished} (menurut tanggal berakhirnya); ${running} selalu ditampilkan semua.`
        : `Status ini masih berjalan, jadi semua ${running} ditampilkan tanpa filter tanggal.`}
    </p>
  );
}
