"use client";

import { useParams } from "next/navigation";
import { EmptyState } from "@/components/common/states";
import { TaskDetailView } from "@/components/pm/tasks/detail/task-detail-view";
import { parseId } from "@/lib/utils";

export default function PmTaskDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params?.id);

  if (id === null) {
    return <EmptyState title="Tugas PM tidak ditemukan" description="Alamat halaman tidak valid." />;
  }

  return <TaskDetailView key={id} id={id} />;
}
