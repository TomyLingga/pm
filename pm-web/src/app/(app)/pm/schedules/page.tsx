import { Suspense } from "react";
import type { Metadata } from "next";
import { LoadingState } from "@/components/common/states";
import { ScheduleListView } from "@/components/pm/schedules/schedule-list-view";

export const metadata: Metadata = { title: "Jadwal PM" };

export default function PmSchedulesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ScheduleListView />
    </Suspense>
  );
}
