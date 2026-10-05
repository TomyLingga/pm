import { cn } from "@/lib/utils";

/** Document status colours (Work Order + Form Request share most codes). */
const STATUS_STYLES: Record<string, string> = {
  // shared / WO
  submitted: "border-sky-200 bg-sky-100 text-sky-800",
  received: "border-violet-200 bg-violet-100 text-violet-800",
  in_progress: "border-amber-300 bg-amber-100 text-amber-900",
  completed: "border-teal-200 bg-teal-100 text-teal-800",
  closed: "border-emerald-700 bg-emerald-600 text-white",
  cancelled: "border-red-200 bg-red-100 text-red-700",
  converted: "border-purple-200 bg-purple-100 text-purple-800",
  // Form Request
  draft: "border-slate-300 bg-slate-100 text-slate-700",
  waiting_superior: "border-sky-200 bg-sky-100 text-sky-800",
  waiting_executor: "border-indigo-200 bg-indigo-100 text-indigo-800",
  rejected: "border-red-700 bg-red-600 text-white",
};

const PRIORITY_STYLES: Record<string, { badge: string; dot: string }> = {
  high: { badge: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
  medium: { badge: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  low: { badge: "border-slate-200 bg-slate-50 text-slate-700", dot: "bg-slate-400" },
};

/** Approval step status colours (PENGESAHAN block). */
const STEP_STYLES: Record<string, string> = {
  waiting: "border-slate-200 bg-slate-50 text-slate-600",
  pending: "border-amber-300 bg-amber-100 text-amber-900",
  approved: "border-emerald-200 bg-emerald-100 text-emerald-800",
  completed: "border-emerald-200 bg-emerald-100 text-emerald-800",
  rejected: "border-red-200 bg-red-100 text-red-700",
  revision_requested: "border-orange-200 bg-orange-100 text-orange-800",
  skipped: "border-dashed border-slate-300 bg-transparent text-slate-500",
  cancelled: "border-slate-200 bg-slate-100 text-slate-500",
};

export function StatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide",
        STATUS_STYLES[status] ?? "border-slate-200 bg-slate-100 text-slate-700",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function PriorityBadge({ priority, label, className }: { priority: string; label: string; className?: string }) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        style.badge,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden />
      {label}
    </span>
  );
}

export function StepStatusChip({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-semibold",
        STEP_STYLES[status] ?? STEP_STYLES.waiting,
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Red "Lewat 24 jam" badge for overdue approvals. */
export function OverdueBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white",
        className,
      )}
    >
      Lewat 24 jam
    </span>
  );
}
