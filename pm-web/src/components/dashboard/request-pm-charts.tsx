"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { COMPLIANCE_COLORS, SR_STATUS_COLORS, colorFor } from "@/lib/chart-colors";
import { formatPercent } from "@/lib/dashboard";
import { formatNumber } from "@/lib/utils";
import type { PmCompliance, PmTrendPoint, StatusCount, StepCount } from "@/types/dashboard";
import { AXIS_TICK, CHART_MARGIN, CURSOR_FILL, ChartCard, ChartLegend, ChartTooltip, GRID_STROKE } from "./chart-card";

export function RequestsByStatusChart({ data, pendingBySteps }: { data: StatusCount[]; pendingBySteps: StepCount[] }) {
  const pendingTotal = pendingBySteps.reduce((sum, step) => sum + step.count, 0);
  // Every status comes back (zeros included); labels such as MENUNGGU_ATASAN read better without underscores.
  const hasRequests = data.some((entry) => entry.count > 0);
  const rows = data.map((entry) => ({ ...entry, status_label: entry.status_label.replace(/_/g, " ") }));
  return (
    <ChartCard title="Form Request per status" description="Request dibuat dalam periode" isEmpty={!hasRequests && pendingTotal === 0}>
      <div className="space-y-4">
        {hasRequests ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
              <XAxis
                dataKey="status_label"
                tick={AXIS_TICK}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={60}
                axisLine={{ stroke: GRID_STROKE }}
                tickLine={false}
              />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
              <Bar dataKey="count" name="Jumlah request" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {rows.map((entry) => (
                  <Cell key={entry.status} fill={colorFor(SR_STATUS_COLORS, entry.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground">Tidak ada request yang dibuat dalam periode ini.</p>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Menunggu approval per langkah (saat ini)</p>
          {pendingBySteps.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tidak ada request yang menunggu approval.</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {pendingBySteps.map((step) => (
                <li key={step.key} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate">{step.label}</span>
                  <span className="tabular shrink-0 font-semibold">{formatNumber(step.count, 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ChartCard>
  );
}

const COMPLIANCE_LABELS = {
  on_time: "Tepat waktu",
  late: "Terlambat",
  skipped: "Dilewati",
  open_overdue: "Belum selesai (lewat toleransi)",
};

/** Same thresholds as the "Kepatuhan PM" KPI tile. */
function complianceTone(pct: number | null): BadgeTone {
  if (pct === null) return "neutral";
  if (pct >= 90) return "success";
  if (pct >= 70) return "warning";
  return "danger";
}

export function PmComplianceChart({
  trend,
  compliance,
  bucket,
}: {
  trend: PmTrendPoint[];
  compliance: PmCompliance | null;
  bucket: "week" | "month";
}) {
  const slices = compliance
    ? (Object.keys(COMPLIANCE_LABELS) as Array<keyof typeof COMPLIANCE_LABELS>)
        .map((key) => ({ key, name: COMPLIANCE_LABELS[key], value: compliance[key] }))
        .filter((slice) => slice.value > 0)
    : [];
  const isEmpty = slices.length === 0 && trend.every((point) => point.on_time + point.late + point.skipped === 0);

  return (
    <ChartCard
      title="Kepatuhan PM"
      description={`Tugas PM jatuh tempo dalam periode, ${bucket === "week" ? "per minggu" : "per bulan"}`}
      isEmpty={isEmpty}
      actions={
        compliance ? (
          <Badge variant={complianceTone(compliance.pct_on_time)} className="tabular">
            {formatPercent(compliance.pct_on_time)} tepat waktu
          </Badge>
        ) : undefined
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        {trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" tick={AXIS_TICK} minTickGap={16} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
              <Legend content={<ChartLegend />} />
              <Bar dataKey="on_time" name="Tepat waktu" stackId="pm" fill={COMPLIANCE_COLORS.on_time} maxBarSize={40} />
              <Bar dataKey="late" name="Terlambat" stackId="pm" fill={COMPLIANCE_COLORS.late} maxBarSize={40} />
              <Bar
                dataKey="skipped"
                name="Dilewati"
                stackId="pm"
                fill={COMPLIANCE_COLORS.skipped}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="self-center text-xs text-muted-foreground">Tidak ada tugas PM jatuh tempo dalam periode ini.</p>
        )}

        {compliance && slices.length > 0 ? (
          <div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={slices} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="transparent">
                  {slices.map((slice) => (
                    <Cell key={slice.key} fill={COMPLIANCE_COLORS[slice.key]} />
                  ))}
                </Pie>
                <text
                  x="50%"
                  y="47%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="tabular fill-foreground text-lg font-semibold"
                >
                  {formatNumber(compliance.total, 0)}
                </text>
                <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
                  tugas
                </text>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-1 space-y-1 text-[11px]">
              {slices.map((slice) => (
                <li key={slice.key} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: COMPLIANCE_COLORS[slice.key] }}
                      aria-hidden
                    />
                    <span className="truncate">{slice.name}</span>
                  </span>
                  <span className="tabular shrink-0 font-semibold">{formatNumber(slice.value, 0)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </ChartCard>
  );
}
