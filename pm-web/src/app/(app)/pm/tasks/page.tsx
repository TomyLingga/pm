import { Suspense } from "react";
import type { Metadata } from "next";
import { TaskListSkeleton, TaskListView } from "@/components/pm/tasks/task-list-view";

export const metadata: Metadata = { title: "Tugas PM" };

export default function PmTasksPage() {
  return (
    <Suspense fallback={<TaskListSkeleton />}>
      <TaskListView />
    </Suspense>
  );
}
