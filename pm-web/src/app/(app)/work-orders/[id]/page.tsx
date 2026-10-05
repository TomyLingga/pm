"use client";

import { useParams } from "next/navigation";
import { EmptyState } from "@/components/common/states";
import { WorkOrderDetailView } from "@/components/work-orders/detail/work-order-detail-view";
import { parseId } from "@/lib/utils";

export default function WorkOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params?.id);

  if (id === null) {
    return <EmptyState title="Work Order tidak ditemukan" description="Alamat halaman tidak valid." />;
  }

  return <WorkOrderDetailView key={id} id={id} />;
}
