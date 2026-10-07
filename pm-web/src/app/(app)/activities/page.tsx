import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import {
  ACTIVITY_PAGE_DESCRIPTION,
  ACTIVITY_PAGE_TITLE,
  ActivityListSkeleton,
  ActivityListView,
} from "@/components/activities/activity-list-view";

export const metadata: Metadata = { title: "Aktivitas Harian" };

/** Shown while the client view reads its URL params; same shape as the loaded page. */
function PageSkeleton() {
  return (
    <div className="space-y-4">
      <PageHeader title={ACTIVITY_PAGE_TITLE} description={ACTIVITY_PAGE_DESCRIPTION} />
      <ActivityListSkeleton />
    </div>
  );
}

export default function ActivitiesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ActivityListView />
    </Suspense>
  );
}
