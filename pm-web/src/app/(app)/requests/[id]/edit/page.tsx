"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LoadError } from "@/components/common/load-error";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { RequestForm, RequestFormSkeleton } from "@/components/service-requests/request-form";
import { useServiceRequest } from "@/components/service-requests/use-request-action";
import { Button } from "@/components/ui/button";
import { parseId } from "@/lib/utils";

export default function EditRequestPage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params?.id);
  const query = useServiceRequest(id);

  if (id === null) {
    return <EmptyState title="Form Request tidak ditemukan" description="Alamat halaman tidak valid." />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        eyebrow={query.data?.request_number ? <span className="font-mono">{query.data.request_number}</span> : "Form Request"}
        title="Ubah Form Request"
        description="Perubahan hanya dapat dilakukan selama Form Request berstatus DRAFT."
        backHref={`/requests/${id}`}
        backLabel="Detail Form Request"
      />
      {query.isPending ? (
        <RequestFormSkeleton />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => query.refetch()} entity="Form Request" backHref="/requests" />
      ) : !query.data.permissions.can_update ? (
        <EmptyState
          title="Form Request ini tidak dapat diubah"
          description="Hanya pemohon yang dapat mengubah Form Request selama statusnya DRAFT."
          action={
            <Button asChild variant="outline">
              <Link href={`/requests/${id}`}>Lihat detail</Link>
            </Button>
          }
        />
      ) : (
        <RequestForm key={query.data.id} request={query.data} />
      )}
    </div>
  );
}
