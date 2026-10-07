import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  Hourglass,
  Inbox,
  RotateCcw,
  ShieldCheck,
  Timer,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { canAccessPm } from "@/lib/auth";
import { formatMinutesShort, formatPercent } from "@/lib/dashboard";
import { cn, formatNumber } from "@/lib/utils";
import type { Me } from "@/types/auth";
import type { DashboardKpi } from "@/types/dashboard";
import { pmTasksHref } from "@/components/pm/use-pm-units";

type Tone = "default" | "warning" | "danger" | "success" | "info";

/** Value colour: semantic `-foreground` tokens read well on the card surface in both themes. */
const VALUE_TONES: Record<Tone, string> = {
  default: "text-foreground",
  warning: "text-warning-foreground",
  danger: "text-danger-foreground",
  success: "text-success-foreground",
  info: "text-info-foreground",
};

/** Icon chip: tinted `-soft` background with the matching foreground. */
const ICON_TONES: Record<Tone, string> = {
  default: "bg-surface-2 text-muted-foreground",
  warning: "bg-warning-soft text-warning-foreground",
  danger: "bg-danger-soft text-danger-foreground",
  success: "bg-success-soft text-success-foreground",
  info: "bg-info-soft text-info-foreground",
};

interface KpiTileProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
  badge?: React.ReactNode;
}

const tileClassName = "panel block min-w-0 p-3 sm:p-4";

function KpiTile({ label, value, sub, icon: Icon, tone = "default", href, badge }: KpiTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", ICON_TONES[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {badge}
      </div>
      <p className={cn("tabular mt-3 text-2xl font-semibold leading-none tracking-tight", VALUE_TONES[tone])}>{value}</p>
      <p className="mt-1.5 truncate text-xs font-medium text-muted-foreground" title={label}>
        {label}
      </p>
      {sub ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">{sub}</p> : null}
    </>
  );
  // The whole tile is the link (no nested anchors inside).
  return href ? (
    <Link
      href={href}
      className={cn(
        tileClassName,
        "transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/40 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={tileClassName}>{body}</div>
  );
}

const n = (value: number | null | undefined) => formatNumber(value ?? 0, 0);

/** The KPI row. PM tiles are only shown to users who can see the PM module. */
export function KpiTiles({ kpi, me }: { kpi: DashboardKpi; me: Me }) {
  const showPm = canAccessPm(me);
  const compliance = kpi.pm_compliance_pct;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiTile label="WO terbuka" value={n(kpi.wo_open)} sub="belum closed" icon={ClipboardList} tone="info" href="/work-orders" />
      <KpiTile
        label="WO terbit / ditutup"
        value={
          <>
            {n(kpi.wo_created)} <span className="text-base font-medium text-muted-foreground">/ {n(kpi.wo_closed)}</span>
          </>
        }
        sub="dalam periode"
        icon={Wrench}
      />
      <KpiTile
        label="Menunggu konfirmasi user"
        value={n(kpi.wo_awaiting_acceptance)}
        sub="WO selesai dikerjakan"
        icon={Hourglass}
        tone={kpi.wo_awaiting_acceptance > 0 ? "warning" : "default"}
        href="/work-orders?status=completed"
      />
      <KpiTile
        label="Request menunggu approval"
        value={n(kpi.requests_pending_approval)}
        icon={FileSignature}
        href={kpi.requests_waiting_me > 0 ? "/approvals" : "/requests"}
        badge={
          // Badge is a plain span: the whole tile already links to /approvals in this case (no <a> inside <a>).
          kpi.requests_waiting_me > 0 ? (
            <Badge variant="danger-solid" className="tabular px-2 text-[11px]">
              <Inbox className="h-3 w-3" aria-hidden />
              {n(kpi.requests_waiting_me)} menunggu saya
            </Badge>
          ) : null
        }
      />
      <KpiTile
        label="Rata-rata respon WO"
        value={formatMinutesShort(kpi.wo_avg_response_minutes)}
        sub="terbit sampai diambil"
        icon={Timer}
      />
      <KpiTile
        label="Rata-rata penyelesaian WO"
        value={formatMinutesShort(kpi.wo_avg_completion_minutes)}
        sub={
          kpi.wo_median_completion_minutes !== null
            ? `median ${formatMinutesShort(kpi.wo_median_completion_minutes)}`
            : "diambil sampai selesai"
        }
        icon={CheckCircle2}
      />
      {showPm ? (
        <>
          <KpiTile
            label="PM jatuh tempo"
            value={n(kpi.pm_due)}
            icon={CalendarClock}
            tone={kpi.pm_due > 0 ? "warning" : "default"}
            href={pmTasksHref(me, { status: "due" })}
          />
          <KpiTile
            label="PM terlambat"
            value={n(kpi.pm_overdue)}
            icon={AlertTriangle}
            tone={kpi.pm_overdue > 0 ? "danger" : "default"}
            href={pmTasksHref(me, { status: "overdue" })}
          />
          <KpiTile
            label="PM dikerjakan"
            value={n(kpi.pm_in_progress)}
            icon={Wrench}
            tone="info"
            href={pmTasksHref(me, { status: "in_progress" })}
          />
          <KpiTile
            label="Kepatuhan PM"
            value={formatPercent(compliance)}
            sub="selesai tepat waktu"
            icon={ShieldCheck}
            tone={compliance === null ? "default" : compliance >= 90 ? "success" : compliance >= 70 ? "warning" : "danger"}
          />
        </>
      ) : null}
      <KpiTile
        label="WO dikerjakan ulang"
        value={n(kpi.wo_rework_count)}
        sub="ditolak user, dalam periode"
        icon={RotateCcw}
        tone={kpi.wo_rework_count > 0 ? "warning" : "default"}
      />
    </div>
  );
}
