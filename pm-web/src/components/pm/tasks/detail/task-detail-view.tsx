"use client";

import * as React from "react";
import { Hourglass, Info, SkipForward } from "lucide-react";
import { HistoryTimeline } from "@/components/common/history-timeline";
import { LoadError } from "@/components/common/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { PM_STATUS_LABELS, PM_TASKS_DEFAULT_HREF } from "@/lib/pm-constants";
import { cn } from "@/lib/utils";
import type { PmTaskDetail } from "@/types/pm";
import { ChecklistPreview } from "./checklist-preview";
import { TaskActionBar } from "./task-action-bar";
import { TaskHeader, TaskInfoSection } from "./task-header";
import { TaskResults } from "./task-results";
import { TaskWorkForm } from "./task-work-form";
import { usePmTask } from "./use-pm-task";

/** Placeholder shaped like the detail page: header, facts panel, action bar, two-column body. */
function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="panel grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="h-8 w-8 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Static notice above the content (neutral = surface ladder, info = tinted). */
function Notice({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: "neutral" | "info";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-sm sm:p-4",
        tone === "info" ? "border-info/25 bg-info-soft text-info-foreground" : "bg-surface-2 text-foreground",
      )}
    >
      <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", tone === "info" ? "text-info" : "text-muted-foreground")} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Notices({ task }: { task: PmTaskDetail }) {
  return (
    <>
      {task.status === "skipped" ? (
        <Notice icon={<SkipForward />}>
          <p className="font-semibold">
            Dilewati {task.skipped_at ? <span className="tabular">{formatDateTime(task.skipped_at)}</span> : ""} oleh{" "}
            {task.skipped_by?.name ?? "sistem"}
          </p>
          {task.skip_reason ? <p className="mt-0.5 whitespace-pre-wrap">{task.skip_reason}</p> : null}
        </Notice>
      ) : null}

      {task.status === "scheduled" && !task.permissions.can_start ? (
        <Notice icon={<Info />}>
          <p>
            Tugas ini masih <strong>TERJADWAL</strong>. Pengerjaan dapat dimulai saat jatuh tempo
            {task.due_window_at ? (
              <>
                {" "}
                (<span className="tabular">{formatDateTime(task.due_window_at)}</span>)
              </>
            ) : null}
            .
          </p>
        </Notice>
      ) : null}

      {task.status === "in_progress" && !task.permissions.can_work ? (
        <Notice tone="info" icon={<Hourglass />}>
          <p>
            Sedang dikerjakan{task.started_by ? ` oleh ${task.started_by.name}` : ""}
            {task.started_at ? (
              <>
                {" "}
                sejak <span className="tabular">{formatDateTime(task.started_at)}</span>
              </>
            ) : null}
            . Jawaban di bawah adalah yang sudah tersimpan sejauh ini.
          </p>
        </Notice>
      ) : null}
    </>
  );
}

export function TaskDetailView({ id }: { id: number }) {
  const query = usePmTask(id);

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    return (
      <LoadError
        error={query.error}
        onRetry={() => query.refetch()}
        entity="Tugas PM"
        backHref={PM_TASKS_DEFAULT_HREF}
      />
    );
  }

  const task = query.data;
  const working = task.status === "in_progress" && task.permissions.can_work;

  return (
    <div className="space-y-4">
      <TaskHeader task={task} />
      <Notices task={task} />
      <TaskActionBar task={task} />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {working ? (
            <TaskWorkForm key={task.id} task={task} />
          ) : task.items.length > 0 ? (
            <TaskResults task={task} />
          ) : (
            <ChecklistPreview items={task.checklist_preview ?? []} templateName={task.checklist_template?.name} />
          )}
        </div>
        <div className="min-w-0 space-y-4">
          <TaskInfoSection task={task} />
          <HistoryTimeline logs={task.logs ?? []} statusLabels={PM_STATUS_LABELS} />
        </div>
      </div>
    </div>
  );
}
