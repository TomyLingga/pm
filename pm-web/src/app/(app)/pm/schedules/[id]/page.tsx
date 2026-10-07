"use client";

import { useParams } from "next/navigation";
import { EmptyState } from "@/components/common/states";
import { ScheduleDetailView } from "@/components/pm/schedules/schedule-detail-view";
import { parseId } from "@/lib/utils";

export default function PmScheduleDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params?.id);

  if (id === null) {
    return <EmptyState title="Jadwal PM tidak ditemukan" description="Alamat halaman tidak valid." />;
  }

  return <ScheduleDetailView key={id} id={id} />;
}
