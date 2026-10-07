import * as React from "react";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TONE } from "@/lib/chart-colors";
import { cn, formatNumber } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  /** Renders the empty state instead of the chart. */
  isEmpty?: boolean;
  emptyText?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Dashboard panel: compact titled header, chart body, shared empty state. */
export function ChartCard({
  title,
  description,
  isEmpty,
  emptyText = "Belum ada data pada periode ini.",
  actions,
  className,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3 sm:pb-3">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent className="flex-1">
        {isEmpty ? (
          <EmptyState
            className="h-44 py-6"
            icon={<BarChart3 className="h-5 w-5" aria-hidden />}
            title="Belum ada data"
            description={emptyText}
          />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Tooltip (injected by Recharts with active / payload / label) ---------- */

export interface TooltipRow {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  /** Formats a row's value (default: Indonesian number). */
  formatValue?: (value: number, row: TooltipRow) => string;
  /** Overrides the title (default: the axis label). */
  title?: (label: string | number | undefined, rows: TooltipRow[]) => React.ReactNode;
}

export function ChartTooltip({ active, payload, label, formatValue, title }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const heading = title ? title(label, payload) : label;
  return (
    <div className="min-w-[8.5rem] rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg shadow-edge">
      {heading !== undefined && heading !== null && heading !== "" ? (
        <p className="mb-1.5 font-semibold">{heading}</p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((row, index) => {
          const value = typeof row.value === "number" ? row.value : Number(row.value);
          return (
            <li key={`${String(row.dataKey ?? row.name)}-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                {row.color ? (
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />
                ) : null}
                <span className="truncate">{row.name}</span>
              </span>
              <span className="tabular shrink-0 font-semibold">
                {Number.isFinite(value) ? (formatValue ? formatValue(value, row) : formatNumber(value)) : String(row.value ?? "-")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Legend (injected by Recharts with payload) ---------- */

interface LegendEntry {
  value?: React.ReactNode;
  color?: string;
  dataKey?: string | number;
}

/** Token-coloured legend rendered below the plot (`<Legend content={<ChartLegend />} />`). */
export function ChartLegend({ payload }: { payload?: ReadonlyArray<LegendEntry> }) {
  if (!payload?.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {payload.map((entry, index) => (
        <li key={`${String(entry.dataKey ?? entry.value)}-${index}`} className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
          <span>{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Shared axis / grid styling (CSS-variable colours, so charts follow light / dark tokens). */
export const AXIS_TICK = { fontSize: 11, fill: TONE.ink };
export const GRID_STROKE = TONE.grid;
/** Hover band behind bars. */
export const CURSOR_FILL = "hsl(var(--foreground) / 0.06)";
export const CHART_MARGIN = { top: 8, right: 8, left: -12, bottom: 0 };
