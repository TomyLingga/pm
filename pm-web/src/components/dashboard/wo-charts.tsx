"use client";

import {
  Area,
  AreaChart,
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
import { CATEGORY_PALETTE, PRIORITY_COLORS, SERIES_COLORS, WO_STATUS_COLORS, colorFor } from "@/lib/chart-colors";
import { formatMinutes } from "@/lib/format";
import { formatNumber } from "@/lib/utils";
import type { CategoryCount, PriorityCount, SlaByPriority, StatusCount, WoTrendPoint } from "@/types/dashboard";
import { AXIS_TICK, CHART_MARGIN, CURSOR_FILL, ChartCard, ChartLegend, ChartTooltip, GRID_STROKE } from "./chart-card";

export function WoByStatusChart({ data }: { data: StatusCount[] }) {
  // The API always lists every status (zeros included), so "empty" means nothing was counted.
  const isEmpty = data.every((entry) => entry.count === 0);
  return (
    <ChartCard title="WO per status" description="Work Order terbit dalam periode" isEmpty={isEmpty}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="status_label"
            tick={AXIS_TICK}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={56}
            axisLine={{ stroke: GRID_STROKE }}
            tickLine={false}
          />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
          <Bar dataKey="count" name="Jumlah WO" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry) => (
              <Cell key={entry.status} fill={colorFor(WO_STATUS_COLORS, entry.status)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WoByPriorityChart({ data }: { data: PriorityCount[] }) {
  const total = data.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <ChartCard title="WO per prioritas" description="Work Order terbit dalam periode" isEmpty={total === 0}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="priority_label"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="transparent"
          >
            {data.map((entry) => (
              <Cell key={entry.priority} fill={colorFor(PRIORITY_COLORS, entry.priority)} />
            ))}
          </Pie>
          <text
            x="50%"
            y="46%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="tabular fill-foreground text-2xl font-semibold"
          >
            {formatNumber(total, 0)}
          </text>
          <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">
            WO
          </text>
          <Tooltip content={<ChartTooltip />} />
          <Legend content={<ChartLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WoByCategoryChart({ data }: { data: CategoryCount[] }) {
  const rows = data.slice(0, 10);
  const height = Math.max(160, rows.length * 32 + 24);
  return (
    <ChartCard title="WO per kategori" description="10 kategori terbanyak" isEmpty={rows.length === 0}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={120} tick={AXIS_TICK} interval={0} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
          <Bar dataKey="count" name="Jumlah WO" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {rows.map((entry, index) => (
              <Cell key={entry.id} fill={CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WoTrendChart({ data, bucket }: { data: WoTrendPoint[]; bucket: "week" | "month" }) {
  // Every bucket of the period is returned (zeros included); an all-zero series would draw a flat stub.
  const isEmpty = data.every((point) => point.created === 0 && point.closed === 0);
  return (
    <ChartCard
      title="Tren WO terbit vs ditutup"
      description={bucket === "week" ? "Per minggu" : "Per bulan"}
      isEmpty={isEmpty}
    >
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="wo-created-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SERIES_COLORS.secondary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={SERIES_COLORS.secondary} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="wo-closed-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SERIES_COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={SERIES_COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" tick={AXIS_TICK} minTickGap={16} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID_STROKE, strokeDasharray: "3 3" }} />
          <Legend content={<ChartLegend />} />
          <Area
            type="monotone"
            dataKey="created"
            name="Terbit"
            stroke={SERIES_COLORS.secondary}
            fill="url(#wo-created-fill)"
            strokeWidth={2}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="closed"
            name="Ditutup"
            stroke={SERIES_COLORS.primary}
            fill="url(#wo-closed-fill)"
            strokeWidth={2}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

const toHours = (minutes: number | null) => (minutes === null ? null : Math.round((minutes / 60) * 10) / 10);

export function WoSlaChart({ data }: { data: SlaByPriority[] }) {
  const rows = data.map((entry) => ({
    ...entry,
    response_hours: toHours(entry.avg_response_minutes),
    completion_hours: toHours(entry.avg_completion_minutes),
  }));
  const isEmpty = rows.every((row) => row.response_hours === null && row.completion_hours === null);

  return (
    <ChartCard
      title="SLA per prioritas"
      description="Rata-rata jam: respon (terbit sampai diambil) dan penyelesaian (diambil sampai selesai)"
      isEmpty={isEmpty}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={rows} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="priority_label" tick={AXIS_TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
          <YAxis tick={AXIS_TICK} unit=" j" axisLine={false} tickLine={false} />
          <Tooltip
            content={
              <ChartTooltip
                formatValue={(value) => formatMinutes(Math.round(value * 60))}
                title={(label, rows) => {
                  const count = rows[0]?.payload?.count;
                  return typeof count === "number" ? `${label} (${formatNumber(count, 0)} WO)` : label;
                }}
              />
            }
            cursor={{ fill: CURSOR_FILL }}
          />
          <Legend content={<ChartLegend />} />
          <Bar dataKey="response_hours" name="Respon" fill={SERIES_COLORS.secondary} radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="completion_hours" name="Penyelesaian" fill={SERIES_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
