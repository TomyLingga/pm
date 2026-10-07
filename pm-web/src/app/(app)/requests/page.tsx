import { Suspense } from "react";
import type { Metadata } from "next";
import { RequestListSkeleton, RequestListView } from "@/components/service-requests/request-list-view";

export const metadata: Metadata = { title: "Form Request" };

export default function RequestsPage() {
  return (
    <Suspense fallback={<RequestListSkeleton />}>
      <RequestListView />
    </Suspense>
  );
}
