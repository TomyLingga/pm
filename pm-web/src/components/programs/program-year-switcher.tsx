"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Select } from "@/components/ui/select";
import type { WorkProgramDetail, WorkProgramSibling } from "@/types/work-program";

/**
 * Programme to open for `year`: the sibling with the same `code` as the current programme,
 * otherwise the first programme of that year (siblings arrive ordered year desc, code asc).
 */
export function resolveYearTarget(siblings: WorkProgramSibling[], year: number, code: string): WorkProgramSibling | null {
  const ofYear = siblings.filter((sibling) => sibling.year === year);
  const wanted = code.trim().toUpperCase();
  return ofYear.find((sibling) => sibling.code.trim().toUpperCase() === wanted) ?? ofYear[0] ?? null;
}

/** "Tahun" selector of the detail header, fed by `siblings`, plus a link to the filtered list. */
export function ProgramYearSwitcher({ program }: { program: WorkProgramDetail }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const selectId = React.useId();

  // Older API builds answer without `siblings`; the switcher then only offers the current year.
  const siblings = React.useMemo(() => program.siblings ?? [], [program.siblings]);
  const years = React.useMemo(() => {
    const distinct = new Set<number>(siblings.map((sibling) => sibling.year));
    distinct.add(program.year);
    return Array.from(distinct).sort((a, b) => b - a);
  }, [siblings, program.year]);
  const single = years.length <= 1;

  const listHref = React.useMemo(() => {
    const params = new URLSearchParams({ year: String(program.year) });
    if (program.org_unit) params.set("org_unit_id", String(program.org_unit.id));
    return `/programs?${params.toString()}`;
  }, [program.year, program.org_unit]);

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const year = Number(event.target.value);
    if (!Number.isInteger(year) || year === program.year) return;
    const target = resolveYearTarget(siblings, year, program.code);
    if (!target) return;
    startTransition(() => router.push(`/programs/${target.id}`));
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <label htmlFor={selectId} className="text-xs font-medium text-muted-foreground">
        Tahun
      </label>
      <Select
        id={selectId}
        value={String(program.year)}
        onChange={onChange}
        disabled={single || pending}
        aria-busy={pending || undefined}
        title={single ? `Program unit ini hanya ada di tahun ${program.year}` : "Buka program unit ini di tahun lain"}
        wrapperClassName="w-auto"
        className="tabular h-10 w-auto min-w-[6.5rem] pr-8 text-sm font-semibold text-foreground md:h-8 md:text-xs"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>
      <Link
        href={listHref}
        className="inline-flex min-h-8 items-center gap-0.5 rounded-md text-xs font-medium text-primary underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Lihat semua program
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </span>
  );
}
