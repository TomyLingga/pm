"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SERIES_COLORS } from "@/lib/chart-colors";
import { formatHours } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import { formatNumber } from "@/lib/utils";
import type { EquipmentBreakdown, EquipmentFailure } from "@/types/dashboard";
import { AXIS_TICK, CURSOR_FILL, ChartCard, ChartTooltip, GRID_STROKE } from "./chart-card";

const label = (equipment: { code: string | null; name: string }) => equipment.code ?? equipment.name;

export function EquipmentBreakdownChart({ data }: { data: EquipmentBreakdown[] }) {
  const rows = data.slice(0, 10).map((entry) => ({
    ...entry,
    label: label(entry.equipment),
    hours: Math.round(entry.hours * 10) / 10,
  }));
  const height = Math.max(160, rows.length * 32 + 24);

  return (
    <ChartCard
      title="Top 10 breakdown hours"
      description="Total jam breakdown dari WO yang ditutup dalam periode"
      isEmpty={rows.length === 0}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
          <XAxis type="number" tick={AXIS_TICK} unit=" j" axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
          <YAxis type="category" dataKey="label" width={96} tick={AXIS_TICK} interval={0} axisLine={false} tickLine={false} />
          <Tooltip
            content={
              <ChartTooltip
                formatValue={(value) => formatHours(value)}
                title={(_label, tooltipRows) => {
                  const payload = tooltipRows[0]?.payload as (typeof rows)[number] | undefined;
                  return payload
                    ? `${payload.equipment.code ? `${payload.equipment.code} - ` : ""}${payload.equipment.name} (${formatNumber(payload.work_orders, 0)} WO)`
                    : _label;
                }}
              />
            }
            cursor={{ fill: CURSOR_FILL }}
          />
          <Bar dataKey="hours" name="Breakdown" fill={SERIES_COLORS.tertiary} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function EquipmentTopFailures({ data }: { data: EquipmentFailure[] }) {
  const rows = data.slice(0, 10);
  return (
    <ChartCard title="Top 10 paling sering rusak" description="Equipment dengan WO terbanyak dalam periode" isEmpty={rows.length === 0}>
      <div className="-mx-4 -mb-4 sm:-mx-5 sm:-mb-5">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8 pl-4 sm:pl-5">#</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead className="w-16 text-right">WO</TableHead>
              <TableHead className="hidden w-36 pr-4 sm:table-cell sm:pr-5">WO terakhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((entry, index) => (
              <TableRow key={entry.equipment.id}>
                <TableCell className="tabular py-2 pl-4 text-muted-foreground sm:pl-5">{index + 1}</TableCell>
                <TableCell className="py-2">
                  <Link
                    href={`/equipment/${entry.equipment.id}`}
                    className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {entry.equipment.code ? <span className="font-mono text-xs">{entry.equipment.code} &middot; </span> : null}
                    {entry.equipment.name}
                  </Link>
                  <p className="tabular text-[11px] text-muted-foreground sm:hidden">{formatDateTime(entry.last_issued_at)}</p>
                </TableCell>
                <TableCell className="tabular py-2 text-right font-semibold">{formatNumber(entry.work_orders, 0)}</TableCell>
                <TableCell className="tabular hidden py-2 pr-4 text-xs text-muted-foreground sm:table-cell sm:pr-5">
                  {formatDateTime(entry.last_issued_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ChartCard>
  );
}
