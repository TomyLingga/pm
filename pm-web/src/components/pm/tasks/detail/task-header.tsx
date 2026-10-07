import * as React from "react";
import Link from "next/link";
import { CalendarClock, Cog, Info, Repeat, Timer, UserRound } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { InfoList, PersonStamp, Section } from "@/components/common/section";
import { formatDateTime, formatDateTimeLong, formatMinutes, formatRelative } from "@/lib/format";
import { PM_TASKS_DEFAULT_HREF } from "@/lib/pm-constants";
import { cn } from "@/lib/utils";
import type { PmTaskDetail } from "@/types/pm";
import { FindingsChip, LateChip, PmStatusBadge, SkipProposalChip } from "../../pm-badges";

const OPEN_STATUSES = new Set(["scheduled", "due", "overdue", "in_progress"]);

type FactTone = "danger" | "warning" | null;

const FACT_ICON_TONE: Record<NonNullable<FactTone>, string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
};

/** One fact of the header panel: boxed icon, small label, value. */
function Fact({
  icon,
  label,
  tone = null,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: FactTone;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted-foreground [&_svg]:size-4",
          tone && FACT_ICON_TONE[tone],
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
    </div>
  );
}

const linkClassName =
  "rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/** Compact header with the facts a technician needs first: what, where, when, who. */
export function TaskHeader({ task }: { task: PmTaskDetail }) {
  const open = OPEN_STATUSES.has(task.status);
  const dueTone: FactTone = task.status === "overdue" ? "danger" : task.status === "due" ? "warning" : null;
  const description = [task.equipment.location_name, task.executor_unit.display_name].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <PageHeader
        backHref={PM_TASKS_DEFAULT_HREF}
        backLabel="Daftar Tugas PM"
        eyebrow={
          <>
            <span className="font-mono text-sm font-semibold text-foreground">{task.number}</span> &middot; Tugas PM
          </>
        }
        title={
          <>
            {task.equipment.code ? (
              <span className="font-mono text-muted-foreground">{task.equipment.code} &middot; </span>
            ) : null}
            {task.equipment.name}
          </>
        }
        description={description || undefined}
        actions={
          <>
            <PmStatusBadge status={task.status} label={task.status_label} className="px-3 py-1 text-xs" />
            {task.is_late ? <LateChip /> : null}
            {task.has_skip_proposal ? <SkipProposalChip /> : null}
            <FindingsChip count={task.findings_count} />
          </>
        }
      />

      <div className="panel grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-5">
        <Fact icon={<Cog />} label="Equipment">
          <Link href={`/equipment/${task.equipment.id}`} className={cn(linkClassName, "font-semibold text-primary")}>
            {task.equipment.code ? <span className="font-mono">{task.equipment.code} &middot; </span> : null}
            {task.equipment.name}
          </Link>
          {task.equipment.location_name ? (
            <p className="text-xs text-muted-foreground">{task.equipment.location_name}</p>
          ) : null}
        </Fact>

        <Fact icon={<Repeat />} label="Jadwal">
          {task.schedule ? (
            <>
              <Link href={`/pm/schedules/${task.schedule.id}`} className={cn(linkClassName, "font-medium")}>
                {task.schedule.name}
              </Link>
              <p className="text-xs text-muted-foreground">{task.schedule.frequency_label}</p>
            </>
          ) : (
            <span className="text-muted-foreground">Tanpa jadwal</span>
          )}
        </Fact>

        <Fact icon={<CalendarClock />} label="Jatuh tempo" tone={dueTone}>
          <p
            className={cn(
              "tabular font-medium",
              dueTone === "danger" && "font-semibold text-danger-foreground",
              dueTone === "warning" && "font-semibold text-warning-foreground",
            )}
          >
            {formatDateTime(task.due_at)}
            {open ? <span className="font-normal"> ({formatRelative(task.due_at)})</span> : null}
          </p>
          {task.overdue_at ? (
            <p className="tabular text-xs text-muted-foreground">Batas toleransi {formatDateTime(task.overdue_at)}</p>
          ) : null}
        </Fact>

        <Fact icon={<UserRound />} label="PIC">
          <p className="font-medium">{task.pic?.name ?? "Belum ada PIC"}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Timer className="h-3 w-3" aria-hidden />
            Estimasi {task.estimated_minutes ? formatMinutes(task.estimated_minutes) : "-"}
          </p>
        </Fact>
      </div>
    </div>
  );
}

/** Full task details (side column on desktop, below the checklist on phones). */
export function TaskInfoSection({ task }: { task: PmTaskDetail }) {
  return (
    <Section title="Informasi" icon={<Info className="h-4 w-4" aria-hidden />}>
      <InfoList
        className="sm:grid-cols-1"
        items={[
          { label: "Unit pelaksana", value: task.executor_unit.display_name },
          { label: "Template checklist", value: task.checklist_template?.name },
          { label: "Jatuh tempo", value: <span className="tabular">{formatDateTimeLong(task.due_at)}</span> },
          {
            label: "Mulai jatuh tempo (dapat dikerjakan)",
            value: task.due_window_at ? <span className="tabular">{formatDateTime(task.due_window_at)}</span> : null,
          },
          {
            label: "Batas toleransi",
            value: task.overdue_at ? (
              <span className="tabular">
                {formatDateTime(task.overdue_at)}
                {task.tolerance_hours !== null && task.tolerance_hours !== undefined ? (
                  <span className="block text-xs text-muted-foreground">
                    Toleransi {formatMinutes(task.tolerance_hours * 60)}
                  </span>
                ) : null}
              </span>
            ) : null,
          },
          {
            label: "Dimulai",
            value: task.started_at ? (
              <PersonStamp name={task.started_by?.name ?? null} time={formatDateTime(task.started_at)} />
            ) : null,
          },
          {
            label: "Diselesaikan",
            value: task.completed_at ? (
              <PersonStamp name={task.completed_by?.name ?? null} time={formatDateTime(task.completed_at)} />
            ) : null,
          },
          {
            label: "Durasi pengerjaan",
            value: task.duration_minutes !== null ? formatMinutes(task.duration_minutes) : null,
          },
          {
            label: "Catatan",
            value: task.notes ? <span className="whitespace-pre-wrap">{task.notes}</span> : null,
          },
        ]}
      />
    </Section>
  );
}
