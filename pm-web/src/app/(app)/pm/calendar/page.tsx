import { Suspense } from "react";
import type { Metadata } from "next";
import { LoadingState } from "@/components/common/states";
import { CalendarView } from "@/components/pm/calendar/calendar-view";

export const metadata: Metadata = { title: "Kalender PM" };

export default function PmCalendarPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CalendarView />
    </Suspense>
  );
}
