import { Suspense } from "react";
import type { Metadata } from "next";
import { LoadingState } from "@/components/common/states";
import { WorkOrderListView } from "@/components/work-orders/work-order-list-view";

export const metadata: Metadata = { title: "Work Order" };

export default function WorkOrdersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <WorkOrderListView />
    </Suspense>
  );
}
