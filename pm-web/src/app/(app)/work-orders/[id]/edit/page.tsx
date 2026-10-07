"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useWorkOrder } from "@/components/work-orders/use-work-order";
import { WorkOrderForm, WorkOrderFormSkeleton } from "@/components/work-orders/work-order-form";
import { WorkOrderLoadError } from "@/components/work-orders/work-order-load-error";
import { parseId } from "@/lib/utils";

export default function EditWorkOrderPage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params?.id);
  const query = useWorkOrder(id);

  if (id === null) {
    return <EmptyState title="Work Order tidak ditemukan" description="Alamat halaman tidak valid." />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={query.data ? <span className="font-mono">{query.data.wo_number}</span> : "Work Order"}
        title="Ubah Work Order"
        description="Perubahan hanya dapat dilakukan selama WO masih berstatus DIAJUKAN."
        backHref={`/work-orders/${id}`}
        backLabel="Detail WO"
      />
      {query.isPending ? (
        <WorkOrderFormSkeleton />
      ) : query.isError ? (
        <WorkOrderLoadError error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data.permissions.can_update ? (
        <EmptyState
          title="WO ini tidak dapat diubah"
          description="Hanya pemohon yang dapat mengubah WO selama statusnya masih DIAJUKAN."
          action={
            <Button asChild variant="outline">
              <Link href={`/work-orders/${id}`}>Lihat detail</Link>
            </Button>
          }
        />
      ) : (
        <WorkOrderForm key={query.data.id} workOrder={query.data} />
      )}
    </div>
  );
}
