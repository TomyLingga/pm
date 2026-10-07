import { Crown } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  WorkProgramActivity,
  WorkProgramActivityStatus,
  WorkProgramPic,
  WorkProgramStatus,
  WorkProgramStatusCounts,
} from "@/types/work-program";

/* ---------- Tone maps (local to this module, built from Badge variants) ---------- */

export const PROGRAM_STATUS_TONES: Record<WorkProgramStatus, BadgeTone> = {
  active: "success",
  closed: "neutral",
};

export const PROGRAM_STATUS_LABELS: Record<WorkProgramStatus, string> = {
  active: "AKTIF",
  closed: "DITUTUP",
};

/** open = waiting, on_progress = in progress, closed = done, cancelled = dropped. */
export const ACTIVITY_STATUS_TONES: Record<WorkProgramActivityStatus, BadgeTone> = {
  open: "neutral",
  on_progress: "warning",
  closed: "success",
  cancelled: "dashed",
};

export const ACTIVITY_STATUS_LABELS: Record<WorkProgramActivityStatus, string> = {
  open: "Open",
  on_progress: "On Progress",
  closed: "Closed",
  cancelled: "Dibatalkan",
};

export const ACTIVITY_STATUS_OPTIONS: Array<{ value: WorkProgramActivityStatus; label: string }> = [
  { value: "open", label: ACTIVITY_STATUS_LABELS.open },
  { value: "on_progress", label: ACTIVITY_STATUS_LABELS.on_progress },
  { value: "closed", label: ACTIVITY_STATUS_LABELS.closed },
  { value: "cancelled", label: ACTIVITY_STATUS_LABELS.cancelled },
];

/** Tinted tiles for the summary counters (same tones as the badges). */
export const ACTIVITY_STATUS_STYLES: Record<WorkProgramActivityStatus, string> = {
  open: "border-border bg-surface-2 text-muted-foreground",
  on_progress: "border-warning/30 bg-warning-soft text-warning-foreground",
  closed: "border-success/25 bg-success-soft text-success-foreground",
  cancelled: "border-dashed border-muted-foreground/50 bg-transparent text-muted-foreground",
};

/** Solid dots for compact count legends. */
export const ACTIVITY_STATUS_DOTS: Record<WorkProgramActivityStatus, string> = {
  open: "bg-muted-foreground/60",
  on_progress: "bg-warning",
  closed: "bg-success",
  cancelled: "border border-dashed border-muted-foreground bg-transparent",
};

const statusPill = "px-2.5 text-[11px] font-bold uppercase tracking-wide";

export function formatPct(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : `${Math.round(value)}%`;
}

/** Open / on-progress activity whose target date (Y-m-d) lies before `today` (Y-m-d in Asia/Jakarta). */
export function isActivityOverdue(activity: Pick<WorkProgramActivity, "status" | "target_date">, today: string): boolean {
  if (!activity.target_date) return false;
  if (activity.status === "closed" || activity.status === "cancelled") return false;
  return activity.target_date < today;
}

/* ---------- Badges ---------- */

export function ProgramStatusBadge({
  status,
  label,
  className,
}: {
  status: WorkProgramStatus;
  label?: string;
  className?: string;
}) {
  return (
    <Badge variant={PROGRAM_STATUS_TONES[status] ?? "neutral"} className={cn(statusPill, className)}>
      {label ?? PROGRAM_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ActivityStatusBadge({
  status,
  label,
  className,
}: {
  status: WorkProgramActivityStatus;
  label?: string;
  className?: string;
}) {
  return (
    <Badge variant={ACTIVITY_STATUS_TONES[status] ?? "neutral"} className={cn(statusPill, className)}>
      {label ?? ACTIVITY_STATUS_LABELS[status]}
    </Badge>
  );
}

/** "3 Open · 2 On Progress · 1 Closed" with coloured dots; zero counts are hidden unless `showZero`. */
export function StatusCountList({
  counts,
  showZero = false,
  className,
}: {
  counts: WorkProgramStatusCounts;
  showZero?: boolean;
  className?: string;
}) {
  const entries = ACTIVITY_STATUS_OPTIONS.filter((option) => showZero || counts[option.value] > 0);
  if (entries.length === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>Belum ada kegiatan</span>;
  }
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {entries.map((option) => (
        <li key={option.value} className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", ACTIVITY_STATUS_DOTS[option.value])} aria-hidden />
          <span className="tabular font-medium text-foreground">{counts[option.value]}</span> {option.label}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Progress ---------- */

export function ProgressBar({
  value,
  label = "Progres",
  className,
  trackClassName,
}: {
  value: number | null | undefined;
  label?: string;
  className?: string;
  trackClassName?: string;
}) {
  const pct = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", trackClassName, className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out-expo",
          pct >= 100 ? "bg-success" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Ring with the percentage in the middle; `null` renders "-" on an empty track. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 6,
  className,
}: {
  value: number | null | undefined;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={value === null || value === undefined ? "Progres belum ada" : `Progres ${Math.round(pct)}%`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} className="fill-none stroke-surface-3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={cn(
            "fill-none transition-[stroke-dashoffset] duration-300 ease-out-expo",
            pct >= 100 ? "stroke-success" : "stroke-primary",
          )}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (pct / 100) * circumference}
        />
      </svg>
      <span
        className={cn(
          "tabular absolute inset-0 flex items-center justify-center font-semibold tracking-tight",
          size >= 72 ? "text-base" : "text-xs",
        )}
      >
        {formatPct(value)}
      </span>
    </div>
  );
}

/* ---------- PIC ---------- */

/** Name chip; the "utama" PIC gets the accent tint and a crown + "Utama" label. */
export function PicChip({ pic, className }: { pic: WorkProgramPic; className?: string }) {
  const utama = pic.role === "utama";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs",
        utama ? "border-primary/20 bg-primary-soft text-primary-soft-foreground" : "border-border bg-surface-2 text-foreground",
        className,
      )}
      title={pic.position ? `${pic.name} (${pic.position})` : pic.name}
    >
      {utama ? <Crown className="h-3 w-3 shrink-0" aria-hidden /> : null}
      <span className="min-w-0 truncate font-medium">{pic.name}</span>
      {utama ? <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide">Utama</span> : null}
    </span>
  );
}

export function PicChipList({ pics, className }: { pics: WorkProgramPic[]; className?: string }) {
  if (pics.length === 0) return <span className={cn("text-xs text-muted-foreground", className)}>Belum ada PIC</span>;
  const sorted = [...pics].sort((a, b) => (a.role === b.role ? 0 : a.role === "utama" ? -1 : 1));
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {sorted.map((pic) => (
        <PicChip key={pic.id} pic={pic} />
      ))}
    </div>
  );
}
