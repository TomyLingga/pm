import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { WorkOrderListSkeleton, WorkOrderListView } from "@/components/work-orders/work-order-list-view";

export const metadata: Metadata = { title: "Work Order" };

/** Shown while the client view reads its URL params; same shape as the loaded page. */
function PageSkeleton() {
  return (
    <div className="space-y-4">
      <PageHeader title="Work Order" description="Permintaan perbaikan & dukungan ke unit pelaksana." />
      <WorkOrderListSkeleton />
    </div>
  );
}

export default function WorkOrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkOrderListView />
    </Suspense>
  );
}
